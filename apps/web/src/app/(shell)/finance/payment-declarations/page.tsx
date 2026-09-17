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
  PAYMENT_DECLARATION_STATUS_FILTERS,
  PAYMENT_DECLARATION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  fetchPaymentDeclarations,
  paymentDeclarationBadgeTone,
  type FinPaymentDeclaration,
  type PaymentDeclarationStatus,
} from "@/lib/finance";
import { ATabs } from "@/components/a/a-tabs";

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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "signalements client · prise en compte humaine",
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
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as
                  | ""
                  | PaymentDeclarationStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
                void load(q, next);
              }}
              items={PAYMENT_DECLARATION_STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, statusFilter)} />
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
          <ASoftTable className="min-w-[720px]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
                <ASoftTh>Mode</ASoftTh>
                <ASoftTh>Date</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr
                  key={row.id}
                  onClick={() =>
                    router.push(`/finance/payment-declarations/${row.id}`)
                  }
                >
                  <ASoftTd className="a-mono font-medium">{row.number}</ASoftTd>
                  <ASoftTd>
                    {row.customerName ?? row.customerCode ?? "—"}
                  </ASoftTd>
                  <ASoftTd numeric>
                    {row.amount} {row.currency}
                  </ASoftTd>
                  <ASoftTd>
                    {PAYMENT_METHOD_LABELS[row.method] ?? row.method}
                  </ASoftTd>
                  <ASoftTd className="a-mono">{row.paymentDate}</ASoftTd>
                  <ASoftTd>
                    <ABadge tone={paymentDeclarationBadgeTone(row.status)}>
                      {PAYMENT_DECLARATION_STATUS_LABELS[row.status]}
                    </ABadge>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        )}
      </APageBody>
    </>
  );
}
