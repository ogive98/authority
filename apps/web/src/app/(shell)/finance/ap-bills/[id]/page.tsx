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
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASwitch,
  type AOverflowItem,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  AP_BILL_STATUS_LABELS,
  apBillBadgeTone,
  cancelApBill,
  createApPayment,
  fetchApBill,
  fetchFinanceExpertiseHints,
  postApBill,
  type FinApBill,
} from "@/lib/finance";
import { softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinApBill }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type PayForm = {
  amount: string;
  method: string;
  paymentDate: string;
  reference: string;
  applyRas: boolean;
};

export default function FinanceApBillFichePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<PayForm | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [rasHint, setRasHint] = useState<string | null>(null);
  const [rasPreviewAmount, setRasPreviewAmount] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchApBill(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message:
          res.status === 404 ? "Facture fournisseur introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPost() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await postApBill(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCancel() {
    if (!id) return;
    if (
      !window.confirm(
        "Annuler cette facture fournisseur ? Si une écriture GL existe, elle sera contrepassée via Thunder (D273).",
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    const res = await cancelApBill(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  function openPay() {
    const bill = state.kind === "ok" ? state.data : null;
    if (!bill || bill.status !== "POSTED") return;
    setPayError(null);
    setRasHint(null);
    setRasPreviewAmount(null);
    setPayForm({
      amount: bill.amountTotal,
      method: "BANK_TRANSFER",
      paymentDate: new Date().toISOString().slice(0, 10),
      reference: bill.reference ?? "",
      applyRas: true,
    });
    setPayOpen(true);
    const base = Number(bill.amountTotal);
    void (async () => {
      const res = await fetchFinanceExpertiseHints({
        rasBase: Number.isFinite(base) ? base : undefined,
      });
      if (!res.ok) return;
      if (res.data.rasPreview?.applied) {
        setRasPreviewAmount(res.data.rasPreview.amount);
        setRasHint(
          `RAS Prefs VALIDATED (${res.data.rasPreview.rateBps ?? "—"} bps) : ${res.data.rasPreview.amount.toFixed(3)} TND déduit auto du décaissement (net = montant − RAS). Pas de TEJ transmission.`,
        );
      } else if (!res.data.ras) {
        setRasPreviewAmount(null);
        setRasHint(
          "RAS en attente expert (Préférences) — aucun taux inventé, pas de déduction.",
        );
      }
    })();
  }

  async function submitPay() {
    if (!payForm || !id) return;
    const amount = Number(payForm.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError("Montant TND doit être > 0.");
      return;
    }
    setBusy(true);
    setPayError(null);
    const res = await createApPayment({
      apBillId: id,
      amount,
      method: payForm.method,
      paymentDate: payForm.paymentDate,
      reference: payForm.reference.trim() || undefined,
      applyRas: payForm.applyRas,
    });
    setBusy(false);
    if (!res.ok) {
      setPayError(res.message);
      return;
    }
    setPayOpen(false);
    setPayForm(null);
    await load();
  }

  const bill = state.kind === "ok" ? state.data : null;

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!bill) return [];
    const items: AOverflowItem[] = [];
    if (bill.status === "POSTED") {
      items.push({
        id: "banking",
        label: "Banque",
        onSelect: () => {
          window.location.href = "/finance/banking";
        },
      });
    }
    if (bill.status !== "CANCELLED") {
      items.push({
        id: "cancel",
        label: "Annuler",
        danger: true,
        disabled: busy,
        onSelect: () => void onCancel(),
      });
    }
    return items;
  }, [bill, busy]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/ap-bills" className="hover:text-a-fg">
            Factures fournisseurs
          </Link>
        }
        kicker="Finance"
        title={bill ? bill.number : "Facture fournisseur"}
        description="AP bill Soft Glass — décaissement · RAS auto si Prefs VALIDATED (D264) · GL Thunder (D273)."
        status={
          bill ? (
            <ABadge tone={apBillBadgeTone(bill.status)}>
              {AP_BILL_STATUS_LABELS[bill.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          bill?.status === "DRAFT" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onPost()}
            >
              Poster
            </AButton>
          ) : bill?.status === "POSTED" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={openPay}
            >
              Décaisser
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
        <ExpertiseHintsStrip keys={["tax.ras", "tax.tej"]} />
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

        {bill ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Fournisseur
                      </dt>
                      <dd className="text-[length:var(--a-text-sm)]">
                        {bill.vendorName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Libellé
                      </dt>
                      <dd className="text-[length:var(--a-text-sm)]">
                        {bill.label ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Référence
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-sm)] tabular-nums">
                        {bill.reference ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Notes
                      </dt>
                      <dd className="text-[length:var(--a-text-sm)]">
                        {bill.notes ?? "—"}
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
                        {bill.amountTotal} {bill.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Décaissé
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-lg)] tabular-nums">
                        {bill.amountPaid ?? "0.000"} {bill.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[length:var(--a-text-xs)] text-a-muted">
                        Date / échéance
                      </dt>
                      <dd className="font-mono text-[length:var(--a-text-sm)] tabular-nums">
                        {bill.billDate}
                        {bill.dueDate ? ` → ${bill.dueDate}` : ""}
                      </dd>
                    </div>
                  </dl>
                </APageSection>
                <APageSection title="Décaissements liés">
                  {(bill.payments?.length ?? 0) === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-muted">
                      Aucun décaissement lié.{" "}
                      {bill.status === "POSTED"
                        ? "Utilisez « Décaisser » (partiel OK)."
                        : "Poster la facture pour décaisser."}
                    </p>
                  ) : (
                    <div className={softTableWrap}>
                      <table className="w-full text-left text-[length:var(--a-text-sm)]">
                        <thead className={softThead}>
                          <tr>
                            <th className="px-3 py-2 font-medium">N°</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium text-right">
                              Montant
                            </th>
                            <th className="px-3 py-2 font-medium">Banque</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bill.payments?.map((p) => (
                            <tr key={p.id} className={softTr}>
                              <td className="px-3 py-2 font-mono tabular-nums">
                                {p.number}
                              </td>
                              <td className="px-3 py-2 font-mono tabular-nums">
                                {p.paymentDate}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {p.amount} {p.currency}
                              </td>
                              <td className="px-3 py-2">
                                <ABadge
                                  tone={p.matched ? "success" : "neutral"}
                                >
                                  {p.matched ? "Rapproché" : "Ouvert"}
                                </ABadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                      {AP_BILL_STATUS_LABELS[bill.status]}
                    </span>
                  </li>
                  <li>
                    Postée le :{" "}
                    <span className="font-mono tabular-nums text-a-fg">
                      {bill.postedAt ? bill.postedAt.slice(0, 10) : "—"}
                    </span>
                  </li>
                  <li>Version : {bill.version}</li>
                  <li>
                    Lien optionnel vers `FinApPayment` · GL Thunder à la
                    validation / décaissement (D273) · rapprochement banque
                    sans écriture supplémentaire.
                  </li>
                </ul>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>

      <ADrawer
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Décaissement lié"
        description="Crée un FinApPayment POSTED lié — GL Dr Fournisseurs / Cr Banque (D273)."
      >
        {payForm && bill ? (
          <div className="space-y-3">
            <p className="text-[length:var(--a-text-sm)] text-a-muted">
              {bill.number} — {bill.vendorName}
            </p>
            {payError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {payError}
              </p>
            ) : null}
            {rasHint ? (
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                {rasHint}{" "}
                <Link
                  href="/settings#expertise"
                  className="text-a-accent hover:underline"
                >
                  Préférences
                </Link>
              </p>
            ) : null}
            {rasPreviewAmount != null && payForm.applyRas ? (
              <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
                Net estimé :{" "}
                {(
                  Number(payForm.amount.replace(",", ".")) - rasPreviewAmount
                ).toFixed(3)}{" "}
                TND
              </p>
            ) : null}
            {rasPreviewAmount != null ? (
              <div className="flex items-center gap-3">
                <ASwitch
                  size="sm"
                  label="Déduire RAS automatiquement"
                  checked={payForm.applyRas}
                  onCheckedChange={(on) =>
                    setPayForm({ ...payForm, applyRas: on })
                  }
                />
                <span className="text-[length:var(--a-text-sm)]">
                  Déduire RAS automatiquement
                </span>
              </div>
            ) : null}
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Montant base TND * (avant RAS)
              </span>
              <AInput
                value={payForm.amount}
                onChange={(e) =>
                  setPayForm({ ...payForm, amount: e.target.value })
                }
                inputMode="decimal"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Mode
              </span>
              <select
                className="a-underlay w-full rounded-md px-3 py-2 text-[length:var(--a-text-sm)]"
                value={payForm.method}
                onChange={(e) =>
                  setPayForm({ ...payForm, method: e.target.value })
                }
              >
                <option value="BANK_TRANSFER">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="CASH">Espèces</option>
                <option value="OTHER">Autre</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Date
              </span>
              <AInput
                type="date"
                value={payForm.paymentDate}
                onChange={(e) =>
                  setPayForm({ ...payForm, paymentDate: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Référence
              </span>
              <AInput
                value={payForm.reference}
                onChange={(e) =>
                  setPayForm({ ...payForm, reference: e.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setPayOpen(false)}
              >
                {LAYOUT_ACTIONS.cancel}
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submitPay()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
