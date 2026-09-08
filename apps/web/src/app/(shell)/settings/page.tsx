"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  ASwitch,
} from "@/components/a";
import {
  fetchExpertiseCatalog,
  upsertExpertise,
  type ExpertiseSlot,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { usePrefsStore, type Density } from "@/stores/prefs-store";

type Tab = "general" | "apparence" | "notifications" | "expertise";

type ExpertiseLoad =
  | { kind: "loading" }
  | { kind: "ok"; items: ExpertiseSlot[]; pending: number }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

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
  const [tab, setTab] = useState<Tab>("expertise");
  const [savedFlash, setSavedFlash] = useState(false);
  const [expertise, setExpertise] = useState<ExpertiseLoad>({
    kind: "loading",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<ExpertiseSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [valueLabel, setValueLabel] = useState("");
  const [lawRef, setLawRef] = useState("");
  const [expertValidatedAt, setExpertValidatedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [rateBps, setRateBps] = useState("");
  const [amountMilli, setAmountMilli] = useState("");
  const [notes, setNotes] = useState("");

  const density = usePrefsStore((s) => s.density);
  const setDensity = usePrefsStore((s) => s.setDensity);
  const showSseBanner = usePrefsStore((s) => s.showSseBanner);
  const setShowSseBanner = usePrefsStore((s) => s.setShowSseBanner);
  const jobAlerts = usePrefsStore((s) => s.jobAlerts);
  const setJobAlerts = usePrefsStore((s) => s.setJobAlerts);

  useEffect(() => {
    usePrefsStore.getState().applyDensityToDom(usePrefsStore.getState().density);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#expertise") {
      setTab("expertise");
    }
  }, []);

  const loadExpertise = useCallback(async () => {
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
    setExpertise({
      kind: "ok",
      items: res.data.items,
      pending: res.data.pendingExpertCount,
    });
  }, []);

  useEffect(() => {
    if (tab === "expertise") {
      void loadExpertise();
    }
  }, [tab, loadExpertise]);

  function applyDensity(next: Density) {
    setDensity(next);
  }

  function onSseBannerChange(on: boolean) {
    setShowSseBanner(on);
  }

  function onSave() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function selectTab(id: Tab) {
    setTab(id);
    if (id === "expertise" && typeof window !== "undefined") {
      window.history.replaceState(null, "", "/settings#expertise");
    } else if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", "/settings");
    }
  }

  function openExpertForm(row: ExpertiseSlot) {
    if (!row.writable) return;
    setSelected(row);
    setFormError(null);
    setValueLabel(row.valueSummary ?? "");
    setLawRef(row.lawRef ?? "");
    setExpertValidatedAt(
      row.expertValidatedAt
        ? row.expertValidatedAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setRateBps(row.rateBps != null ? String(row.rateBps) : "");
    setAmountMilli(row.amountMilli != null ? String(row.amountMilli) : "");
    setNotes(row.notes ?? "");
    setDrawerOpen(true);
  }

  async function onSubmitExpert() {
    if (!selected) return;
    setBusy(true);
    setFormError(null);
    const rate = rateBps.trim() ? Number(rateBps) : undefined;
    const amount = amountMilli.trim() ? Number(amountMilli) : undefined;
    if (rateBps.trim() && !Number.isFinite(rate)) {
      setBusy(false);
      setFormError("rateBps invalide (entier, ex. 100 = 1 %).");
      return;
    }
    if (amountMilli.trim() && !Number.isFinite(amount)) {
      setBusy(false);
      setFormError("amountMilli invalide.");
      return;
    }
    const res = await upsertExpertise(selected.key, {
      valueLabel: valueLabel.trim(),
      lawRef: lawRef.trim(),
      expertValidatedAt: new Date(expertValidatedAt).toISOString(),
      rateBps: rate,
      amountMilli: amount,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setSelected(null);
    await loadExpertise();
  }

  return (
    <>
      <AScreenHeader
        title="Préférences"
        description="Apparence du poste · expertise légale société. Une préférence n’outrepasse jamais une permission."
        actions={
          tab === "expertise" ? null : (
            <AButton type="button" size="sm" onClick={onSave}>
              {savedFlash ? "Enregistré" : "Enregistrer"}
            </AButton>
          )
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap gap-1 border-b border-a-border-subtle">
          {(
            [
              ["expertise", "Expertise légale"],
              ["general", "Général"],
              ["apparence", "Apparence"],
              ["notifications", "Notifications"],
            ] as const
          ).map(([id, label]) => (
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

        {tab === "expertise" ? (
          <section className="space-y-4">
            <p className="max-w-2xl text-[length:var(--a-text-sm)] text-a-fg-muted">
              Saisie expert : libellé + référence légale + date de validation.
              Aucun taux n’est prérempli — vous fournissez les valeurs.
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
            {expertise.kind === "ok" && expertise.items.length > 0 ? (
              <>
                {expertise.pending > 0 ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {expertise.pending} paramètre
                    {expertise.pending > 1 ? "s" : ""} en attente d’expertise.
                  </p>
                ) : null}
                <div className="overflow-x-auto rounded-[var(--a-radius-lg)] border border-a-border-subtle">
                  <table className="w-full min-w-[640px] text-left text-[length:var(--a-text-sm)]">
                    <thead className="bg-a-surface-2 text-a-fg-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Paramètre</th>
                        <th className="px-4 py-3 font-medium">Domaine</th>
                        <th className="px-4 py-3 font-medium">Valeur</th>
                        <th className="px-4 py-3 font-medium">Réf. légale</th>
                        <th className="px-4 py-3 font-medium">Statut</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expertise.items.map((row) => (
                        <tr
                          key={row.key}
                          className="border-t border-a-border-subtle hover:bg-a-surface-2/60"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.label}</div>
                            <div className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                              {row.description}
                            </div>
                          </td>
                          <td className="a-mono px-4 py-3 text-a-fg-muted">
                            {row.domain}
                          </td>
                          <td className="a-mono px-4 py-3 tabular-nums">
                            {row.valueSummary ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-a-fg-muted">
                            {row.lawRef ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <ABadge tone={statusTone(row.status)}>
                              {statusLabel(row.status)}
                            </ABadge>
                          </td>
                          <td className="px-4 py-3">
                            {row.writable ? (
                              <AButton
                                type="button"
                                variant="ghost"
                                onClick={() => openExpertForm(row)}
                              >
                                {row.status === "VALIDATED"
                                  ? "Modifier"
                                  : "Saisir"}
                              </AButton>
                            ) : row.manageHref ? (
                              <Link
                                href={row.manageHref}
                                className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                              >
                                Ouvrir
                              </Link>
                            ) : (
                              <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <ADrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              title={
                selected
                  ? `Expertise — ${selected.label}`
                  : "Saisie expert"
              }
            >
              <div className="space-y-4 p-1">
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Saisissez uniquement des valeurs validées par un expert. Rien
                  n’est inventé par le système.
                </p>
                {formError ? (
                  <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
                    {formError}
                  </p>
                ) : null}
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Libellé valeur (obligatoire)
                  </span>
                  <AInput
                    value={valueLabel}
                    onChange={(e) => setValueLabel(e.target.value)}
                    placeholder="ex. 1 % · 1,000 TND · barème 2026"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Référence légale (obligatoire)
                  </span>
                  <AInput
                    value={lawRef}
                    onChange={(e) => setLawRef(e.target.value)}
                    placeholder="ex. LF art. … / note expert"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Date validation expert
                  </span>
                  <AInput
                    type="date"
                    value={expertValidatedAt}
                    onChange={(e) => setExpertValidatedAt(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Taux (bps, optionnel — 100 = 1 %)
                  </span>
                  <AInput
                    value={rateBps}
                    onChange={(e) => setRateBps(e.target.value)}
                    placeholder="laisser vide si non applicable"
                    className="a-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Montant millimes (optionnel — timbre)
                  </span>
                  <AInput
                    value={amountMilli}
                    onChange={(e) => setAmountMilli(e.target.value)}
                    placeholder="laisser vide si non applicable"
                    className="a-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Notes
                  </span>
                  <AInput
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <AButton
                  type="button"
                  disabled={
                    busy || !valueLabel.trim() || !lawRef.trim() || !expertValidatedAt
                  }
                  onClick={() => void onSubmitExpert()}
                >
                  Valider expertise
                </AButton>
              </div>
            </ADrawer>
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
