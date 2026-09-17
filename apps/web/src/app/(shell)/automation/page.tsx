"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AField,
  AFilterBar,
  AForbiddenState,
  AFormSection,
  AInput,
  AListUtilities,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  erpListDescription,
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
import { softSelect } from "@/lib/d294-ui";

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
        description={erpListDescription(
          state.kind === "ok" ? state.profiles.length : null,
          "Suggestions human-gated (manuel ou Thunder events D289) — pas de FULL_AUTO critique",
        )}
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
          utilities={<AListUtilities onFilter={() => void load(q)} />}
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
                <ASoftTable className="min-w-[640px]">
                  <ASoftThead>
                    <ASoftTr>
                      <ASoftTh>Code</ASoftTh>
                      <ASoftTh>Nom</ASoftTh>
                      <ASoftTh>Mode</ASoftTh>
                      <ASoftTh>Déclencheur</ASoftTh>
                      <ASoftTh>Action</ASoftTh>
                      <ASoftTh> </ASoftTh>
                    </ASoftTr>
                  </ASoftThead>
                  <tbody>
                    {state.profiles.map((p) => (
                      <ASoftTr
                        key={p.id}
                        onClick={() => router.push(`/automation/${p.id}`)}
                      >
                        <ASoftTd>
                          <button
                            type="button"
                            className="a-mono font-medium text-a-accent hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/automation/${p.id}`);
                            }}
                          >
                            {p.code}
                          </button>
                        </ASoftTd>
                        <ASoftTd>{p.name}</ASoftTd>
                        <ASoftTd>
                          <ABadge tone={atmModeBadgeTone(p.mode)}>
                            {ATM_MODE_LABELS[p.mode]}
                          </ABadge>
                          {p.shadowMode ? (
                            <ABadge tone="neutral" className="ml-1">
                              Shadow
                            </ABadge>
                          ) : null}
                        </ASoftTd>
                        <ASoftTd className="text-a-fg-muted">
                          {p.triggerKind}
                        </ASoftTd>
                        <ASoftTd className="text-a-fg-muted">
                          {p.actionKind}
                        </ASoftTd>
                        <ASoftTd>
                          <div
                            className="flex justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <AButton
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy || !p.enabled}
                              onClick={() => void onRun(p.id)}
                            >
                              Exécuter
                            </AButton>
                          </div>
                        </ASoftTd>
                      </ASoftTr>
                    ))}
                  </tbody>
                </ASoftTable>
              )}
            </APageSection>

            <APageSection title="Exécutions récentes" bare>
              {state.runs.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucune exécution — lancez un profil pour créer une suggestion.
                </p>
              ) : (
                <ASoftTable className="min-w-[560px]">
                  <ASoftThead>
                    <ASoftTr>
                      <ASoftTh>N°</ASoftTh>
                      <ASoftTh>Profil</ASoftTh>
                      <ASoftTh>Résumé</ASoftTh>
                      <ASoftTh>Statut</ASoftTh>
                      <ASoftTh>Date</ASoftTh>
                    </ASoftTr>
                  </ASoftThead>
                  <tbody>
                    {state.runs.map((r) => (
                      <ASoftTr key={r.id}>
                        <ASoftTd className="a-mono">{r.number}</ASoftTd>
                        <ASoftTd>{r.profileCode ?? "—"}</ASoftTd>
                        <ASoftTd>{r.summary}</ASoftTd>
                        <ASoftTd>
                          <ABadge tone={atmRunBadgeTone(r.status)}>
                            {ATM_RUN_STATUS_LABELS[r.status]}
                          </ABadge>
                          {r.resultJson?.source === "event" ||
                          r.triggerRef?.startsWith("evt:") ? (
                            <ABadge tone="info" className="ml-1">
                              Event
                            </ABadge>
                          ) : null}
                        </ASoftTd>
                        <ASoftTd className="a-mono text-a-fg-muted">
                          {r.createdAt.slice(0, 16).replace("T", " ")}
                        </ASoftTd>
                      </ASoftTr>
                    ))}
                  </tbody>
                </ASoftTable>
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
        <div className="space-y-5 p-4">
          <AFormSection title="Identité">
            <AField label="Code">
              <AInput
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="OVERDUE_HINT"
              />
            </AField>
            <AField label="Nom">
              <AInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Relances échues"
              />
            </AField>
          </AFormSection>

          <AFormSection title="Comportement">
            <AField label="Mode">
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
            </AField>
            <AField label="Déclencheur">
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
            </AField>
            <AField label="Action">
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
            </AField>
            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)] text-a-fg">
              <input
                type="checkbox"
                checked={shadowMode}
                onChange={(e) => setShadowMode(e.target.checked)}
              />
              Mode shadow (log only)
            </label>
          </AFormSection>

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
