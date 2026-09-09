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
  putCompanySetting,
  upsertExpertise,
  type ExpertiseSlot,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
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
  const [envoisBusy, setEnvoisBusy] = useState(false);
  const [envoisMsg, setEnvoisMsg] = useState<string | null>(null);
  const [envoisError, setEnvoisError] = useState<string | null>(null);

  const density = usePrefsStore((s) => s.density);
  const setDensity = usePrefsStore((s) => s.setDensity);
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
    usePrefsStore.getState().applyDensityToDom(usePrefsStore.getState().density);
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
    const from = res.data.settings.find(
      (s) => s.key === "salubrita.outlook.from_email",
    );
    const pref = res.data.settings.find(
      (s) => s.key === "salubrita.whatsapp.default_prefix",
    );
    setOutlookFrom(
      from && typeof from.value === "string" ? from.value : "",
    );
    setWaPrefix(pref && typeof pref.value === "string" ? pref.value : "");
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
    const a = await putCompanySetting(
      "salubrita.outlook.from_email",
      outlookFrom.trim(),
    );
    if (!a.ok) {
      setEnvoisBusy(false);
      setEnvoisError(a.message);
      return;
    }
    const b = await putCompanySetting(
      "salubrita.whatsapp.default_prefix",
      waPrefix.trim(),
    );
    setEnvoisBusy(false);
    if (!b.ok) {
      setEnvoisError(b.message);
      return;
    }
    setEnvoisMsg("Envois enregistrés.");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
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
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={envoisBusy}
              onClick={() => void onSaveEnvois()}
            >
              {envoisBusy ? "…" : savedFlash ? "Enregistré" : "Enregistrer"}
            </AButton>
          ) : null
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        {companyDeniedHint ? (
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Expertise légale et Envois : réservés à l’administrateur société.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1 border-b border-a-border-subtle">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={cn(
                "border-b-2 px-3 py-2 text-[length:var(--a-text-sm)]",
                tab === id
                  ? "border-a-accent text-a-fg"
                  : "border-transparent text-a-fg-muted hover:text-a-fg",
              )}
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
                        className="rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-4"
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
                      className="space-y-4 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-4"
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
          <section className="max-w-xl space-y-5">
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Paramètres société pour le certificat de salubrité. Champs vides
              jusqu’à saisie — aucun défaut inventé. Les destinataires se
              choisissent sur la fiche client (canaux Outlook / WhatsApp /
              Portail).
            </p>
            {envoisError ? (
              <AErrorState
                message={envoisError}
                retryable
                onRetry={() => void loadEnvois()}
              />
            ) : null}
            <div className="space-y-4 rounded-[14px] bg-a-surface-2 p-4">
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
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Utilisé comme référence pour les envois mailto du certificat.
                </p>
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
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Préfixé aux numéros clients sans indicatif international.
                </p>
              </div>
            </div>
            {envoisMsg ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {envoisMsg}
              </p>
            ) : null}
          </section>
        ) : null}

        {tab === "general" ? (
          <section className="a-card max-w-xl space-y-4 p-[var(--a-space-5)]">
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
          <section className="a-card max-w-xl space-y-5 p-[var(--a-space-5)]">
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
              </div>
            </div>
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
          <section className="a-card max-w-xl space-y-4 p-[var(--a-space-5)]">
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
