"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AListUtilities,
  AOverflowMenu,
  APageBody,
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
  PROMISE_STATUS_FILTERS,
  PROMISE_STATUS_LABELS,
  fetchPromises,
  promiseBadgeTone,
  type FinPromise,
  type PromiseStatus,
} from "@/lib/finance";
import { ATabs } from "@/components/a/a-tabs";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinPromise[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function parseStatus(raw: string | null): "" | PromiseStatus {
  if (
    raw === "OPEN" ||
    raw === "KEPT" ||
    raw === "BROKEN" ||
    raw === "CANCELLED"
  ) {
    return raw;
  }
  return "";
}

export default function FinancePromisesPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinancePromisesPageInner />
    </Suspense>
  );
}

function FinancePromisesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PromiseStatus>(() =>
    parseStatus(searchParams.get("status")),
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query?: string, filter?: "" | PromiseStatus) => {
    setState({ kind: "loading" });
    const res = await fetchPromises({
      q: query,
      status: filter || undefined,
    });
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  function syncStatusUrl(next: "" | PromiseStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/finance/promises?${qs}` : "/finance/promises", {
      scroll: false,
    });
  }

  useEffect(() => {
    void load("", statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    const next = parseStatus(searchParams.get("status"));
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void load(q, statusFilter);
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [q, statusFilter, load]);

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Promesses de paiement"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "engagements client sur créances AR · sans blocage auto ventes",
        )}
        more={
          <AOverflowMenu
            items={[
              {
                id: "receivables",
                label: "Créances",
                onSelect: () => router.push("/finance"),
              },
              {
                id: "banking",
                label: "Banque",
                onSelect: () => router.push("/finance/banking"),
              },
              {
                id: "payments",
                label: "Encaissements",
                onSelect: () => router.push("/finance/payments"),
              },
            ]}
          />
        }
      />

      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="ptp-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / note"
              aria-label="Recherche"
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | PromiseStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
              }}
              items={PROMISE_STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, statusFilter)} />
          }
        />

        {state.kind === "loading" ? <ASkeleton className="h-40" /> : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune promesse"
            description="Créez une promesse depuis une créance ouverte."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[40rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Créance</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
                <ASoftTh>Échéance</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr
                  key={row.id}
                  onClick={() => router.push(`/finance/promises/${row.id}`)}
                >
                  <ASoftTd className="a-mono font-semibold">{row.number}</ASoftTd>
                  <ASoftTd>
                    {row.customerName ?? row.customerCode ?? "—"}
                  </ASoftTd>
                  <ASoftTd className="a-mono">
                    {row.openItemNumber ?? "—"}
                  </ASoftTd>
                  <ASoftTd numeric>
                    {row.amount} {row.currency}
                  </ASoftTd>
                  <ASoftTd className="a-mono">{row.promisedDate}</ASoftTd>
                  <ASoftTd>
                    <ABadge tone={promiseBadgeTone(row.status)}>
                      {PROMISE_STATUS_LABELS[row.status]}
                    </ABadge>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>
    </>
  );
}
