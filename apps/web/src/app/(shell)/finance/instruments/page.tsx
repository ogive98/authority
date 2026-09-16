"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
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
  INSTRUMENT_STATUS_FILTERS,
  INSTRUMENT_STATUS_LABELS,
  fetchInstruments,
  instrumentBadgeTone,
  type FinInstrument,
  type InstrumentStatus,
} from "@/lib/finance";
import { ATabs } from "@/components/a/a-tabs";

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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "chèques et traites · rejet = restauration AR",
        )}
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
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | InstrumentStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
                void load(next);
              }}
              items={INSTRUMENT_STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(statusFilter)} />
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
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Type</ASoftTh>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
                <ASoftTh>Échéance</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr
                  key={row.id}
                  onClick={() =>
                    router.push(`/finance/instruments/${row.id}`)
                  }
                >
                  <ASoftTd>{TYPE_LABELS[row.type]}</ASoftTd>
                  <ASoftTd className="a-mono font-semibold">{row.number}</ASoftTd>
                  <ASoftTd numeric>{row.amount}</ASoftTd>
                  <ASoftTd className="a-mono text-a-fg-muted">
                    {row.dueDate ?? "—"}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={instrumentBadgeTone(row.status)}>
                      {INSTRUMENT_STATUS_LABELS[row.status]}
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
