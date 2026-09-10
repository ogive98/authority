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
  AScreenHeader,
  ASkeleton,
  ASwitch,
} from "@/components/a";
import { useMeRegistry } from "@/hooks/use-me-registry";
import {
  fetchEffectiveSettings,
  fetchExpertiseCatalog,
  postMailTest,
  putCompanySetting,
  upsertExpertise,
  type ExpertiseSlot,
} from "@/lib/settings";
import { fetchMailStatus, type MailStatus } from "@/lib/users";
import {
  softChipClass,
  softPageBody,
  softPanel,
} from "@/lib/soft-glass-ui";
import { usePrefsStore, type Density } from "@/stores/prefs-store";

type Tab =
  | "general"
  | "apparence"
  | "notifications"
  | "expertise"
  | "envois";

type CompanyTab = "expertise" | "envois";

function isCompanyTab(tab: Tab): tab is CompanyTab {
  return tab === "expertise" || tab === "envois";
}

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

  const [tab, setTab] = useState<Tab>("apparence");
  const tabInited = useRef(false);
  const [companyDeniedHint, setCompanyDeniedHint] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expertise, setExpertise] = useState<ExpertiseLoad>({
    kind: "loading",
  });
  const [drafts, setDrafts] = useState<Record<string, ExpertDraft>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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
  const [envoisMsg, setEnvoisMsg] = useState<string | null>(null);
  const [envoisError, setEnvoisError] = useState<string | null>(null);
  const [mailStatus, setMailStatus] = useState<MailStatus | null>(null);

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

  useEffect(() => {
    setUnlockDraft(opsUnlockCode);
  }, [opsUnlockCode]);

  useEffect(() => {
    if (tab !== "apparence" || !canCompanyWrite) return;
    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const row = res.data.settings.find((s) => s.key === "ops.unlock_code");
      if (typeof row?.value === "string") {
        setOpsUnlockCode(row.value);
      }
    })();
  }, [tab, canCompanyWrite, setOpsUnlockCode]);

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

  useEffect(() => {
    if (!isFetched) return;
    const hashExpertise =
      typeof window !== "undefined" && window.location.hash === "#expertise";

    if (!tabInited.current) {
      tabInited.current = true;
      if (hashExpertise) {
        if (canCompanyWrite) {
          setTab("expertise");
          setCompanyDeniedHint(false);
        } else {
          setTab("apparence");
          setCompanyDeniedHint(true);
        }
        return;
      }
      if (canCompanyWrite) setTab("expertise");
      return;
    }

    if (!canCompanyWrite && isCompanyTab(tab)) {
      setTab("apparence");
    }
  }, [isFetched, canCompanyWrite, tab]);

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
  }, [canCompanyWrite]);

  useEffect(() => {
    if (tab === "expertise" && canCompanyWrite) {
      void loadExpertise();
    }
  }, [tab, loadExpertise, canCompanyWrite]);

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
    const status = await fetchMailStatus();
    setMailStatus(status.ok ? status.data : null);
  }, [canCompanyWrite]);

  useEffect(() => {
    if (tab === "envois" && canCompanyWrite) {
      void loadEnvois();
    }
  }, [tab, loadEnvois, canCompanyWrite]);

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
    setEnvoisMsg(`Test envoyé à ${res.to}${res.from ? ` (from ${res.from})` : ""}.`);
  }

  function applyDensity(next: Density) {
    setDensity(next);
  }

  function onSseBannerChange(on: boolean) {
    setShowSseBanner(on);
  }

  function selectTab(id: Tab) {
    if (isCompanyTab(id) && !canCompanyWrite) {
      setCompanyDeniedHint(true);
      setTab("apparence");
      return;
    }
    setCompanyDeniedHint(false);
    setTab(id);
    if (id === "expertise" && typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#expertise");
    } else if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", "/settings");
    }
  }

  const tabs = (
    [
      ...(canCompanyWrite
        ? ([
            ["expertise", "Expertise légale"],
            ["envois", "Envois"],
          ] as const)
        : []),
      ["general", "Général"],
      ["apparence", "Apparence"],
      ["notifications", "Notifications"],
    ] as const
  );

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

  return (
    <>
      <AScreenHeader
        title="Préférences"
        description={
          canCompanyWrite
            ? "Apparence du poste · expertise légale société. Une préférence n’outrepasse jamais une permission."
            : "Apparence et notifications de votre poste. Les paramètres société sont réservés à l’administrateur."
        }
        actions={
          tab === "envois" && canCompanyWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              {mailStatus ? (
                <ABadge
                  tone={mailStatus.configured ? "success" : "neutral"}
                  title={
                    mailStatus.configured
                      ? [
                          mailStatus.host,
                          mailStatus.port != null ? `:${mailStatus.port}` : "",
                          mailStatus.from ? ` · ${mailStatus.from}` : "",
                          mailStatus.autoSend
                            ? " · auto-send"
                            : " · auto-send off",
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
              ) : null}
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
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={envoisBusy || mailTestBusy}
                onClick={() => void onSaveEnvois()}
              >
                {envoisBusy ? "…" : savedFlash ? "Enregistré" : "Enregistrer"}
              </AButton>
            </div>
          ) : null
        }
      />
      <div className={softPageBody}>
        {companyDeniedHint ? (
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Expertise légale et Envois : réservés à l’administrateur société.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={softChipClass(tab === id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "expertise" && canCompanyWrite ? (
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
                              patchDraft(row.key, { lawRef: e.target.value })
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
                              patchDraft(row.key, { rateBps: e.target.value })
                            }
                            placeholder="Vide"
                            className="a-mono"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                            Millimes (optionnel — timbre)
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
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                            Notes
                          </span>
                          <AInput
                            value={draft.notes}
                            onChange={(e) =>
                              patchDraft(row.key, { notes: e.target.value })
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
                    </div>
                  );
                })
              : null}
          </section>
        ) : null}

        {tab === "envois" && canCompanyWrite ? (
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
              <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
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
              <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[length:var(--a-text-sm)] text-a-fg">
                    Envoi SMTP automatique
                  </p>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    Si SMTP configuré — sinon Copier / Outlook.
                  </p>
                </div>
                <ASwitch
                  checked={inviteAutoSend}
                  onCheckedChange={setInviteAutoSend}
                  label="Envoi SMTP automatique"
                />
              </div>
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
              <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
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
                <div className="flex items-end justify-between gap-3 pb-1">
                  <div>
                    <p className="text-[length:var(--a-text-sm)] text-a-fg">
                      Secure (465)
                    </p>
                  </div>
                  <ASwitch
                    checked={smtpSecure}
                    onCheckedChange={setSmtpSecure}
                    label="SMTP secure"
                  />
                </div>
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

            {envoisMsg ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {envoisMsg}
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "general" ? (
          <section className={`${softPanel} max-w-xl`}>
            <h2 className="text-[length:var(--a-text-md)] font-medium">
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

        {tab === "apparence" ? (
          <section className={`${softPanel} max-w-xl`}>
            <div>
              <p className="text-[length:var(--a-text-sm)] font-medium">
                Thème
              </p>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Dark et light sont tous deux de première classe — switch dans le
                header (même contrôle que le shell).
              </p>
            </div>
            <div>
              <p className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Densité
              </p>
              <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                Compact resserre uniquement les lignes de tableaux — le chrome
                (header, sidebar, titres) ne bouge pas.
              </p>
              <div className="flex gap-2">
                <AButton
                  type="button"
                  size="sm"
                  variant={density === "comfortable" ? "primary" : "secondary"}
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
              <p className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Surface Soft Glass
              </p>
              <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                Ghost / Patch / Solid / Minimal — opacité glass et glow (D161).
                Aussi dans le Smart Action Dock.
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ghost", "Ghost"],
                    ["patch", "Patch"],
                    ["solid", "Solid"],
                    ["minimal", "Minimal"],
                  ] as const
                ).map(([id, label]) => (
                  <AButton
                    key={id}
                    type="button"
                    size="sm"
                    variant={surfaceMode === id ? "primary" : "secondary"}
                    onClick={() => setSurfaceMode(id)}
                  >
                    {label}
                  </AButton>
                ))}
              </div>
            </div>
            {canCompanyWrite ? (
              <div>
                <p className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                  Code sortie modes ops (calculatrice)
                </p>
                <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                  SPECTRE / PATCH / GHOST : l’icône disparaît à l’entrée. Sortie
                  uniquement en tapant ce code (4–12 chiffres) sur la
                  calculatrice du toolbox. Persisté côté société (Admin / Super
                  Admin).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={unlockDraft}
                    onChange={(e) =>
                      setUnlockDraft(e.target.value.replace(/\D/g, "").slice(0, 12))
                    }
                    className="a-mono h-9 w-36 rounded-xl bg-a-surface-3 px-3 text-[length:var(--a-text-sm)] text-a-fg outline-none focus:ring-2 focus:ring-a-accent"
                    aria-label="Code déverrouillage modes"
                  />
                  <AButton
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={unlockBusy}
                    onClick={() => void onSaveUnlockCode()}
                  >
                    {unlockBusy ? "…" : "Enregistrer"}
                  </AButton>
                  <span className="a-mono text-[10px] text-a-fg-subtle">
                    défaut 3141
                  </span>
                </div>
                {unlockMsg ? (
                  <p className="mt-2 text-[length:var(--a-text-xs)] text-a-success">
                    {unlockMsg}
                  </p>
                ) : null}
                {unlockError ? (
                  <p className="mt-2 text-[length:var(--a-text-xs)] text-a-danger">
                    {unlockError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Sidebar — auto-réduction
              </p>
              <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                Réduit le menu latéral après N secondes sans survol. 0 =
                désactivé (bouton panneau uniquement). Défaut : 10 s.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <ASwitch
                  label="Auto-réduction"
                  checked={sidebarAutoCollapseSec > 0}
                  onCheckedChange={(on) =>
                    setSidebarAutoCollapseSec(on ? 10 : 0)
                  }
                />
                {sidebarAutoCollapseSec > 0 ? (
                  <label className="flex items-center gap-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
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
            </div>
          </section>
        ) : null}

        {tab === "notifications" ? (
          <section className={`${softPanel} max-w-xl`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[length:var(--a-text-sm)] font-medium">
                  Alertes jobs
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Afficher shed P4 / files Thunder dans le centre d’activité.
                </p>
              </div>
              <ASwitch
                label="Alertes jobs"
                checked={jobAlerts}
                onCheckedChange={setJobAlerts}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[length:var(--a-text-sm)] font-medium">
                  Bannière SSE
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Afficher « flux temps réel coupé » quand le stream est coupé.
                </p>
              </div>
              <ASwitch
                label="Bannière SSE"
                checked={showSseBanner}
                onCheckedChange={onSseBannerChange}
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
