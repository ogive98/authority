"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AContextPanel,
  ADetailGrid,
  AErrorState,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import {
  ATM_MODE_LABELS,
  ATM_RUN_STATUS_LABELS,
  approveAtmRun,
  atmModeBadgeTone,
  atmRunBadgeTone,
  fetchAtmProfile,
  fetchAtmRuns,
  rejectAtmRun,
  runAtmProfile,
  type AtmProfile,
  type AtmRun,
} from "@/lib/automation";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; profile: AtmProfile; runs: AtmRun[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function AutomationProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const [p, r] = await Promise.all([
      fetchAtmProfile(id),
      fetchAtmRuns({ profileId: id }),
    ]);
    if (!p.ok) {
      if (p.status === 403) {
        setState({ kind: "forbidden", message: p.message });
        return;
      }
      setState({
        kind: "error",
        message: p.status === 404 ? "Profil introuvable." : p.message,
      });
      return;
    }
    setState({
      kind: "ok",
      profile: p.data,
      runs: r.ok ? r.data.items : [],
    });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRun() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await runAtmProfile(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onApprove(run: AtmRun) {
    setBusy(true);
    setActionError(null);
    const res = await approveAtmRun(run.id, { version: run.version });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onReject(run: AtmRun) {
    if (!window.confirm("Refuser cette suggestion ?")) return;
    setBusy(true);
    setActionError(null);
    const res = await rejectAtmRun(run.id, { version: run.version });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  const profile = state.kind === "ok" ? state.profile : null;

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/automation" className="hover:text-a-fg">
            Automatisation
          </Link>
        }
        kicker="Automatisation"
        title={profile ? profile.code : "Profil"}
        description={
          profile
            ? `${profile.name} · aucune mutation métier auto`
            : "Profil ASSISTED / Approbation (D245)."
        }
        status={
          profile ? (
            <ABadge tone={atmModeBadgeTone(profile.mode)}>
              {ATM_MODE_LABELS[profile.mode]}
            </ABadge>
          ) : undefined
        }
        primary={
          profile?.enabled ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onRun()}
            >
              Exécuter
            </AButton>
          ) : undefined
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "list",
                label: "Liste profils",
                onSelect: () => router.push("/automation"),
              },
            ]}
          />
        }
      />
      <APageBody>
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}
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
            onRetry={() => void load()}
          />
        ) : null}
        {profile && state.kind === "ok" ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Déclencheur</dt>
                      <dd className="a-mono">{profile.triggerKind}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Action</dt>
                      <dd className="a-mono">{profile.actionKind}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Activé</dt>
                      <dd>{profile.enabled ? "Oui" : "Non"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Shadow</dt>
                      <dd>{profile.shadowMode ? "Oui" : "Non"}</dd>
                    </div>
                    {profile.description ? (
                      <div className="sm:col-span-2">
                        <dt className="text-a-fg-muted">Description</dt>
                        <dd>{profile.description}</dd>
                      </div>
                    ) : null}
                  </dl>
                </APageSection>

                <APageSection title="Exécutions">
                  {state.runs.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucune exécution.
                    </p>
                  ) : (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>N°</ASoftTh>
                          <ASoftTh>Résumé</ASoftTh>
                          <ASoftTh>Statut</ASoftTh>
                          <ASoftTh>Revue</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {state.runs.map((r) => (
                          <ASoftTr key={r.id}>
                            <ASoftTd className="a-mono">{r.number}</ASoftTd>
                            <ASoftTd>{r.summary}</ASoftTd>
                            <ASoftTd>
                              <ABadge tone={atmRunBadgeTone(r.status)}>
                                {ATM_RUN_STATUS_LABELS[r.status]}
                              </ABadge>
                            </ASoftTd>
                            <ASoftTd>
                              {r.status === "SUGGESTED" ||
                              r.status === "PENDING_APPROVAL" ? (
                                <div className="flex flex-wrap gap-2">
                                  <AButton
                                    type="button"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void onApprove(r)}
                                  >
                                    Approuver
                                  </AButton>
                                  <AButton
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => void onReject(r)}
                                  >
                                    Refuser
                                  </AButton>
                                </div>
                              ) : (
                                <span className="text-a-fg-muted">—</span>
                              )}
                            </ASoftTd>
                          </ASoftTr>
                        ))}
                      </tbody>
                    </ASoftTable>
                  )}
                </APageSection>
              </>
            }
            context={
              <AContextPanel title="Garde-fous">
                <ul className="space-y-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  <li>FULL_AUTO bloqué en V0.</li>
                  <li>Pas de confirm commande auto.</li>
                  <li>Pas de FinPayment / draft dunning auto.</li>
                  <li>Approuver = acknowledgement, pas mutation.</li>
                </ul>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>
    </>
  );
}
