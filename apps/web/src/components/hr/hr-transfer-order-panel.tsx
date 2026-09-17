"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { ABadge, AButton, ASkeleton } from "@/components/a";
import {
  cancelTransferOrder,
  confirmTransferOrder,
  createTransferOrder,
  downloadTransferOrderPdf,
  downloadTransferOrderSepa,
  fetchTransferBankAccounts,
  fetchTransferOrders,
  type TransferBankAccountOption,
  type TransferOrder,
} from "@/lib/hr";
import { softPanel } from "@/lib/d294-ui";

function statusTone(
  status: TransferOrder["status"],
): "neutral" | "warning" | "success" | "danger" {
  if (status === "DRAFT") return "warning";
  if (status === "CONFIRMED") return "success";
  return "neutral";
}

export function HrTransferOrderPanel({ bulletinId }: { bulletinId: string }) {
  const [banks, setBanks] = useState<TransferBankAccountOption[]>([]);
  const [order, setOrder] = useState<TransferOrder | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [banksRes, ordersRes] = await Promise.all([
      fetchTransferBankAccounts(),
      fetchTransferOrders({ bulletinId }),
    ]);
    setLoading(false);
    if (!banksRes.ok) {
      setError(banksRes.message);
      return;
    }
    if (!ordersRes.ok) {
      setError(ordersRes.message);
      return;
    }
    setBanks(banksRes.data.items);
    const active = ordersRes.data.items.find((o) => o.status !== "CANCELLED");
    setOrder(active ?? null);
    const def =
      banksRes.data.items.find((b) => b.isDefault) ?? banksRes.data.items[0];
    if (def) setBankAccountId(def.id);
  }, [bulletinId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    if (!bankAccountId) {
      setError("Sélectionnez un compte bancaire société.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createTransferOrder({ bulletinId, bankAccountId });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setOrder(res.data);
  }

  async function onConfirm() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await confirmTransferOrder(order.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setOrder(res.data);
  }

  async function onCancel() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await cancelTransferOrder(order.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setOrder(null);
  }

  async function onPdf() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await downloadTransferOrderPdf(order.id);
    setBusy(false);
    if (!res.ok) setError(res.message);
  }

  async function onSepa() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await downloadTransferOrderSepa(order.id);
    setBusy(false);
    if (!res.ok) setError(res.message);
  }

  return (
    <section className={`${softPanel} print:hidden space-y-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[length:var(--a-text-base)] font-semibold text-a-fg">
            Ordre de virement
          </h2>
          <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            Montant = net bulletin figé · confirm ADV · décaissement AP Banking ·
            PDF / SEPA pain.001. Pas d’auto-virement · pas de BIC inventé.
          </p>
        </div>
        {order ? (
          <ABadge tone={statusTone(order.status)}>{order.status}</ABadge>
        ) : null}
      </div>

      {loading ? <ASkeleton className="h-16 w-full" /> : null}

      {error ? (
        <p className="text-[length:var(--a-text-sm)] text-a-danger">{error}</p>
      ) : null}

      {!loading && !order ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-[length:var(--a-text-sm)]">
            <span className="text-a-fg-muted">Compte société (débit)</span>
            <select
              className="rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-2 text-a-fg"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              disabled={banks.length === 0 || busy}
            >
              {banks.length === 0 ? (
                <option value="">
                  Aucun compte actif — créer dans Finance › Banking
                </option>
              ) : (
                banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.label}
                    {b.isDefault ? " (défaut)" : ""}
                    {!b.rib ? " — RIB manquant" : ""}
                  </option>
                ))
              )}
            </select>
          </label>
          <AButton
            type="button"
            disabled={busy || !bankAccountId}
            onClick={() => void onCreate()}
          >
            Créer brouillon
          </AButton>
        </div>
      ) : null}

      {!loading && order ? (
        <div className="space-y-3 text-[length:var(--a-text-sm)]">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-a-fg-muted">N°</dt>
              <dd className="a-mono">{order.number}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Montant</dt>
              <dd className="a-mono tabular-nums">
                {order.amount} {order.currency}
              </dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Bénéficiaire</dt>
              <dd>
                {order.beneficiaryName}
                <span className="a-mono ml-2 text-a-fg-muted">
                  {order.beneficiaryBankAccount}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Compte société</dt>
              <dd>
                {order.companyBankLabel}{" "}
                <span className="a-mono text-a-fg-muted">
                  ({order.companyBankCode})
                </span>
                {order.companyBankRib ? (
                  <span className="a-mono ml-2 text-a-fg-muted">
                    {order.companyBankRib}
                  </span>
                ) : (
                  <span className="ml-2 text-a-warning">
                    RIB société manquant
                  </span>
                )}
              </dd>
            </div>
            {order.apPaymentNumber ? (
              <div>
                <dt className="text-a-fg-muted">AP Banking</dt>
                <dd className="a-mono">{order.apPaymentNumber}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-2">
            {order.status === "DRAFT" ? (
              <>
                <AButton
                  type="button"
                  disabled={busy}
                  onClick={() => void onConfirm()}
                >
                  Confirmer ADV
                </AButton>
                <AButton
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void onCancel()}
                >
                  Annuler
                </AButton>
              </>
            ) : null}
            <AButton
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onPdf()}
            >
              <FileDown className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
              PDF ordre
            </AButton>
            {order.status === "CONFIRMED" ? (
              <AButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onSepa()}
              >
                <FileDown className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
                Export SEPA
              </AButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
