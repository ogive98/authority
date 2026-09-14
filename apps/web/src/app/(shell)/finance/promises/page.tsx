"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  PROMISE_STATUS_FILTERS,
  PROMISE_STATUS_LABELS,
  fetchPromises,
  promiseBadgeTone,
  type FinPromise,
  type PromiseStatus,
} from "@/lib/finance";
import {
  softChipClass,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

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
        description="Engagements client sur créances AR — sans blocage automatique des ventes."
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
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filtrer par statut"
            >
              {PROMISE_STATUS_FILTERS.map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setStatusFilter(chip.id);
                      syncStatusUrl(chip.id);
                    }}
                    className={softChipClass(active)}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          }
          utilities={
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load(q, statusFilter)}
            >
              Filtrer
            </AButton>
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
          <div className={softTableWrap}>
            <table className="w-full min-w-[40rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-2 py-2 font-medium">N°</th>
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Créance</th>
                  <th className="px-2 py-2 font-medium text-right">Montant</th>
                  <th className="px-2 py-2 font-medium">Échéance</th>
                  <th className="px-2 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className={`${softTr} cursor-pointer`}
                    onClick={() => router.push(`/finance/promises/${row.id}`)}
                  >
                    <td className="a-mono px-2 py-2">{row.number}</td>
                    <td className="px-2 py-2">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="a-mono px-2 py-2">
                      {row.openItemNumber ?? "—"}
                    </td>
                    <td className="a-mono px-2 py-2 text-right">
                      {row.amount} {row.currency}
                    </td>
                    <td className="a-mono px-2 py-2">{row.promisedDate}</td>
                    <td className="px-2 py-2">
                      <ABadge tone={promiseBadgeTone(row.status)}>
                        {PROMISE_STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </APageBody>
    </>
  );
}
