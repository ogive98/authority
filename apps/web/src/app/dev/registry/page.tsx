"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AButton, ADevPage } from "@/components/a";
import { useMeRegistry } from "@/hooks/use-me-registry";

export default function DevRegistryPage() {
  const { data, isFetching, isError, error, isSuccess, dataUpdatedAt } =
    useMeRegistry();
  const qc = useQueryClient();

  return (
    <ADevPage
      kicker="UI-04 · Registry"
      title="/api/v1/me/registry"
      extraActions={
        <AButton
          size="sm"
          variant="secondary"
          onClick={() =>
            void qc.invalidateQueries({ queryKey: ["me-registry"] })
          }
        >
          Refetch
        </AButton>
      }
      mainClassName="mx-auto max-w-3xl space-y-6 px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Gate : flag <span className="a-mono">platform.search</span> off → pas
        de feature « Recherche » ; on → apparaît après refetch. Modules
        DISABLED absents. Super Admin jamais listé. Session API requise
        (sinon fallback local).
      </p>

      <div className="a-card space-y-2 p-4 text-[length:var(--a-text-sm)]">
        <p>
          Status:{" "}
          {isFetching
            ? "fetching…"
            : isError
              ? `error (${error instanceof Error ? error.message : "fail"}) — fallback`
              : isSuccess
                ? "ok"
                : "idle"}
        </p>
        <p className="a-mono text-a-fg-subtle">
          companyId: {data?.companyId ?? "null"} · updated{" "}
          {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
        </p>
      </div>

      <section className="a-card p-4">
        <h2 className="mb-3 font-medium">Flags</h2>
        <ul className="a-mono space-y-1 text-[length:var(--a-text-sm)]">
          {(data?.flags ?? []).length === 0 ? (
            <li className="text-a-fg-muted">Aucun (ou non authentifié)</li>
          ) : (
            data?.flags.map((f) => (
              <li key={f.key}>
                {f.key} ={" "}
                <span className={f.enabled ? "text-a-success" : "text-a-danger"}>
                  {f.enabled ? "on" : "off"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="a-card p-4">
        <h2 className="mb-3 font-medium">Modules nav</h2>
        <ul className="space-y-4">
          {(data?.modules ?? []).map((m) => (
            <li key={m.key}>
              <p className="font-medium">
                {m.name}{" "}
                <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  {m.key}
                </span>
              </p>
              <ul className="mt-1 space-y-0.5 pl-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
                {m.features.map((f) => (
                  <li key={f.id}>
                    {f.label}
                    {f.flagKey ? (
                      <span className="a-mono text-a-fg-subtle">
                        {" "}
                        · flag {f.flagKey}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </ADevPage>
  );
}
