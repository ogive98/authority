"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { PrefsModesOpsPanel } from "@/components/settings/prefs-modes-ops-panel";
import { PrefsToggleRow } from "@/components/settings/prefs-toggle-row";
import { useMeRegistry } from "@/hooks/use-me-registry";
import {
  fetchGlMapping,
  GL_MAPPING_DEFAULTS,
  GL_MAPPING_KEYS,
} from "@/lib/accounting";
import {
  OPS_VISIBILITY_DEFAULTS,
  OPS_VISIBILITY_KEYS,
} from "@/lib/ops-visibility";
import {
  PREFS_COMPARTMENTS,
  type PrefsCompartmentId,
} from "@/lib/prefs-compartments";
import {
  fetchEffectiveSettings,
  fetchExpertiseCatalog,
  fetchSettingsCapabilities,
  postMailTest,
  putCompanySetting,
  putRoleSetting,
  putUserSetting,
  upsertExpertise,
  type ExpertiseSlot,
} from "@/lib/settings";
import {
  fetchIrppBrackets,
  replaceIrppBrackets,
} from "@/lib/hr";
import { softPanel, softSelect } from "@/lib/soft-glass-ui";
import { fetchMailStatus, type MailStatus } from "@/lib/users";
import { usePrefsStore, type Density, type SurfaceMode } from "@/stores/prefs-store";

const HASH_COMPARTMENTS = new Set<PrefsCompartmentId>([
  "expertise",
  "envois",
  "modes",
  "finance",
  "comptabilite",
  "roles",
  "poste",
]);

const SURFACE_LABELS: Record<SurfaceMode, string> = {
  ghost: "Ghost (matériau glass)",
  patch: "Patch (matériau glass)",
  solid: "Solid (matériau glass)",
  minimal: "Minimal (matériau glass)",
};

type GlMapForm = {
  ar: string;
  bank: string;
  revenue: string;
  vat: string;
  bankFee: string;
  salesJournal: string;
  bankJournal: string;
};

type ExpertiseLoad =
  | { kind: "loading" }
  | { kind: "ok"; items: ExpertiseSlot[]; pending: number }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type ExpertDraft = {
  valueLabel: string;
  lawRef: string;
  expertValidatedAt: string;
  rateBps: string;
  amountMilli: string;
  notes: string;
};

function emptyDraft(): ExpertDraft {
  return {
    valueLabel: "",
    lawRef: "",
    expertValidatedAt: "",
    rateBps: "",
    amountMilli: "",
    notes: "",
  };
}

function draftFromSlot(row: ExpertiseSlot): ExpertDraft {
  if (row.status !== "VALIDATED") {
    return emptyDraft();
  }
  return {
    valueLabel: row.valueSummary ?? "",
    lawRef: row.lawRef ?? "",
    expertValidatedAt: row.expertValidatedAt
      ? row.expertValidatedAt.slice(0, 10)
      : "",
    rateBps: row.rateBps != null ? String(row.rateBps) : "",
    amountMilli: row.amountMilli != null ? String(row.amountMilli) : "",
    notes: row.notes ?? "",
  };
}

function statusTone(
  status: ExpertiseSlot["status"],
): "success" | "warning" | "neutral" {
  switch (status) {
    case "VALIDATED":
      return "success";
    case "PENDING_EXPERT":
      return "warning";
    default:
      return "neutral";
  }
}

function statusLabel(status: ExpertiseSlot["status"]): string {
  switch (status) {
    case "VALIDATED":
      return "Validé expert";
    case "PENDING_EXPERT":
      return "En attente expert";
    default:
      return "N/A";
  }
}

function parseHashCompartment(hash: string): PrefsCompartmentId | null {
  const id = hash.replace(/^#/, "") as PrefsCompartmentId;
  return HASH_COMPARTMENTS.has(id) ? id : null;
}

function isAdminOnlyCompartment(id: PrefsCompartmentId): boolean {
  return PREFS_COMPARTMENTS.some((c) => c.id === id && c.adminOnly);
}

export default function SettingsPage() {
  const { data: registry, isFetched } = useMeRegistry();
  const canCompanyWrite = useMemo(
    () =>
      registry.modules.some(
        (m) =>
          m.key === "settings" &&
          m.features.some((f) => f.id === "prefs" || f.id === "expertise"),
      ),
    [registry.modules],
  );

  const [compartment, setCompartment] = useState<PrefsCompartmentId>("poste");
  const compartmentInited = useRef(false);
  const [companyDeniedHint, setCompanyDeniedHint] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expertise, setExpertise] = useState<ExpertiseLoad>({
    kind: "loading",
  });
  const [drafts, setDrafts] = useState<Record<string, ExpertDraft>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [irppBracketDrafts, setIrppBracketDrafts] = useState<
    Array<{ upToMilli: string; rateBps: string; lawRef: string }>
  >([{ upToMilli: "", rateBps: "0", lawRef: "" }]);
  const [irppBracketBusy, setIrppBracketBusy] = useState(false);
  const [irppBracketError, setIrppBracketError] = useState<string | null>(null);
  const [outlookFrom, setOutlookFrom] = useState("");
  const [waPrefix, setWaPrefix] = useState("");
  const [inviteTtl, setInviteTtl] = useState("7");
  const [inviteMinPwd, setInviteMinPwd] = useState("8");
  const [inviteAutoSend, setInviteAutoSend] = useState(true);
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteBodyText, setInviteBodyText] = useState("");
  const [inviteBodyHtml, setInviteBodyHtml] = useState("");
  const [inviteWebOrigin, setInviteWebOrigin] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpPassSet, setSmtpPassSet] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState("");
  const [envoisBusy, setEnvoisBusy] = useState(false);
  const [mailTestBusy, setMailTestBusy] = useState(false);
  const [dunSmtpHost, setDunSmtpHost] = useState("");
  const [dunSmtpPort, setDunSmtpPort] = useState("587");
  const [dunSmtpSecure, setDunSmtpSecure] = useState(false);
  const [dunSmtpUser, setDunSmtpUser] = useState("");
  const [dunSmtpPass, setDunSmtpPass] = useState("");
  const [dunSmtpPassSet, setDunSmtpPassSet] = useState(false);
  const [dunSmtpFrom, setDunSmtpFrom] = useState("");
  const [dunWaPhoneId, setDunWaPhoneId] = useState("");
  const [dunWaToken, setDunWaToken] = useState("");
  const [dunWaTokenSet, setDunWaTokenSet] = useState(false);
  const [dunWaApiVersion, setDunWaApiVersion] = useState("v21.0");
  const [dunWaTemplateName, setDunWaTemplateName] = useState("");
  const [dunWaTemplateLanguage, setDunWaTemplateLanguage] = useState("");
  const [dunWaTemplateBodyParams, setDunWaTemplateBodyParams] = useState("");
  const [dunWaVerifyToken, setDunWaVerifyToken] = useState("");
  const [dunWaAppSecret, setDunWaAppSecret] = useState("");
  const [dunWaAppSecretSet, setDunWaAppSecretSet] = useState(false);
  const [envoisMsg, setEnvoisMsg] = useState<string | null>(null);
  const [envoisError, setEnvoisError] = useState<string | null>(null);
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);

  const [glDraft, setGlDraft] = useState<GlMapForm>({ ...GL_MAPPING_DEFAULTS });
  const [glBusy, setGlBusy] = useState(false);
  const [glMsg, setGlMsg] = useState<string | null>(null);
  const [glError, setGlError] = useState<string | null>(null);

  const [roleCaps, setRoleCaps] = useState<{
    canWriteRole: boolean;
    roles: string[];
  } | null>(null);
  const [roleCapsError, setRoleCapsError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [roleGhostHideDelivery, setRoleGhostHideDelivery] = useState(
    OPS_VISIBILITY_DEFAULTS.ghostHideDelivery,
  );
  const [rolePatchHideDelivery, setRolePatchHideDelivery] = useState(
    OPS_VISIBILITY_DEFAULTS.patchHideDelivery,
  );
  const [rolePatchIntensity, setRolePatchIntensity] = useState(
    OPS_VISIBILITY_DEFAULTS.patchAccountingIntensity,
  );
  const [roleGhostAccountingPartial, setRoleGhostAccountingPartial] = useState(
    OPS_VISIBILITY_DEFAULTS.ghostAccountingPartial,
  );
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [salesReserve, setSalesReserve] = useState(true);
  const [salesAutoConfirm, setSalesAutoConfirm] = useState(false);
  const [salesRequireDate, setSalesRequireDate] = useState(false);
  const [salesAllowManualPrice, setSalesAllowManualPrice] = useState(true);
  const [salesDefaultCurrency, setSalesDefaultCurrency] = useState("TND");
  const [invLotHour, setInvLotHour] = useState("0");
  const [invLotTz, setInvLotTz] = useState("Africa/Tunis");
  const [ventesBusy, setVentesBusy] = useState(false);
  const [ventesMsg, setVentesMsg] = useState<string | null>(null);
  const [ventesError, setVentesError] = useState<string | null>(null);

  const [creditEnforce, setCreditEnforce] = useState(false);

  const density = usePrefsStore((s) => s.density);
  const setDensity = usePrefsStore((s) => s.setDensity);
  const surfaceMode = usePrefsStore((s) => s.surfaceMode);
  const setSurfaceMode = usePrefsStore((s) => s.setSurfaceMode);
  const opsUnlockCode = usePrefsStore((s) => s.opsUnlockCode);
  const setOpsUnlockCode = usePrefsStore((s) => s.setOpsUnlockCode);
  const [unlockDraft, setUnlockDraft] = useState(opsUnlockCode);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const showSseBanner = usePrefsStore((s) => s.showSseBanner);
  const setShowSseBanner = usePrefsStore((s) => s.setShowSseBanner);
  const jobAlerts = usePrefsStore((s) => s.jobAlerts);
  const setJobAlerts = usePrefsStore((s) => s.setJobAlerts);
  const sidebarAutoCollapseSec = usePrefsStore(
    (s) => s.sidebarAutoCollapseSec,
  );
  const setSidebarAutoCollapseSec = usePrefsStore(
    (s) => s.setSidebarAutoCollapseSec,
  );

  const visibleCompartments = useMemo(
    () =>
      PREFS_COMPARTMENTS.filter((c) => !c.adminOnly || canCompanyWrite),
    [canCompanyWrite],
  );

  useEffect(() => {
    setUnlockDraft(opsUnlockCode);
  }, [opsUnlockCode]);

  useEffect(() => {
    if (compartment !== "modes" || !canCompanyWrite) return;
    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const row = res.data.settings.find((s) => s.key === "ops.unlock_code");
      if (typeof row?.value === "string") {
        setOpsUnlockCode(row.value);
      }
    })();
  }, [compartment, canCompanyWrite, setOpsUnlockCode]);

  async function onSaveUnlockCode() {
    if (!canCompanyWrite || unlockBusy) return;
    const cleaned = unlockDraft.replace(/\D/g, "").slice(0, 12);
    if (cleaned.length < 4) {
      setUnlockError("4 à 12 chiffres requis.");
      setUnlockMsg(null);
      return;
    }
    setUnlockBusy(true);
    setUnlockError(null);
    setUnlockMsg(null);
    const r = await putCompanySetting("ops.unlock_code", cleaned);
    setUnlockBusy(false);
    if (!r.ok) {
      setUnlockError(r.message);
      return;
    }
    setOpsUnlockCode(
      typeof r.data.value === "string" ? r.data.value : cleaned,
    );
    setUnlockDraft(usePrefsStore.getState().opsUnlockCode);
    setUnlockMsg("Code enregistré (société).");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  useEffect(() => {
    const prefs = usePrefsStore.getState();
    prefs.applyDensityToDom(prefs.density);
    prefs.applySurfaceToDom(prefs.surfaceMode);
  }, []);

  const selectCompartment = useCallback(
    (id: PrefsCompartmentId) => {
      if (isAdminOnlyCompartment(id) && !canCompanyWrite) {
        setCompanyDeniedHint(true);
        setCompartment("poste");
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/settings#poste");
        }
        return;
      }
      setCompanyDeniedHint(false);
      setCompartment(id);
      if (typeof window !== "undefined") {
        if (HASH_COMPARTMENTS.has(id)) {
          window.history.replaceState(null, "", `/settings#${id}`);
        } else {
          window.history.replaceState(null, "", "/settings");
        }
      }
    },
    [canCompanyWrite],
  );

  useEffect(() => {
    if (!isFetched) return;
    const hashId =
      typeof window !== "undefined"
        ? parseHashCompartment(window.location.hash)
        : null;

    if (!compartmentInited.current) {
      compartmentInited.current = true;
      if (hashId) {
        if (isAdminOnlyCompartment(hashId) && !canCompanyWrite) {
          setCompartment("poste");
          setCompanyDeniedHint(true);
        } else {
          setCompartment(hashId);
          setCompanyDeniedHint(false);
        }
        return;
      }
      setCompartment(canCompanyWrite ? "expertise" : "poste");
      return;
    }

    if (isAdminOnlyCompartment(compartment) && !canCompanyWrite) {
      setCompartment("poste");
    }
  }, [isFetched, canCompanyWrite, compartment]);

  const loadExpertise = useCallback(async () => {
    if (!canCompanyWrite) {
      setExpertise({
        kind: "forbidden",
        message: "Réservé à l’administrateur société.",
      });
      return;
    }
    setExpertise({ kind: "loading" });
    const res = await fetchExpertiseCatalog();
    if (!res.ok) {
      if (res.status === 403) {
        setExpertise({ kind: "forbidden", message: res.message });
        return;
      }
      setExpertise({ kind: "error", message: res.message });
      return;
    }
    const nextDrafts: Record<string, ExpertDraft> = {};
    for (const item of res.data.items) {
      if (item.writable) {
        nextDrafts[item.key] = draftFromSlot(item);
      }
    }
    setDrafts(nextDrafts);
    setFormErrors({});
    setExpertise({
      kind: "ok",
      items: res.data.items,
      pending: res.data.pendingExpertCount,
    });

    const bracketsRes = await fetchIrppBrackets();
    if (bracketsRes.ok) {
      if (bracketsRes.data.items.length === 0) {
        setIrppBracketDrafts([{ upToMilli: "", rateBps: "0", lawRef: "" }]);
      } else {
        setIrppBracketDrafts(
          bracketsRes.data.items.map((b) => ({
            upToMilli: b.upToMilli == null ? "" : String(b.upToMilli),
            rateBps: String(b.rateBps),
            lawRef: b.lawRef ?? "",
          })),
        );
      }
      setIrppBracketError(null);
    } else if (bracketsRes.status !== 403) {
      setIrppBracketError(bracketsRes.message);
    }
  }, [canCompanyWrite]);

  useEffect(() => {
    if (compartment === "expertise" && canCompanyWrite) {
      void loadExpertise();
    }
  }, [compartment, loadExpertise, canCompanyWrite]);

  const loadEnvois = useCallback(async () => {
    if (!canCompanyWrite) {
      setEnvoisError("Réservé à l’administrateur société.");
      return;
    }
    setEnvoisError(null);
    const res = await fetchEffectiveSettings();
    if (!res.ok) {
      setEnvoisError(res.message);
      return;
    }
    const get = (key: string) =>
      res.data.settings.find((s) => s.key === key)?.value;
    const str = (key: string) => {
      const v = get(key);
      return typeof v === "string" ? v : v == null ? "" : String(v);
    };
    const num = (key: string, fallback: string) => {
      const v = get(key);
      if (typeof v === "number") return String(v);
      if (typeof v === "string" && v.trim()) return v;
      return fallback;
    };
    const bool = (key: string, fallback: boolean) => {
      const v = get(key);
      if (typeof v === "boolean") return v;
      return fallback;
    };
    setOutlookFrom(str("salubrita.outlook.from_email"));
    setWaPrefix(str("salubrita.whatsapp.default_prefix"));
    setInviteTtl(num("identity.invite.ttl_days", "7"));
    setInviteMinPwd(num("identity.invite.min_password_length", "8"));
    setInviteAutoSend(bool("identity.invite.auto_send", true));
    setInviteSubject(str("identity.invite.email_subject"));
    setInviteBodyText(str("identity.invite.email_body_text"));
    setInviteBodyHtml(str("identity.invite.email_body_html"));
    setInviteWebOrigin(str("identity.invite.web_origin"));
    setSmtpHost(str("identity.smtp.host"));
    setSmtpPort(num("identity.smtp.port", "587"));
    setSmtpSecure(bool("identity.smtp.secure", false));
    setSmtpUser(str("identity.smtp.user"));
    const passRow = res.data.settings.find(
      (s) => s.key === "identity.smtp.pass",
    );
    setSmtpPass("");
    setSmtpPassSet(Boolean(passRow?.secretSet));
    setSmtpFrom(str("identity.smtp.from"));
    setDunSmtpHost(str("finance.dunning.smtp.host"));
    setDunSmtpPort(num("finance.dunning.smtp.port", "587"));
    setDunSmtpSecure(bool("finance.dunning.smtp.secure", false));
    setDunSmtpUser(str("finance.dunning.smtp.user"));
    const dunPassRow = res.data.settings.find(
      (s) => s.key === "finance.dunning.smtp.pass",
    );
    setDunSmtpPass("");
    setDunSmtpPassSet(Boolean(dunPassRow?.secretSet));
    setDunSmtpFrom(str("finance.dunning.smtp.from"));
    setDunWaPhoneId(str("finance.dunning.wa.phone_number_id"));
    const dunTokRow = res.data.settings.find(
      (s) => s.key === "finance.dunning.wa.access_token",
    );
    setDunWaToken("");
    setDunWaTokenSet(Boolean(dunTokRow?.secretSet));
    setDunWaApiVersion(str("finance.dunning.wa.api_version") || "v21.0");
    setDunWaTemplateName(str("finance.dunning.wa.template_name"));
    setDunWaTemplateLanguage(str("finance.dunning.wa.template_language"));
    const bodyParamsRow = res.data.settings.find(
      (s) => s.key === "finance.dunning.wa.template_body_params",
    );
    const bodyParamsVal = bodyParamsRow?.value;
    setDunWaTemplateBodyParams(
      Array.isArray(bodyParamsVal)
        ? bodyParamsVal
            .filter((x): x is string => typeof x === "string")
            .join(", ")
        : "",
    );
    setDunWaVerifyToken(str("finance.dunning.wa.verify_token"));
    const dunSecretRow = res.data.settings.find(
      (s) => s.key === "finance.dunning.wa.app_secret",
    );
    setDunWaAppSecret("");
    setDunWaAppSecretSet(Boolean(dunSecretRow?.secretSet));
    const status = await fetchMailStatus();
    setMailStatus(status.ok ? status.data : null);
  }, [canCompanyWrite]);

  useEffect(() => {
    if (compartment === "envois" && canCompanyWrite) {
      void loadEnvois();
    }
  }, [compartment, loadEnvois, canCompanyWrite]);

  const loadGlMapping = useCallback(async () => {
    if (!canCompanyWrite) return;
    setGlError(null);
    const res = await fetchGlMapping();
    if (!res.ok) {
      setGlError(res.message);
      return;
    }
    setGlDraft({
      ...GL_MAPPING_DEFAULTS,
      ...res.data.codes,
      bankFee: res.data.codes.bankFee ?? "",
    });
  }, [canCompanyWrite]);

  useEffect(() => {
    if (compartment === "comptabilite" && canCompanyWrite) {
      void loadGlMapping();
    }
  }, [compartment, loadGlMapping, canCompanyWrite]);

  useEffect(() => {
    if (compartment !== "roles" || !canCompanyWrite) return;
    void (async () => {
      setRoleCapsError(null);
      const res = await fetchSettingsCapabilities();
      if (!res.ok) {
        setRoleCaps(null);
        setRoleCapsError(res.message);
        return;
      }
      setRoleCaps(res.data);
      setSelectedRole((prev) => prev || res.data.roles[0] || "");
    })();
  }, [compartment, canCompanyWrite]);

  useEffect(() => {
    if (compartment !== "ventes" || !canCompanyWrite) return;
    void (async () => {
      setVentesError(null);
      const res = await fetchEffectiveSettings();
      if (!res.ok) {
        setVentesError(res.message);
        return;
      }
      const bool = (key: string, fallback: boolean) => {
        const row = res.data.settings.find((s) => s.key === key);
        return typeof row?.value === "boolean" ? row.value : fallback;
      };
      const str = (key: string, fallback: string) => {
        const row = res.data.settings.find((s) => s.key === key);
        return typeof row?.value === "string" && row.value
          ? row.value
          : fallback;
      };
      const num = (key: string, fallback: string) => {
        const row = res.data.settings.find((s) => s.key === key);
        return typeof row?.value === "number" ? String(row.value) : fallback;
      };
      setSalesReserve(bool("sales.reserve_on_confirm", true));
      setSalesAutoConfirm(bool("sales.auto_confirm_on_create", false));
      setSalesRequireDate(bool("sales.require_requested_date", false));
      setSalesAllowManualPrice(bool("sales.allow_manual_price", true));
      setSalesDefaultCurrency(str("sales.default_currency", "TND"));
      setInvLotHour(num("inventory.daily_lot_gen.hour_tunis", "0"));
      setInvLotTz(str("inventory.daily_lot_gen.tz", "Africa/Tunis"));
    })();
  }, [compartment, canCompanyWrite]);

  useEffect(() => {
    if (compartment !== "finance" || !canCompanyWrite) return;
    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const row = res.data.settings.find(
        (s) => s.key === "finance.credit.enforce",
      );
      setCreditEnforce(typeof row?.value === "boolean" ? row.value : false);
    })();
  }, [compartment, canCompanyWrite]);

  async function onSaveVentes() {
    if (!canCompanyWrite || ventesBusy) return;
    setVentesBusy(true);
    setVentesMsg(null);
    setVentesError(null);
    const hour = Math.max(0, Math.min(23, Number(invLotHour) || 0));
    const puts: Array<{ key: string; value: unknown }> = [
      { key: "sales.reserve_on_confirm", value: salesReserve },
      { key: "sales.auto_confirm_on_create", value: salesAutoConfirm },
      { key: "sales.require_requested_date", value: salesRequireDate },
      { key: "sales.allow_manual_price", value: salesAllowManualPrice },
      {
        key: "sales.default_currency",
        value: salesDefaultCurrency.trim() || "TND",
      },
      { key: "inventory.daily_lot_gen.hour_tunis", value: hour },
      {
        key: "inventory.daily_lot_gen.tz",
        value: invLotTz.trim() || "Africa/Tunis",
      },
    ];
    for (const { key, value } of puts) {
      const r = await putCompanySetting(key, value);
      if (!r.ok) {
        setVentesError(`${key}: ${r.message}`);
        setVentesBusy(false);
        return;
      }
    }
    setVentesBusy(false);
    setVentesMsg("Ventes & stock enregistrés.");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  async function onSaveEnvois() {
    if (!canCompanyWrite) return;
    setEnvoisBusy(true);
    setEnvoisMsg(null);
    setEnvoisError(null);
    const puts: Array<{ key: string; value: unknown }> = [
      { key: "salubrita.outlook.from_email", value: outlookFrom.trim() },
      { key: "salubrita.whatsapp.default_prefix", value: waPrefix.trim() },
      {
        key: "identity.invite.ttl_days",
        value: Math.max(1, Number(inviteTtl) || 7),
      },
      {
        key: "identity.invite.min_password_length",
        value: Math.max(6, Number(inviteMinPwd) || 8),
      },
      { key: "identity.invite.auto_send", value: inviteAutoSend },
      { key: "identity.invite.email_subject", value: inviteSubject },
      { key: "identity.invite.email_body_text", value: inviteBodyText },
      { key: "identity.invite.email_body_html", value: inviteBodyHtml },
      {
        key: "identity.invite.web_origin",
        value: inviteWebOrigin.trim(),
      },
      { key: "identity.smtp.host", value: smtpHost.trim() },
      {
        key: "identity.smtp.port",
        value: Math.max(1, Number(smtpPort) || 587),
      },
      { key: "identity.smtp.secure", value: smtpSecure },
      { key: "identity.smtp.user", value: smtpUser.trim() },
      { key: "identity.smtp.pass", value: smtpPass },
      { key: "identity.smtp.from", value: smtpFrom.trim() },
      { key: "finance.dunning.smtp.host", value: dunSmtpHost.trim() },
      {
        key: "finance.dunning.smtp.port",
        value: Math.max(1, Number(dunSmtpPort) || 587),
      },
      { key: "finance.dunning.smtp.secure", value: dunSmtpSecure },
      { key: "finance.dunning.smtp.user", value: dunSmtpUser.trim() },
      { key: "finance.dunning.smtp.pass", value: dunSmtpPass },
      { key: "finance.dunning.smtp.from", value: dunSmtpFrom.trim() },
      {
        key: "finance.dunning.wa.phone_number_id",
        value: dunWaPhoneId.trim(),
      },
      { key: "finance.dunning.wa.access_token", value: dunWaToken },
      {
        key: "finance.dunning.wa.api_version",
        value: dunWaApiVersion.trim() || "v21.0",
      },
      {
        key: "finance.dunning.wa.template_name",
        value: dunWaTemplateName.trim(),
      },
      {
        key: "finance.dunning.wa.template_language",
        value: dunWaTemplateLanguage.trim(),
      },
      {
        key: "finance.dunning.wa.template_body_params",
        value: dunWaTemplateBodyParams
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      },
      {
        key: "finance.dunning.wa.verify_token",
        value: dunWaVerifyToken.trim(),
      },
      { key: "finance.dunning.wa.app_secret", value: dunWaAppSecret },
    ];
    for (const row of puts) {
      const r = await putCompanySetting(row.key, row.value);
      if (!r.ok) {
        setEnvoisBusy(false);
        setEnvoisError(`${row.key}: ${r.message}`);
        return;
      }
    }
    setEnvoisBusy(false);
    setEnvoisMsg("Envois enregistrés.");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
    void loadEnvois();
  }

  async function persistRoleSetting(key: string, value: unknown) {
    if (!roleCaps?.canWriteRole || !selectedRole || roleBusy) return;
    setRoleBusy(true);
    setRoleMsg(null);
    setRoleError(null);
    const r = await putRoleSetting(key, value, selectedRole);
    setRoleBusy(false);
    if (!r.ok) {
      setRoleError(r.message);
      return;
    }
    setRoleMsg("Override rôle enregistré.");
  }

  async function onMailTest() {
    if (!canCompanyWrite || mailTestBusy || envoisBusy) return;
    setMailTestBusy(true);
    setEnvoisMsg(null);
    setEnvoisError(null);
    const res = await postMailTest();
    setMailTestBusy(false);
    if (!res.ok) {
      setEnvoisError(res.message);
      return;
    }
    setEnvoisMsg(
      `Test envoyé à ${res.to}${res.from ? ` (from ${res.from})` : ""}.`,
    );
  }

  function applyDensity(next: Density) {
    setDensity(next);
    void putUserSetting("ui.density", next);
  }

  function onSseBannerChange(on: boolean) {
    setShowSseBanner(on);
  }

  async function onSaveGlMapping() {
    if (!canCompanyWrite || glBusy) return;
    setGlBusy(true);
    setGlMsg(null);
    setGlError(null);
    const pairs: [string, string][] = [
      [GL_MAPPING_KEYS.ar, glDraft.ar],
      [GL_MAPPING_KEYS.bank, glDraft.bank],
      [GL_MAPPING_KEYS.revenue, glDraft.revenue],
      [GL_MAPPING_KEYS.vat, glDraft.vat],
      [GL_MAPPING_KEYS.bankFee, glDraft.bankFee],
      [GL_MAPPING_KEYS.salesJournal, glDraft.salesJournal],
      [GL_MAPPING_KEYS.bankJournal, glDraft.bankJournal],
    ];
    for (const [key, value] of pairs) {
      const r = await putCompanySetting(key, value.trim());
      if (!r.ok) {
        setGlError(`${key}: ${r.message}`);
        setGlBusy(false);
        return;
      }
    }
    setGlBusy(false);
    setGlMsg("Mapping enregistré.");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function patchDraft(key: string, patch: Partial<ExpertDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? emptyDraft()), ...patch },
    }));
  }

  async function onSubmitSlot(row: ExpertiseSlot) {
    const draft = drafts[row.key] ?? emptyDraft();
    setBusyKey(row.key);
    setFormErrors((e) => {
      const next = { ...e };
      delete next[row.key];
      return next;
    });

    if (!draft.valueLabel.trim() || !draft.lawRef.trim()) {
      setBusyKey(null);
      setFormErrors((e) => ({
        ...e,
        [row.key]:
          "Libellé et référence légale obligatoires — laisser vide tant que l’expert n’a pas validé.",
      }));
      return;
    }
    if (!draft.expertValidatedAt) {
      setBusyKey(null);
      setFormErrors((e) => ({
        ...e,
        [row.key]: "Date de validation expert obligatoire.",
      }));
      return;
    }

    const rate = draft.rateBps.trim() ? Number(draft.rateBps) : undefined;
    const amount = draft.amountMilli.trim()
      ? Number(draft.amountMilli)
      : undefined;
    if (draft.rateBps.trim() && !Number.isFinite(rate)) {
      setBusyKey(null);
      setFormErrors((e) => ({
        ...e,
        [row.key]: "rateBps invalide (entier, ex. 100 = 1 %).",
      }));
      return;
    }
    if (draft.amountMilli.trim() && !Number.isFinite(amount)) {
      setBusyKey(null);
      setFormErrors((e) => ({
        ...e,
        [row.key]: "amountMilli invalide.",
      }));
      return;
    }

    const res = await upsertExpertise(row.key, {
      valueLabel: draft.valueLabel.trim(),
      lawRef: draft.lawRef.trim(),
      expertValidatedAt: new Date(draft.expertValidatedAt).toISOString(),
      rateBps: rate,
      amountMilli: amount,
      notes: draft.notes.trim() || undefined,
    });
    setBusyKey(null);
    if (!res.ok) {
      setFormErrors((e) => ({ ...e, [row.key]: res.message }));
      return;
    }
    await loadExpertise();
  }

  async function onSaveIrppBrackets() {
    setIrppBracketBusy(true);
    setIrppBracketError(null);
    const parsed: Array<{
      upToMilli: number | null;
      rateBps: number;
      lawRef?: string | null;
    }> = [];
    for (let i = 0; i < irppBracketDrafts.length; i++) {
      const row = irppBracketDrafts[i]!;
      const rateBps = Number(row.rateBps);
      if (!Number.isInteger(rateBps) || rateBps < 0) {
        setIrppBracketBusy(false);
        setIrppBracketError(`rateBps invalide (bande ${i + 1}).`);
        return;
      }
      const isLast = i === irppBracketDrafts.length - 1;
      const rawUp = row.upToMilli.trim();
      if (isLast) {
        if (rawUp) {
          setIrppBracketBusy(false);
          setIrppBracketError(
            "La dernière bande doit être ouverte (upToMilli vide).",
          );
          return;
        }
        parsed.push({
          upToMilli: null,
          rateBps,
          lawRef: row.lawRef.trim() || null,
        });
      } else {
        const upToMilli = Number(rawUp);
        if (!Number.isInteger(upToMilli) || upToMilli <= 0) {
          setIrppBracketBusy(false);
          setIrppBracketError(
            `upToMilli annuel (millimes) invalide (bande ${i + 1}).`,
          );
          return;
        }
        parsed.push({
          upToMilli,
          rateBps,
          lawRef: row.lawRef.trim() || null,
        });
      }
    }
    const res = await replaceIrppBrackets(parsed);
    setIrppBracketBusy(false);
    if (!res.ok) {
      setIrppBracketError(res.message);
      return;
    }
    setIrppBracketDrafts(
      res.data.items.map((b) => ({
        upToMilli: b.upToMilli == null ? "" : String(b.upToMilli),
        rateBps: String(b.rateBps),
        lawRef: b.lawRef ?? "",
      })),
    );
  }

  return (
    <>
      <AScreenHeader
        title="Préférences"
        description={
          canCompanyWrite
            ? "Rail compartiments Soft Glass (D203) — poste, société, modes ops, expertise, envois, finance, compta, ventes, rôles. Une préférence n’outrepasse jamais une permission."
            : "Rail compartiments Soft Glass (D203) — réglages de votre poste. Les compartiments société sont réservés à l’administrateur."
        }
        status={
          compartment === "envois" && canCompanyWrite && mailStatus ? (
            <ABadge
              tone={mailStatus.configured ? "success" : "neutral"}
              title={
                mailStatus.configured
                  ? [
                      mailStatus.host,
                      mailStatus.port != null ? `:${mailStatus.port}` : "",
                      mailStatus.from ? ` · ${mailStatus.from}` : "",
                      mailStatus.autoSend ? " · auto-send" : " · auto-send off",
                      ` · TTL ${mailStatus.ttlDays}j`,
                    ].join("")
                  : `SMTP off · mailto · TTL ${mailStatus.ttlDays}j`
              }
            >
              {mailStatus.configured
                ? `${mailStatus.from ? `SMTP · ${mailStatus.from}` : `SMTP · ${mailStatus.host}`}${
                    mailStatus.autoSend ? "" : " · manuel"
                  }`
                : "SMTP off · mailto"}
            </ABadge>
          ) : null
        }
        primary={
          compartment === "envois" && canCompanyWrite ? (
            <AButton
              type="button"
              size="sm"
              disabled={envoisBusy || mailTestBusy}
              onClick={() => void onSaveEnvois()}
            >
              {envoisBusy
                ? "…"
                : savedFlash
                  ? "Enregistré"
                  : LAYOUT_ACTIONS.save}
            </AButton>
          ) : null
        }
        more={
          compartment === "envois" && canCompanyWrite ? (
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              disabled={
                envoisBusy ||
                mailTestBusy ||
                mailStatus?.configured === false
              }
              title={
                mailStatus?.configured === false
                  ? "SMTP non configuré — renseignez l’hôte, Enregistrer, puis retestez"
                  : undefined
              }
              onClick={() => void onMailTest()}
            >
              {mailTestBusy ? "…" : "Tester l’envoi"}
            </AButton>
          ) : null
        }
      />
      <APageBody>
        {companyDeniedHint ? (
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Compartiments société réservés à l’administrateur.
          </p>
        ) : null}

        <div className="flex gap-6">
          <nav
            className="w-48 shrink-0 space-y-1"
            aria-label="Compartiments préférences"
          >
            {visibleCompartments.map((c) => {
              const active = compartment === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCompartment(c.id)}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                    active
                      ? "bg-a-orange-soft text-a-fg"
                      : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
                  }`}
                >
                  <span className="block text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    {c.label}
                  </span>
                  <span className="mt-0.5 block text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {c.subtitle}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            {compartment === "poste" ? (
              <section className={`${softPanel} max-w-xl`}>
                <div>
                  <p className="text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Thème
                  </p>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Dark et light sont tous deux de première classe — switch dans
                    le header (même contrôle que le shell).
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Densité
                  </p>
                  <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Compact resserre uniquement les lignes de tableaux — le chrome
                    (header, sidebar, titres) ne bouge pas. Persisté via{" "}
                    <span className="a-mono">ui.density</span>.
                  </p>
                  <div className="flex gap-2">
                    <AButton
                      type="button"
                      size="sm"
                      variant={
                        density === "comfortable" ? "primary" : "secondary"
                      }
                      onClick={() => applyDensity("comfortable")}
                    >
                      Confortable
                    </AButton>
                    <AButton
                      type="button"
                      size="sm"
                      variant={density === "compact" ? "primary" : "secondary"}
                      onClick={() => applyDensity("compact")}
                    >
                      Compact
                    </AButton>
                    <AButton
                      type="button"
                      size="sm"
                      variant={density === "spacious" ? "primary" : "secondary"}
                      onClick={() => applyDensity("spacious")}
                    >
                      Spacieux
                    </AButton>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Surface Soft Glass
                  </p>
                  <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Matériau glass (lock 10B) — aussi dans le Smart Action Dock.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "ghost",
                        "patch",
                        "solid",
                        "minimal",
                      ] as const satisfies readonly SurfaceMode[]
                    ).map((id) => (
                      <AButton
                        key={id}
                        type="button"
                        size="sm"
                        variant={surfaceMode === id ? "primary" : "secondary"}
                        onClick={() => setSurfaceMode(id)}
                      >
                        {SURFACE_LABELS[id]}
                      </AButton>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Sidebar — auto-réduction
                  </p>
                  <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Réduit le menu latéral après N secondes sans survol. 0 =
                    désactivé (bouton panneau uniquement). Défaut : 10 s.
                  </p>
                  <PrefsToggleRow
                    title="Auto-réduction"
                    description="Active le repli automatique de la sidebar."
                    checked={sidebarAutoCollapseSec > 0}
                    onCheckedChange={(on) =>
                      setSidebarAutoCollapseSec(on ? 10 : 0)
                    }
                  />
                  {sidebarAutoCollapseSec > 0 ? (
                    <label className="mt-2 flex items-center gap-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
                      <span>Délai</span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={sidebarAutoCollapseSec}
                        onChange={(e) =>
                          setSidebarAutoCollapseSec(
                            Number.parseInt(e.target.value || "10", 10),
                          )
                        }
                        className="a-mono w-16 rounded-lg bg-a-surface-3 px-2 py-1.5 text-[13px] text-a-fg outline-none focus:ring-2 focus:ring-a-accent/30"
                      />
                      <span>s</span>
                    </label>
                  ) : null}
                </div>
                <PrefsToggleRow
                  title="Alertes jobs"
                  description="Afficher shed P4 / files Thunder dans le centre d’activité."
                  checked={jobAlerts}
                  onCheckedChange={setJobAlerts}
                />
                <PrefsToggleRow
                  title="Bannière SSE"
                  description="Afficher « flux temps réel coupé » quand le stream est coupé."
                  checked={showSseBanner}
                  onCheckedChange={onSseBannerChange}
                />
              </section>
            ) : null}

            {compartment === "societe" ? (
              <section className={`${softPanel} max-w-xl`}>
                <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
                  Contexte
                </h2>
                <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-[length:var(--a-text-sm)]">
                  <dt className="text-a-fg-muted">Société</dt>
                  <dd>Fromagerie ADV</dd>
                  <dt className="text-a-fg-muted">Site</dt>
                  <dd>Sfax</dd>
                  <dt className="text-a-fg-muted">Fuseau</dt>
                  <dd className="a-mono">Africa/Tunis</dd>
                  <dt className="text-a-fg-muted">Devise</dt>
                  <dd className="a-mono">TND</dd>
                </dl>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Langue UI = Phase 2 (C14). Pas de globe ici.
                </p>
              </section>
            ) : null}

            {compartment === "modes" && canCompanyWrite ? (
              <PrefsModesOpsPanel
                unlockDraft={unlockDraft}
                setUnlockDraft={setUnlockDraft}
                unlockBusy={unlockBusy}
                unlockMsg={unlockMsg}
                unlockError={unlockError}
                onSaveUnlockCode={() => void onSaveUnlockCode()}
              />
            ) : null}

            {compartment === "finance" && canCompanyWrite ? (
              <section className={`${softPanel} max-w-xl space-y-6`}>
                <div>
                  <h2 className="mb-2 text-[length:var(--a-text-md)] font-medium text-a-orange">
                    Recouvrement — jalons J+n
                  </h2>
                  <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Jours après échéance pour signal FIN-INTEL (ex. 1,7,15,30).
                    Vide = tout retard. Pas de taux fiscaux. Relances SMTP/WA =
                    compartiment Envois.
                  </p>
                  <CollectionRemindDaysEditor canWrite={canCompanyWrite} />
                </div>
                <div>
                  <h2 className="mb-2 text-[length:var(--a-text-md)] font-medium text-a-orange">
                    Crédit — seuil pression
                  </h2>
                  <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Ratio encours / plafond pour signal Thunder (défaut 0,80).
                    Dépassement = 100 %. Pas un barème fiscal.
                  </p>
                  <CreditWarnRatioEditor canWrite={canCompanyWrite} />
                </div>
                <div>
                  <h2 className="mb-1 text-[length:var(--a-text-md)] font-medium text-a-orange">
                    Crédit — blocage commandes
                  </h2>
                  <PrefsToggleRow
                    title="Appliquer la limite de crédit"
                    description="Si actif, refuse la confirmation de commande quand encours + commande dépasse le plafond client (finance.credit.enforce)."
                    checked={creditEnforce}
                    onCheckedChange={(on) => {
                      setCreditEnforce(on);
                      void putCompanySetting("finance.credit.enforce", on);
                    }}
                  />
                </div>
              </section>
            ) : null}

            {compartment === "comptabilite" && canCompanyWrite ? (
              <section className={`${softPanel} max-w-xl`}>
                <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
                  Mapping Finance→GL
                </h2>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Comptes et journaux pour le pont Finance → comptabilité.
                  bank_fee vide jusqu’à saisie humaine.
                </p>
                {glError ? (
                  <AErrorState
                    message={glError}
                    retryable
                    onRetry={() => void loadGlMapping()}
                  />
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["ar", "Clients (AR)", GL_MAPPING_KEYS.ar],
                      ["bank", "Banque", GL_MAPPING_KEYS.bank],
                      ["revenue", "Produits", GL_MAPPING_KEYS.revenue],
                      ["vat", "TVA", GL_MAPPING_KEYS.vat],
                      ["bankFee", "Frais bancaires", GL_MAPPING_KEYS.bankFee],
                      [
                        "salesJournal",
                        "Journal ventes",
                        GL_MAPPING_KEYS.salesJournal,
                      ],
                      [
                        "bankJournal",
                        "Journal banque",
                        GL_MAPPING_KEYS.bankJournal,
                      ],
                    ] as const
                  ).map(([field, label, key]) => (
                    <label key={field} className="block space-y-1">
                      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        {label}{" "}
                        <span className="a-mono text-a-fg-subtle">{key}</span>
                      </span>
                      <AInput
                        value={glDraft[field]}
                        onChange={(e) =>
                          setGlDraft((d) => ({
                            ...d,
                            [field]: e.target.value,
                          }))
                        }
                        className="a-mono"
                        placeholder={
                          field === "bankFee" ? "Vide jusqu’à saisie" : undefined
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AButton
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={glBusy}
                    onClick={() => void onSaveGlMapping()}
                  >
                    {glBusy ? "…" : savedFlash ? "Enregistré" : "Enregistrer"}
                  </AButton>
                  {glMsg ? (
                    <p className="text-[length:var(--a-text-xs)] text-a-success">
                      {glMsg}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {compartment === "ventes" && canCompanyWrite ? (
              <section className={`${softPanel} max-w-xl space-y-6`}>
                <div>
                  <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
                    Ventes
                  </h2>
                  <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Paramètres opérationnels déjà consommés par le module
                    Ventes. Aucun taux fiscal inventé ici.
                  </p>
                  <PrefsToggleRow
                    title="Réserver le stock à la confirmation"
                    description="À la confirmation commande, réserve automatiquement le stock (sales.reserve_on_confirm)."
                    checked={salesReserve}
                    onCheckedChange={setSalesReserve}
                  />
                  <PrefsToggleRow
                    title="Auto-confirmer à la création"
                    description="Après création d’un brouillon, enchaîne confirm+réserve (sales.auto_confirm_on_create)."
                    checked={salesAutoConfirm}
                    onCheckedChange={setSalesAutoConfirm}
                  />
                  <PrefsToggleRow
                    title="Date de livraison demandée obligatoire"
                    description="Refuse la prise de commande sans date demandée (sales.require_requested_date)."
                    checked={salesRequireDate}
                    onCheckedChange={setSalesRequireDate}
                  />
                  <PrefsToggleRow
                    title="Prix unitaire manuel autorisé"
                    description="Autorise la saisie manuelle du prix ligne (V0 sans moteur tarifaire)."
                    checked={salesAllowManualPrice}
                    onCheckedChange={setSalesAllowManualPrice}
                  />
                  <label className="mt-3 block space-y-1">
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Devise par défaut{" "}
                      <span className="a-mono">sales.default_currency</span>
                    </span>
                    <AInput
                      value={salesDefaultCurrency}
                      onChange={(e) => setSalesDefaultCurrency(e.target.value)}
                      className="a-mono max-w-[8rem]"
                      placeholder="TND"
                    />
                  </label>
                </div>
                <div>
                  <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
                    Stock — lots journaliers
                  </h2>
                  <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Heure de génération des lots fromage (scheduler D100). Fuseau
                    = Africa/Tunis par défaut.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        Heure (0–23)
                      </span>
                      <AInput
                        type="number"
                        min={0}
                        max={23}
                        value={invLotHour}
                        onChange={(e) => setInvLotHour(e.target.value)}
                        className="a-mono"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        Fuseau
                      </span>
                      <AInput
                        value={invLotTz}
                        onChange={(e) => setInvLotTz(e.target.value)}
                        className="a-mono"
                      />
                    </label>
                  </div>
                </div>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Mapping GL ventes = compartiment Comptabilité (
                  <span className="a-mono">accounting.gl.sales_journal</span>
                  ).
                </p>
                {ventesError ? (
                  <AErrorState message={ventesError} />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <AButton
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={ventesBusy}
                    onClick={() => void onSaveVentes()}
                  >
                    {ventesBusy
                      ? "…"
                      : savedFlash
                        ? "Enregistré"
                        : "Enregistrer"}
                  </AButton>
                  {ventesMsg ? (
                    <p className="text-[length:var(--a-text-xs)] text-a-success">
                      {ventesMsg}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {compartment === "roles" && canCompanyWrite ? (
              <section className={`${softPanel} max-w-xl`}>
                <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
                  Overrides par rôle
                </h2>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Admin société peut écrire (settings.company.write). Priorité
                  effective : USER &gt; ROLE &gt; COMPANY. Ne remplace jamais une
                  permission IAM.
                </p>
                {roleCapsError ? (
                  <AErrorState message={roleCapsError} />
                ) : null}
                {!roleCaps ? (
                  <ASkeleton className="h-24 w-full" />
                ) : !roleCaps.canWriteRole ? (
                  <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Écriture réservée aux Admins (permission société).
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="block space-y-1">
                      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        Rôle
                      </span>
                      <select
                        className={softSelect}
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                      >
                        {roleCaps.roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PrefsToggleRow
                      title="GHOST — masquer livraison (BL)"
                      description="Override rôle pour ops.ghost.hide_delivery."
                      checked={roleGhostHideDelivery}
                      disabled={!selectedRole || roleBusy}
                      onCheckedChange={(on) => {
                        setRoleGhostHideDelivery(on);
                        void persistRoleSetting(
                          OPS_VISIBILITY_KEYS.ghostHideDelivery,
                          on,
                        );
                      }}
                    />
                    <PrefsToggleRow
                      title="PATCH — masquer livraison (BL)"
                      description="Override rôle pour ops.patch.hide_delivery."
                      checked={rolePatchHideDelivery}
                      disabled={!selectedRole || roleBusy}
                      onCheckedChange={(on) => {
                        setRolePatchHideDelivery(on);
                        void persistRoleSetting(
                          OPS_VISIBILITY_KEYS.patchHideDelivery,
                          on,
                        );
                      }}
                    />
                    <PrefsToggleRow
                      title="GHOST — compta partielle"
                      description="Override rôle : plan comptable seul (écritures / balance masqués)."
                      checked={roleGhostAccountingPartial}
                      disabled={!selectedRole || roleBusy}
                      onCheckedChange={(on) => {
                        setRoleGhostAccountingPartial(on);
                        void persistRoleSetting(
                          OPS_VISIBILITY_KEYS.ghostAccountingPartial,
                          on,
                        );
                      }}
                    />
                    <label className="block space-y-2 pt-2">
                      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        Intensité PATCH comptable —{" "}
                        <span className="a-mono">{rolePatchIntensity}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={rolePatchIntensity}
                        disabled={!selectedRole || roleBusy}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setRolePatchIntensity(n);
                          void persistRoleSetting(
                            OPS_VISIBILITY_KEYS.patchAccountingIntensity,
                            n,
                          );
                        }}
                        className="w-full accent-[var(--a-accent)]"
                      />
                    </label>
                    {roleMsg ? (
                      <p className="text-[length:var(--a-text-xs)] text-a-success">
                        {roleMsg}
                      </p>
                    ) : null}
                    {roleError ? (
                      <p className="text-[length:var(--a-text-xs)] text-a-danger">
                        {roleError}
                      </p>
                    ) : null}
                  </div>
                )}
              </section>
            ) : null}

            {compartment === "expertise" && canCompanyWrite ? (
              <section className="space-y-5">
                <p className="max-w-2xl text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Formulaire expert — champs{" "}
                  <span className="font-medium text-a-fg">vides par défaut</span>.
                  Aucun taux n’est inventé ni seedé. Saisie humaine uniquement ici
                  (Préférences) ; les modules ne consomment qu’après « Valider ».
                </p>
                {expertise.kind === "loading" ? (
                  <ASkeleton className="h-48 w-full max-w-3xl" />
                ) : null}
                {expertise.kind === "forbidden" ? (
                  <AForbiddenState message={expertise.message} />
                ) : null}
                {expertise.kind === "error" ? (
                  <AErrorState
                    message={expertise.message}
                    retryable
                    onRetry={() => void loadExpertise()}
                  />
                ) : null}
                {expertise.kind === "ok" && expertise.items.length === 0 ? (
                  <AEmptyState
                    title="Aucun slot d’expertise"
                    description="Le catalogue n’est pas initialisé."
                  />
                ) : null}

                {expertise.kind === "ok"
                  ? expertise.items.map((row) => {
                      if (!row.writable) {
                        return (
                          <div
                            key={row.key}
                            className="rounded-[var(--a-radius-lg)] bg-a-surface-2 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-[length:var(--a-text-md)] font-medium">
                                    {row.label}
                                  </h3>
                                  <ABadge tone={statusTone(row.status)}>
                                    {statusLabel(row.status)}
                                  </ABadge>
                                </div>
                                <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                                  {row.description}
                                </p>
                                {row.valueSummary ? (
                                  <p className="a-mono mt-2 text-[length:var(--a-text-sm)]">
                                    {row.valueSummary}
                                    {row.lawRef ? ` · ${row.lawRef}` : ""}
                                  </p>
                                ) : null}
                              </div>
                              {row.manageHref ? (
                                <Link
                                  href={row.manageHref}
                                  className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                                >
                                  Ouvrir catalogue TVA
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      const draft = drafts[row.key] ?? emptyDraft();
                      const err = formErrors[row.key];
                      const canSubmit =
                        Boolean(draft.valueLabel.trim()) &&
                        Boolean(draft.lawRef.trim()) &&
                        Boolean(draft.expertValidatedAt);

                      return (
                        <div
                          key={row.key}
                          className="space-y-4 rounded-[var(--a-radius-lg)] bg-a-surface-2 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[length:var(--a-text-md)] font-medium">
                                  {row.label}
                                </h3>
                                <ABadge tone={statusTone(row.status)}>
                                  {statusLabel(row.status)}
                                </ABadge>
                                <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                                  {row.key}
                                </span>
                              </div>
                              <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                                {row.description}
                              </p>
                            </div>
                          </div>

                          {err ? (
                            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
                              {err}
                            </p>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-1 sm:col-span-2">
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Libellé valeur
                              </span>
                              <AInput
                                value={draft.valueLabel}
                                onChange={(e) =>
                                  patchDraft(row.key, {
                                    valueLabel: e.target.value,
                                  })
                                }
                                placeholder="Vide — à saisir avec l’expert"
                              />
                            </label>
                            <label className="block space-y-1 sm:col-span-2">
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Référence légale
                              </span>
                              <AInput
                                value={draft.lawRef}
                                onChange={(e) =>
                                  patchDraft(row.key, {
                                    lawRef: e.target.value,
                                  })
                                }
                                placeholder="Vide — réf. expert / LF / note"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Date validation expert
                              </span>
                              <AInput
                                type="date"
                                value={draft.expertValidatedAt}
                                onChange={(e) =>
                                  patchDraft(row.key, {
                                    expertValidatedAt: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Taux bps (optionnel, 100 = 1 %)
                              </span>
                              <AInput
                                value={draft.rateBps}
                                onChange={(e) =>
                                  patchDraft(row.key, {
                                    rateBps: e.target.value,
                                  })
                                }
                                placeholder="Vide"
                                className="a-mono"
                                disabled={
                                  row.key === "hr.irpp" ||
                                  row.key.startsWith("hr.irpp.abat.")
                                }
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Millimes (plafond / abattement annuel)
                              </span>
                              <AInput
                                value={draft.amountMilli}
                                onChange={(e) =>
                                  patchDraft(row.key, {
                                    amountMilli: e.target.value,
                                  })
                                }
                                placeholder="Vide"
                                className="a-mono"
                                disabled={
                                  row.key === "hr.irpp" ||
                                  row.key === "hr.tfp" ||
                                  row.key === "hr.foprolos"
                                }
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Notes
                              </span>
                              <AInput
                                value={draft.notes}
                                onChange={(e) =>
                                  patchDraft(row.key, {
                                    notes: e.target.value,
                                  })
                                }
                                placeholder="Vide"
                              />
                            </label>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <AButton
                              type="button"
                              disabled={busyKey === row.key || !canSubmit}
                              onClick={() => void onSubmitSlot(row)}
                            >
                              {row.status === "VALIDATED"
                                ? "Mettre à jour"
                                : "Valider expertise"}
                            </AButton>
                            {!canSubmit ? (
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                                Bouton actif seulement quand libellé + réf. + date
                                sont renseignés.
                              </span>
                            ) : null}
                          </div>

                          {row.key === "hr.irpp" ? (
                            <div className="space-y-3 border-t border-transparent pt-3">
                              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Tranches annuelles (upToMilli = plafond en
                                millimes). Dernière bande ouverte (plafond vide).
                                Méthode calcul : annuel ÷ 12. Jamais prérempli.
                              </p>
                              {irppBracketError ? (
                                <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
                                  {irppBracketError}
                                </p>
                              ) : null}
                              {irppBracketDrafts.map((band, idx) => (
                                <div
                                  key={`irpp-band-${idx}`}
                                  className="grid gap-2 sm:grid-cols-3"
                                >
                                  <label className="block space-y-1">
                                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                      upToMilli{" "}
                                      {idx === irppBracketDrafts.length - 1
                                        ? "(vide = ouvert)"
                                        : "(annuel)"}
                                    </span>
                                    <AInput
                                      value={band.upToMilli}
                                      onChange={(e) => {
                                        const next = [...irppBracketDrafts];
                                        next[idx] = {
                                          ...band,
                                          upToMilli: e.target.value,
                                        };
                                        setIrppBracketDrafts(next);
                                      }}
                                      placeholder={
                                        idx === irppBracketDrafts.length - 1
                                          ? "Ouvert"
                                          : "ex. 5000000"
                                      }
                                      className="a-mono"
                                      disabled={
                                        idx === irppBracketDrafts.length - 1
                                      }
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                      rateBps
                                    </span>
                                    <AInput
                                      value={band.rateBps}
                                      onChange={(e) => {
                                        const next = [...irppBracketDrafts];
                                        next[idx] = {
                                          ...band,
                                          rateBps: e.target.value,
                                        };
                                        setIrppBracketDrafts(next);
                                      }}
                                      className="a-mono"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                      lawRef bande
                                    </span>
                                    <AInput
                                      value={band.lawRef}
                                      onChange={(e) => {
                                        const next = [...irppBracketDrafts];
                                        next[idx] = {
                                          ...band,
                                          lawRef: e.target.value,
                                        };
                                        setIrppBracketDrafts(next);
                                      }}
                                      placeholder="Vide"
                                    />
                                  </label>
                                </div>
                              ))}
                              <div className="flex flex-wrap gap-2">
                                <AButton
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setIrppBracketDrafts((rows) => {
                                      const copy = [...rows];
                                      const last = copy.pop() ?? {
                                        upToMilli: "",
                                        rateBps: "0",
                                        lawRef: "",
                                      };
                                      return [
                                        ...copy,
                                        {
                                          upToMilli: "",
                                          rateBps: "0",
                                          lawRef: "",
                                        },
                                        last,
                                      ];
                                    })
                                  }
                                >
                                  + bande
                                </AButton>
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={irppBracketDrafts.length <= 1}
                                  onClick={() =>
                                    setIrppBracketDrafts((rows) => {
                                      if (rows.length <= 1) return rows;
                                      const copy = [...rows];
                                      copy.splice(copy.length - 2, 1);
                                      return copy;
                                    })
                                  }
                                >
                                  − bande
                                </AButton>
                                <AButton
                                  type="button"
                                  disabled={irppBracketBusy}
                                  onClick={() => void onSaveIrppBrackets()}
                                >
                                  Enregistrer barème
                                </AButton>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : null}
              </section>
            ) : null}

            {compartment === "envois" && canCompanyWrite ? (
              <section className="max-w-2xl space-y-5">
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Tous les paramètres d’envoi société (salubrité, invitations,
                  SMTP). Rien en dur côté produit — les défauts catalogue
                  s’appliquent tant que les champs ne sont pas surchargés.
                  Placeholders invite :{" "}
                  <span className="a-mono text-a-fg">
                    {"{{displayName}} {{inviteUrl}} {{ttlDays}} {{email}}"}
                  </span>
                  .
                </p>
                {envoisError ? (
                  <AErrorState
                    message={envoisError}
                    retryable
                    onRetry={() => void loadEnvois()}
                  />
                ) : null}

                <div className="space-y-4 a-underlay rounded-md p-4">
                  <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Salubrité
                  </h2>
                  <div className="space-y-1">
                    <label
                      htmlFor="salubrita-outlook-from"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      Outlook — expéditeur (from)
                    </label>
                    <AInput
                      id="salubrita-outlook-from"
                      type="email"
                      value={outlookFrom}
                      onChange={(e) => setOutlookFrom(e.target.value)}
                      placeholder="ex. qualite@entreprise.tn"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="salubrita-wa-prefix"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      WhatsApp — préfixe pays
                    </label>
                    <AInput
                      id="salubrita-wa-prefix"
                      value={waPrefix}
                      onChange={(e) => setWaPrefix(e.target.value)}
                      placeholder="ex. 216"
                      className="a-mono"
                    />
                  </div>
                </div>

                <div className="space-y-4 a-underlay rounded-md p-4">
                  <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Invitations
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="invite-ttl"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Durée du lien (jours)
                      </label>
                      <AInput
                        id="invite-ttl"
                        type="number"
                        min={1}
                        value={inviteTtl}
                        onChange={(e) => setInviteTtl(e.target.value)}
                        className="a-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="invite-min-pwd"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        MDP min. (caractères)
                      </label>
                      <AInput
                        id="invite-min-pwd"
                        type="number"
                        min={6}
                        value={inviteMinPwd}
                        onChange={(e) => setInviteMinPwd(e.target.value)}
                        className="a-mono"
                      />
                    </div>
                  </div>
                  <PrefsToggleRow
                    title="Envoi SMTP automatique"
                    description="Si SMTP configuré — sinon Copier / Outlook."
                    checked={inviteAutoSend}
                    onCheckedChange={setInviteAutoSend}
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="invite-web-origin"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      URL publique (liens invite)
                    </label>
                    <AInput
                      id="invite-web-origin"
                      value={inviteWebOrigin}
                      onChange={(e) => setInviteWebOrigin(e.target.value)}
                      placeholder="vide = AUTHORITY_WEB_ORIGIN / localhost:3000"
                      className="a-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="invite-subject"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      Objet e-mail
                    </label>
                    <AInput
                      id="invite-subject"
                      value={inviteSubject}
                      onChange={(e) => setInviteSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="invite-body-text"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      Corps texte
                    </label>
                    <textarea
                      id="invite-body-text"
                      value={inviteBodyText}
                      onChange={(e) => setInviteBodyText(e.target.value)}
                      rows={6}
                      className="w-full rounded-[10px] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="invite-body-html"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      Corps HTML
                    </label>
                    <textarea
                      id="invite-body-html"
                      value={inviteBodyHtml}
                      onChange={(e) => setInviteBodyHtml(e.target.value)}
                      rows={5}
                      className="a-mono w-full rounded-[10px] bg-a-surface-3 px-3 py-2 text-[12px] text-a-fg outline-none ring-a-accent focus:ring-2"
                    />
                  </div>
                </div>

                <div className="space-y-4 a-underlay rounded-md p-4">
                  <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    SMTP société
                  </h2>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    Hôte vide → fallback variables d’environnement SMTP_* du
                    serveur.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="smtp-host"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Hôte
                      </label>
                      <AInput
                        id="smtp-host"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.exemple.tn"
                        className="a-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="smtp-port"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Port
                      </label>
                      <AInput
                        id="smtp-port"
                        type="number"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="a-mono"
                      />
                    </div>
                    <PrefsToggleRow
                      title="Secure (port 465)"
                      description="Active TLS implicite SMTP (identity.smtp.secure)."
                      checked={smtpSecure}
                      onCheckedChange={setSmtpSecure}
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="smtp-user"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Utilisateur
                      </label>
                      <AInput
                        id="smtp-user"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="a-mono"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="smtp-pass"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Mot de passe
                      </label>
                      <AInput
                        id="smtp-pass"
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        autoComplete="new-password"
                        placeholder={
                          smtpPassSet
                            ? "•••• enregistré — laisser vide pour conserver"
                            : "saisir le mot de passe SMTP"
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="smtp-from"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        From
                      </label>
                      <AInput
                        id="smtp-from"
                        value={smtpFrom}
                        onChange={(e) => setSmtpFrom(e.target.value)}
                        placeholder="AUTHORITY &lt;noreply@entreprise.tn&gt;"
                      />
                    </div>
                  </div>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    « Tester l’envoi » utilise la config enregistrée (Enregistrer
                    d’abord) et envoie un message à votre compte admin.
                  </p>
                </div>

                <div className="space-y-4 a-underlay rounded-md p-4">
                  <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-orange">
                    Relances finance (SMTP dédié + WA Cloud)
                  </h2>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    Séparé du SMTP invitations. Vide jusqu’à saisie humaine —
                    secrets write-only. Thunder n’envoie pas automatiquement.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-smtp-host"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        SMTP relances — hôte
                      </label>
                      <AInput
                        id="dun-smtp-host"
                        value={dunSmtpHost}
                        onChange={(e) => setDunSmtpHost(e.target.value)}
                        className="a-mono"
                        placeholder="smtp.relances.tn"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-smtp-port"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Port
                      </label>
                      <AInput
                        id="dun-smtp-port"
                        type="number"
                        value={dunSmtpPort}
                        onChange={(e) => setDunSmtpPort(e.target.value)}
                        className="a-mono"
                      />
                    </div>
                    <PrefsToggleRow
                      title="Secure (port 465)"
                      description="TLS implicite pour le SMTP de relances finance."
                      checked={dunSmtpSecure}
                      onCheckedChange={setDunSmtpSecure}
                    />
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-smtp-user"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Utilisateur
                      </label>
                      <AInput
                        id="dun-smtp-user"
                        value={dunSmtpUser}
                        onChange={(e) => setDunSmtpUser(e.target.value)}
                        className="a-mono"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-smtp-pass"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Mot de passe
                      </label>
                      <AInput
                        id="dun-smtp-pass"
                        type="password"
                        value={dunSmtpPass}
                        onChange={(e) => setDunSmtpPass(e.target.value)}
                        autoComplete="new-password"
                        placeholder={
                          dunSmtpPassSet
                            ? "•••• enregistré — laisser vide pour conserver"
                            : "saisir le mot de passe"
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="dun-smtp-from"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        From
                      </label>
                      <AInput
                        id="dun-smtp-from"
                        value={dunSmtpFrom}
                        onChange={(e) => setDunSmtpFrom(e.target.value)}
                        placeholder="Relances &lt;relances@entreprise.tn&gt;"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-wa-phone"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        WA Cloud — phone number id
                      </label>
                      <AInput
                        id="dun-wa-phone"
                        value={dunWaPhoneId}
                        onChange={(e) => setDunWaPhoneId(e.target.value)}
                        className="a-mono"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-wa-version"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        API version
                      </label>
                      <AInput
                        id="dun-wa-version"
                        value={dunWaApiVersion}
                        onChange={(e) => setDunWaApiVersion(e.target.value)}
                        className="a-mono"
                        placeholder="v21.0"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="dun-wa-token"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Access token
                      </label>
                      <AInput
                        id="dun-wa-token"
                        type="password"
                        value={dunWaToken}
                        onChange={(e) => setDunWaToken(e.target.value)}
                        autoComplete="new-password"
                        placeholder={
                          dunWaTokenSet
                            ? "•••• enregistré — laisser vide pour conserver"
                            : "saisir le token Cloud API"
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-wa-tpl-name"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Template Meta (nom)
                      </label>
                      <AInput
                        id="dun-wa-tpl-name"
                        value={dunWaTemplateName}
                        onChange={(e) => setDunWaTemplateName(e.target.value)}
                        className="a-mono"
                        placeholder="nom approuvé Meta — vide jusqu’à saisie"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-wa-tpl-lang"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Langue template
                      </label>
                      <AInput
                        id="dun-wa-tpl-lang"
                        value={dunWaTemplateLanguage}
                        onChange={(e) =>
                          setDunWaTemplateLanguage(e.target.value)
                        }
                        className="a-mono"
                        placeholder="fr"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="dun-wa-tpl-params"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Variables body {"{{n}}"} (ordre)
                      </label>
                      <AInput
                        id="dun-wa-tpl-params"
                        value={dunWaTemplateBodyParams}
                        onChange={(e) =>
                          setDunWaTemplateBodyParams(e.target.value)
                        }
                        className="a-mono"
                        placeholder="customer_name, open_item_number, amount_open, currency"
                        autoComplete="off"
                      />
                      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        Clés : customer_name · open_item_number · amount_open ·
                        currency · due_date · days_past_due · subject · body —
                        vides jusqu’à saisie humaine ; envoi template Meta
                        uniquement (pas texte libre).
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                        Webhook Meta :{" "}
                        <span className="a-mono">
                          /api/v1/webhooks/whatsapp/&#123;companyId&#125;
                        </span>{" "}
                        — GET verify_token · POST HMAC app_secret. Vide jusqu’à
                        saisie. Thunder n’ingère pas.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-wa-verify"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        Webhook verify token
                      </label>
                      <AInput
                        id="dun-wa-verify"
                        value={dunWaVerifyToken}
                        onChange={(e) => setDunWaVerifyToken(e.target.value)}
                        className="a-mono"
                        placeholder="jeton handshake Meta — vide jusqu’à saisie"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dun-wa-app-secret"
                        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                      >
                        App secret (HMAC)
                      </label>
                      <AInput
                        id="dun-wa-app-secret"
                        type="password"
                        value={dunWaAppSecret}
                        onChange={(e) => setDunWaAppSecret(e.target.value)}
                        autoComplete="new-password"
                        placeholder={
                          dunWaAppSecretSet
                            ? "•••• enregistré — laisser vide pour conserver"
                            : "saisir l’app secret Meta"
                        }
                      />
                    </div>
                  </div>
                </div>

                {envoisMsg ? (
                  <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    {envoisMsg}
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </APageBody>
    </>
  );
}

function CollectionRemindDaysEditor({ canWrite }: { canWrite: boolean }) {
  const [draft, setDraft] = useState("1,7,15,30");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!canWrite) return;
    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const row = res.data.settings.find(
        (s) => s.key === "finance.collection.remind_days",
      );
      if (Array.isArray(row?.value)) {
        setDraft(row.value.map(String).join(","));
      }
    })();
  }, [canWrite]);

  async function onSave() {
    if (!canWrite || busy) return;
    const days = draft
      .split(/[,;\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .map((n) => Math.trunc(n));
    const unique = [...new Set(days)].sort((a, b) => a - b);
    setBusy(true);
    setMsg(null);
    setErr(null);
    const r = await putCompanySetting(
      "finance.collection.remind_days",
      unique,
    );
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setDraft(unique.join(","));
    setMsg("Jalons enregistrés.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="a-mono h-9 w-56 rounded-xl bg-a-surface-3 px-3 text-[length:var(--a-text-sm)] text-a-fg outline-none focus:ring-2 focus:ring-a-accent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="1,7,15,30"
          aria-label="Jalons jours de retard"
        />
        <AButton
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => void onSave()}
        >
          {busy ? "…" : "Enregistrer"}
        </AButton>
      </div>
      {msg ? (
        <p className="text-[length:var(--a-text-xs)] text-a-success">{msg}</p>
      ) : null}
      {err ? (
        <p className="text-[length:var(--a-text-xs)] text-a-danger">{err}</p>
      ) : null}
    </div>
  );
}

function CreditWarnRatioEditor({ canWrite }: { canWrite: boolean }) {
  const [draft, setDraft] = useState("0.80");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!canWrite) return;
    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const row = res.data.settings.find(
        (s) => s.key === "finance.credit.warn_ratio",
      );
      if (typeof row?.value === "number") {
        setDraft(row.value.toFixed(2));
      }
    })();
  }, [canWrite]);

  async function onSave() {
    if (!canWrite || busy) return;
    const n = Number(draft.replace(",", "."));
    if (!Number.isFinite(n) || n < 0.05 || n > 1) {
      setErr("Ratio entre 0,05 et 1,00.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    const r = await putCompanySetting("finance.credit.warn_ratio", n);
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setDraft(n.toFixed(2));
    setMsg("Seuil enregistré.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="a-mono h-9 w-28 rounded-xl bg-a-surface-3 px-3 text-[length:var(--a-text-sm)] text-a-fg outline-none focus:ring-2 focus:ring-a-accent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="0.80"
          aria-label="Seuil pression crédit"
        />
        <AButton
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => void onSave()}
        >
          {busy ? "…" : "Enregistrer"}
        </AButton>
      </div>
      {msg ? (
        <p className="text-[length:var(--a-text-xs)] text-a-success">{msg}</p>
      ) : null}
      {err ? (
        <p className="text-[length:var(--a-text-xs)] text-a-danger">{err}</p>
      ) : null}
    </div>
  );
}
