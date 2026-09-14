"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  INSTRUMENT_STATUS_FILTERS,
  INSTRUMENT_STATUS_LABELS,
  fetchInstruments,
  instrumentBadgeTone,
  type FinInstrument,
  type InstrumentStatus,
} from "@/lib/finance";
import {
  softChipClass,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinInstrument[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const TYPE_LABELS: Record<FinInstrument["type"], string> = {
  CHEQUE: "Chèque",
  BILL_OF_EXCHANGE: "Traite",
};

function parseStatus(raw: string | null): "" | InstrumentStatus {
  if (
    raw === "RECEIVED" ||
    raw === "DEPOSITED" ||
    raw === "PRESENTED" ||
    raw === "CLEARED" ||
    raw === "REJECTED" ||
    raw === "CANCELLED"
  ) {
    return raw;
  }
  return "";
}

export default function FinanceInstrumentsPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinanceInstrumentsPageInner />
    </Suspense>
  );
}

function FinanceInstrumentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [statusFilter, setStatusFilter] = useState<"" | InstrumentStatus>(() =>
    parseStatus(searchParams.get("status")),
  );

  const load = useCallback(async (status?: "" | InstrumentStatus) => {
    setState({ kind: "loading" });
    const res = await fetchInstruments({
      status: status || undefined,
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

  function syncStatusUrl(next: "" | InstrumentStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(
      qs ? `/finance/instruments?${qs}` : "/finance/instruments",
      { scroll: false },
    );
  }

  useEffect(() => {
    void load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    const next = parseStatus(searchParams.get("status"));
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Instruments"
        description="Chèques et traites — rejet = restauration des créances AR."
        more={
          <AOverflowMenu
            items={[
              {
                id: "payments",
                label: "Encaissements",
                onSelect: () => router.push("/finance/payments"),
              },
              {
                id: "banking",
                label: "Banque",
                onSelect: () => router.push("/finance/banking"),
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
          filters={
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filtrer par statut"
            >
              {INSTRUMENT_STATUS_FILTERS.map((chip) => {
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
                      void load(chip.id);
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
              onClick={() => void load(statusFilter)}
            >
              Filtrer
            </AButton>
          }
        />

        {state.kind === "loading" ? (
          <ASkeleton className="h-24 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(statusFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun instrument"
            description="Créez un paiement chèque/traite pour enregistrer un instrument."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="a-table-cell font-medium">Type</th>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Échéance</th>
                  <th className="a-table-cell font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className={`${softTr} cursor-pointer`}
                    onClick={() =>
                      router.push(`/finance/instruments/${row.id}`)
                    }
                  >
                    <td className="a-table-cell">{TYPE_LABELS[row.type]}</td>
                    <td className="a-mono a-table-cell">{row.number}</td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {row.amount}
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {row.dueDate ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={instrumentBadgeTone(row.status)}>
                        {INSTRUMENT_STATUS_LABELS[row.status]}
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
