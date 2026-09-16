"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  ATM_MODE_LABELS,
  ATM_RUN_STATUS_LABELS,
  atmModeBadgeTone,
  atmRunBadgeTone,
  createAtmProfile,
  fetchAtmProfiles,
  fetchAtmRuns,
  fetchAutomationCatalog,
  runAtmProfile,
  type AtmActionKind,
  type AtmCatalog,
  type AtmProfile,
  type AtmProfileMode,
  type AtmRun,
  type AtmTriggerKind,
} from "@/lib/automation";
import {
  softChipClass,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; profiles: AtmProfile[]; runs: AtmRun[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function AutomationPage() {
  const router = useRouter();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [catalog, setCatalog] = useState<AtmCatalog | null>(null);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<AtmProfileMode>("ASSISTED");
  const [triggerKind, setTriggerKind] =
    useState<AtmTriggerKind>("FINANCE_OVERDUE_OPEN_ITEMS");
  const [actionKind, setActionKind] =
    useState<AtmActionKind>("PREPARE_DUNNING_HINT");
  const [shadowMode, setShadowMode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const [p, r] = await Promise.all([
      fetchAtmProfiles({ q: query }),
      fetchAtmRuns({}),
    ]);
    if (!p.ok) {
      if (p.status === 403) {
        setState({ kind: "forbidden", message: p.message });
        return;
      }
      setState({ kind: "error", message: p.message });
      return;
    }
    setState({
      kind: "ok",
      profiles: p.data.items,
      runs: r.ok ? r.data.items : [],
    });
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const c = await fetchAutomationCatalog();
      if (c.ok) setCatalog(c.data);
    })();
  }, [load]);

  async function onCreate() {
    if (!code.trim() || !name.trim()) {
      setFormError("Code et nom obligatoires.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createAtmProfile({
      code: code.trim(),
      name: name.trim(),
      mode,
      triggerKind,
      actionKind,
      shadowMode,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setCode("");
    setName("");
    await load(q);
    router.push(`/automation/${res.data.id}`);
  }

  async function onRun(id: string) {
    setBusy(true);
    setActionError(null);
    const res = await runAtmProfile(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Automatisation"
        title="Profils ASSISTED"
        description="Suggestions human-gated (manuel ou Thunder events D289) — pas de FULL_AUTO critique."
        primary={
          <AButton type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            Nouveau profil
          </AButton>
        }
      />
      <APageBody>
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        <AFilterBar
          search={
            <AInput
              id="atm-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code / nom"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          filters={
            <div className="flex flex-wrap gap-2" role="tablist">
              <button
                type="button"
                className={softChipClass(true)}
                onClick={() => void load(q)}
              >
                Actualiser
              </button>
            </div>
          }
        />

        {state.kind === "loading" ? (
          <ASkeleton className="h-40 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q)}
          />
        ) : null}

        {state.kind === "ok" ? (
          <>
            <APageSection title="Profils" bare>
              {state.profiles.length === 0 ? (
                <AEmptyState
                  title="Aucun profil"
                  description="Créez un profil ASSISTED ou Approbation — FULL_AUTO est bloqué."
                  canAct={false}
                />
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full min-w-[640px] text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">Code</th>
                        <th className="a-table-cell font-medium">Nom</th>
                        <th className="a-table-cell font-medium">Mode</th>
                        <th className="a-table-cell font-medium">Déclencheur</th>
                        <th className="a-table-cell font-medium">Action</th>
                        <th className="a-table-cell font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {state.profiles.map((p) => (
                        <tr key={p.id} className={softTr}>
                          <td className="a-table-cell">
                            <button
                              type="button"
                              className="a-mono text-a-accent hover:underline"
                              onClick={() =>
                                router.push(`/automation/${p.id}`)
                              }
                            >
                              {p.code}
                            </button>
                          </td>
                          <td className="a-table-cell">{p.name}</td>
                          <td className="a-table-cell">
                            <ABadge tone={atmModeBadgeTone(p.mode)}>
                              {ATM_MODE_LABELS[p.mode]}
                            </ABadge>
                            {p.shadowMode ? (
                              <ABadge tone="neutral" className="ml-1">
                                Shadow
                              </ABadge>
                            ) : null}
                          </td>
                          <td className="a-table-cell text-a-fg-muted">
                            {p.triggerKind}
                          </td>
                          <td className="a-table-cell text-a-fg-muted">
                            {p.actionKind}
                          </td>
                          <td className="a-table-cell text-right">
                            <AButton
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy || !p.enabled}
                              onClick={() => void onRun(p.id)}
                            >
                              Exécuter
                            </AButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </APageSection>

            <APageSection title="Exécutions récentes" bare>
              {state.runs.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucune exécution — lancez un profil pour créer une suggestion.
                </p>
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full min-w-[560px] text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">N°</th>
                        <th className="a-table-cell font-medium">Profil</th>
                        <th className="a-table-cell font-medium">Résumé</th>
                        <th className="a-table-cell font-medium">Statut</th>
                        <th className="a-table-cell font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.runs.map((r) => (
                        <tr key={r.id} className={softTr}>
                          <td className="a-mono a-table-cell">{r.number}</td>
                          <td className="a-table-cell">
                            {r.profileCode ?? "—"}
                          </td>
                          <td className="a-table-cell">{r.summary}</td>
                          <td className="a-table-cell">
                            <ABadge tone={atmRunBadgeTone(r.status)}>
                              {ATM_RUN_STATUS_LABELS[r.status]}
                            </ABadge>
                            {r.resultJson?.source === "event" ||
                            r.triggerRef?.startsWith("evt:") ? (
                              <ABadge tone="info" className="ml-1">
                                Event
                              </ABadge>
                            ) : null}
                          </td>
                          <td className="a-mono a-table-cell text-a-fg-muted">
                            {r.createdAt.slice(0, 16).replace("T", " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </APageSection>
          </>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
        }}
        title="Nouveau profil"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Code
            </label>
            <AInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="OVERDUE_HINT"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Nom
            </label>
            <AInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Relances échues"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Mode
            </label>
            <select
              className={softSelect}
              value={mode}
              onChange={(e) => setMode(e.target.value as AtmProfileMode)}
            >
              {(catalog?.modes ?? [])
                .filter((m) => m.allowed)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Déclencheur
            </label>
            <select
              className={softSelect}
              value={triggerKind}
              onChange={(e) =>
                setTriggerKind(e.target.value as AtmTriggerKind)
              }
            >
              {(catalog?.triggers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Action
            </label>
            <select
              className={softSelect}
              value={actionKind}
              onChange={(e) =>
                setActionKind(e.target.value as AtmActionKind)
              }
            >
              {(catalog?.actions ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
            <input
              type="checkbox"
              checked={shadowMode}
              onChange={(e) => setShadowMode(e.target.checked)}
            />
            Mode shadow (log only)
          </label>
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
          <AButton type="button" disabled={busy} onClick={() => void onCreate()}>
            Créer
          </AButton>
        </div>
      </ADrawer>
    </>
  );
}
