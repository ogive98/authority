"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { fetchForgeOverview, type ForgeOverview } from "@/lib/forge";
import { softPanel } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: ForgeOverview }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function ForgeOverviewPage() {
  const router = useRouter();
  const [state, setState] = useState<Load>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchForgeOverview();
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", data: res.data });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const data = state.kind === "ok" ? state.data : null;

  return (
    <>
      <AScreenHeader
        kicker="FORGE"
        title="Vue d’ensemble"
        description="Fondation d’extensions tenant —  D161 · pont métadonnées · IA / sandbox UNAVAILABLE."
        primary={
          <AButton
            type="button"
            size="sm"
            onClick={() => router.push("/forge/extensions")}
          >
            Extensions
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "requests",
                label: "Demandes",
                onSelect: () => router.push("/forge/feature-requests"),
              },
              {
                id: "metadata",
                label: "Métadonnées",
                onSelect: () => router.push("/forge/metadata"),
              },
              {
                id: "help",
                label: "Aide",
                onSelect: () => router.push("/help"),
              },
            ]}
          />
        }
      />
      <APageBody>
        {state.kind === "loading" ? (
          <ASkeleton className="h-32 w-full" />
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
        {data ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <APageSection title="Extensions">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {data.extensions.total}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  Total enregistrées (tenant)
                </p>
                <ul className="space-y-1 text-[length:var(--a-text-sm)]">
                  {Object.entries(data.extensions.byStatus).map(([s, n]) => (
                    <li key={s} className="flex justify-between">
                      <span className="text-a-muted">{s}</span>
                      <span className="a-mono tabular-nums">{n}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/forge/extensions"
                  className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                >
                  Ouvrir →
                </Link>
              </div>
            </APageSection>
            <APageSection title="Demandes">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {data.featureRequests.total}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  Feature requests
                </p>
                <ul className="space-y-1 text-[length:var(--a-text-sm)]">
                  {Object.entries(data.featureRequests.byStatus).map(
                    ([s, n]) => (
                      <li key={s} className="flex justify-between">
                        <span className="text-a-muted">{s}</span>
                        <span className="a-mono tabular-nums">{n}</span>
                      </li>
                    ),
                  )}
                </ul>
                <Link
                  href="/forge/feature-requests"
                  className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                >
                  Ouvrir →
                </Link>
              </div>
            </APageSection>
            <APageSection title="Métadonnées">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {data.metadata?.total ?? 0}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  Définitions · pont ⌘K ={" "}
                  {data.metadata?.activeWithCommandId ?? 0} ACTIVE
                </p>
                <ul className="space-y-1 text-[length:var(--a-text-sm)]">
                  {Object.entries(data.metadata?.byStatus ?? {}).map(
                    ([s, n]) => (
                      <li key={s} className="flex justify-between">
                        <span className="text-a-muted">{s}</span>
                        <span className="a-mono tabular-nums">{n}</span>
                      </li>
                    ),
                  )}
                </ul>
                <Link
                  href="/forge/metadata"
                  className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                >
                  Ouvrir →
                </Link>
              </div>
            </APageSection>
            <APageSection title="Limites">
              <div className={`${softPanel} space-y-3 p-4`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[length:var(--a-text-sm)]">IA</span>
                  <ABadge tone="neutral">{data.ai}</ABadge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[length:var(--a-text-sm)]">Sandbox</span>
                  <ABadge tone="neutral">{data.sandbox}</ABadge>
                </div>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  Pas d’agent autonome · pas de codegen · pas de déploiement
                  auto. Métadonnées ACTIVE enrichissent le catalog existant.
                </p>
              </div>
            </APageSection>
          </div>
        ) : null}
        {state.kind === "ok" && data.extensions.total === 0 ? (
          <AEmptyState
            title="Aucune extension"
            description="Enregistrez un manifeste DRAFT — pas d’exécution de code en Phase 1."
            actionLabel="Extensions"
            onAction={() => router.push("/forge/extensions")}
          />
        ) : null}
      </APageBody>
    </>
  );
}
