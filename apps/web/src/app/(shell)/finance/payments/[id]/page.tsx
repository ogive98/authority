"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  AContextPanel,
  ADetailGrid,
  ADrawer,
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
  type AOverflowItem,
} from "@/components/a";
import {
  INSTRUMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  POLICY_LABELS,
  confirmAllocation,
  fetchPayment,
  paymentBadgeTone,
  reversePayment,
  simulateAllocation,
  type AllocationPlan,
  type AllocationPolicy,
  type FinPayment,
} from "@/lib/finance";
import { softSelect } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinPayment }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const POLICIES = Object.keys(POLICY_LABELS) as AllocationPolicy[];

export default function FinancePaymentFichePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [policy, setPolicy] = useState<AllocationPolicy>("OLDEST_FIRST");
  const [plan, setPlan] = useState<AllocationPlan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchPayment(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Paiement introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onReverse() {
    if (!id) return;
    if (
      !window.confirm(
        "Contrepasser cet encaissement ? Les affectations seront annulées et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    const res = await reversePayment(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onSimulate() {
    if (!id) return;
    setBusy(true);
    const res = await simulateAllocation(id, { policy });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setPlan(res.data);
    setFormError(null);
  }

  async function onConfirm() {
    if (!id) return;
    setBusy(true);
    const res = await confirmAllocation(id, { policy });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setAllocOpen(false);
    setPlan(null);
    setState({ kind: "ok", data: res.data });
  }

  const pay = state.kind === "ok" ? state.data : null;
  const canAllocate =
    pay?.status === "POSTED" && Number(pay.amountUnallocated) > 0;

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!pay || pay.status !== "POSTED") return [];
    return [
      {
        id: "reverse",
        label: "Contrepasser",
        danger: true,
        disabled: busy,
        onSelect: () => void onReverse(),
      },
    ];
  }, [pay, busy]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/payments" className="hover:text-a-fg">
            Encaissements
          </Link>
        }
        kicker="Finance"
        title={pay ? pay.number : "Encaissement"}
        description="Fiche Soft Glass — montants, instruments, affectations (D238)."
        status={
          pay ? (
            <ABadge tone={paymentBadgeTone(pay.status)}>
              {PAYMENT_STATUS_LABELS[pay.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          canAllocate ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                setPolicy("OLDEST_FIRST");
                setPlan(null);
                setFormError(null);
                setAllocOpen(true);
              }}
            >
              Affecter
            </AButton>
          ) : undefined
        }
        more={
          overflowItems.length > 0 ? (
            <AOverflowMenu items={overflowItems} />
          ) : undefined
        }
      />

      <APageBody>
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        {state.kind === "loading" ? (
          <div className="space-y-3">
            <ASkeleton className="h-8 w-48" />
            <ASkeleton className="h-40 w-full" />
          </div>
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

        {pay ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Client
                      </dt>
                      <dd className="text-[length:var(--a-text-sm)]">
                        {pay.customerName ?? pay.customerCode ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Méthode
                      </dt>
                      <dd className="text-[length:var(--a-text-sm)]">
                        {pay.method}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Référence
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-sm)] tabular-nums">
                        {pay.reference ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Notes
                      </dt>
                      <dd className="text-[length:var(--a-text-sm)]">
                        {pay.notes ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </APageSection>

                <APageSection title="Montants">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Total
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-lg)] tabular-nums">
                        {pay.amount} {pay.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Non affecté
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-lg)] tabular-nums">
                        {pay.amountUnallocated} {pay.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Date / compta
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-sm)] tabular-nums">
                        {pay.paymentDate} → {pay.accountingDate}
                      </dd>
                    </div>
                  </dl>
                </APageSection>

                <APageSection title="Instruments">
                  {pay.instruments.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-muted">
                      Aucun instrument (espèces / virement / carte).
                    </p>
                  ) : (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>Type</ASoftTh>
                          <ASoftTh>N°</ASoftTh>
                          <ASoftTh numeric>Montant</ASoftTh>
                          <ASoftTh>Statut</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {pay.instruments.map((inst) => (
                          <ASoftTr key={inst.id}>
                            <ASoftTd>{inst.type}</ASoftTd>
                            <ASoftTd className="font-mono tabular-nums">
                              {inst.number}
                            </ASoftTd>
                            <ASoftTd numeric className="font-mono tabular-nums">
                              {inst.amount}
                            </ASoftTd>
                            <ASoftTd>
                              <ABadge tone="neutral">
                                {INSTRUMENT_STATUS_LABELS[inst.status] ??
                                  inst.status}
                              </ABadge>
                            </ASoftTd>
                          </ASoftTr>
                        ))}
                      </tbody>
                    </ASoftTable>
                  )}
                </APageSection>

                <APageSection title="Affectations">
                  {pay.allocations.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-muted">
                      Aucune affectation.{" "}
                      {canAllocate
                        ? "Utilisez « Affecter » (politiques A–G)."
                        : null}
                    </p>
                  ) : (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>Créance</ASoftTh>
                          <ASoftTh numeric>Montant</ASoftTh>
                          <ASoftTh>Date</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {pay.allocations.map((a) => (
                          <ASoftTr key={a.id}>
                            <ASoftTd className="font-mono tabular-nums text-[length:var(--a-text-xs)]">
                              {a.openItemId.slice(0, 8)}…
                            </ASoftTd>
                            <ASoftTd numeric className="font-mono tabular-nums">
                              {a.amount} {pay.currency}
                            </ASoftTd>
                            <ASoftTd className="font-mono tabular-nums">
                              {a.paidAt.slice(0, 10)}
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
              <AContextPanel title="Cycle">
                <ul className="space-y-2 text-[length:var(--a-text-sm)] text-a-muted">
                  <li>
                    Statut :{" "}
                    <span className="text-a-fg">
                      {PAYMENT_STATUS_LABELS[pay.status]}
                    </span>
                  </li>
                  <li>Version : {pay.version}</li>
                  <li>
                    Affectation via politiques A–G · contrepassation restaure les
                    créances · GL via Thunder.
                  </li>
                </ul>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>

      <ADrawer
        open={allocOpen}
        onOpenChange={setAllocOpen}
        title="Allocation Engine"
        description={
          pay
            ? `${pay.number} — non affecté ${pay.amountUnallocated} TND`
            : undefined
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Politique
            </label>
            <select
              className={softSelect}
              value={policy}
              onChange={(e) => {
                setPolicy(e.target.value as AllocationPolicy);
                setPlan(null);
              }}
            >
              {POLICIES.map((p) => (
                <option key={p} value={p}>
                  {POLICY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void onSimulate()}
            >
              Simuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !plan || plan.lines.length === 0}
              onClick={() => void onConfirm()}
            >
              Confirmer
            </AButton>
          </div>
          {plan ? (
            <div className="space-y-2 text-[length:var(--a-text-sm)]">
              <p className="text-a-fg-muted">
                Reste non affecté prévu :{" "}
                <span className="a-mono tabular-nums text-a-fg">
                  {plan.remainder.toFixed(3)}
                </span>
              </p>
              <ul className="space-y-1">
                {plan.lines.map((l) => (
                  <li
                    key={l.openItemId}
                    className="flex justify-between a-underlay rounded-md px-2 py-1.5"
                  >
                    <span className="a-mono">{l.openItemNumber}</span>
                    <span className="a-mono tabular-nums">
                      {l.amount.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
        </div>
      </ADrawer>
    </>
  );
}
