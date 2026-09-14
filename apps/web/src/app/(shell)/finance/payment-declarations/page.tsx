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
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  PAYMENT_DECLARATION_STATUS_FILTERS,
  PAYMENT_DECLARATION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  fetchPaymentDeclarations,
  paymentDeclarationBadgeTone,
  type FinPaymentDeclaration,
  type PaymentDeclarationStatus,
} from "@/lib/finance";
import {
  softChipClass,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinPaymentDeclaration[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function parseStatus(raw: string | null): "" | PaymentDeclarationStatus {
  if (
    raw === "SUBMITTED" ||
    raw === "ACKNOWLEDGED" ||
    raw === "REJECTED" ||
    raw === "CANCELLED"
  ) {
    return raw;
  }
  return "";
}

export default function FinancePaymentDeclarationsPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinancePaymentDeclarationsPageInner />
    </Suspense>
  );
}

function FinancePaymentDeclarationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | PaymentDeclarationStatus
  >(() => parseStatus(searchParams.get("status")));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query?: string, filter?: "" | PaymentDeclarationStatus) => {
      setState({ kind: "loading" });
      const res = await fetchPaymentDeclarations({
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
    },
    [],
  );

  function syncStatusUrl(next: "" | PaymentDeclarationStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(
      qs
        ? `/finance/payment-declarations?${qs}`
        : "/finance/payment-declarations",
      { scroll: false },
    );
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
        title="Déclarations portail"
        description="Signalements client de paiement — prise en compte humaine, sans encaissement automatique."
        more={
          <AOverflowMenu
            items={[
              {
                id: "payments",
                label: "Encaissements",
                onSelect: () => router.push("/finance/payments"),
              },
              {
                id: "receivables",
                label: "Créances",
                onSelect: () => router.push("/finance"),
              },
            ]}
          />
        }
      />

      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="ppd-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / référence"
              aria-label="Recherche"
            />
          }
          filters={
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filtrer par statut"
            >
              {PAYMENT_DECLARATION_STATUS_FILTERS.map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={softChipClass(active)}
                    onClick={() => {
                      setStatusFilter(chip.id);
                      syncStatusUrl(chip.id);
                      void load(q, chip.id);
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          }
        />

        {state.kind === "loading" ? (
          <ASkeleton className="h-40 w-full" />
        ) : state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q, statusFilter)}
          />
        ) : state.items.length === 0 ? (
          <AEmptyState
            title="Aucune déclaration"
            description="Les signalements de paiement depuis le portail client apparaîtront ici."
            canAct={false}
          />
        ) : (
          <div className={softTableWrap}>
            <table className="w-full min-w-[720px] text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Client</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Mode</th>
                  <th className="a-table-cell font-medium">Date</th>
                  <th className="a-table-cell font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row, i) => (
                  <tr
                    key={row.id}
                    className={softTr(i)}
                    role="link"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/finance/payment-declarations/${row.id}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(
                          `/finance/payment-declarations/${row.id}`,
                        );
                      }
                    }}
                  >
                    <td className="a-table-cell a-mono">{row.number}</td>
                    <td className="a-table-cell">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="a-table-cell a-mono tabular-nums">
                      {row.amount} {row.currency}
                    </td>
                    <td className="a-table-cell">
                      {PAYMENT_METHOD_LABELS[row.method] ?? row.method}
                    </td>
                    <td className="a-table-cell a-mono">{row.paymentDate}</td>
                    <td className="a-table-cell">
                      <ABadge tone={paymentDeclarationBadgeTone(row.status)}>
                        {PAYMENT_DECLARATION_STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </APageBody>
    </>
  );
}
