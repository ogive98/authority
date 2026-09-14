"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  PORTAL_API,
  PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH,
  portalPaymentMethodLabel,
  type PortalOpenItem,
  type PortalPaymentMethod,
} from "@/lib/customer-portal";

const METHODS: PortalPaymentMethod[] = [
  "BANK_TRANSFER",
  "CASH",
  "CHEQUE",
  "BILL_OF_EXCHANGE",
  "CARD",
  "OTHER",
];

export function PortalNewPaymentDeclarationForm({
  openItems,
}: {
  openItems: PortalOpenItem[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PortalPaymentMethod>("BANK_TRANSFER");
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [openItemId, setOpenItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Montant positif obligatoire.");
      return;
    }
    if (!paymentDate) {
      setError("Date de paiement obligatoire.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(PORTAL_API.financePaymentDeclarations, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parsed,
          method,
          paymentDate,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          openItemId: openItemId || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(body.message ?? `Erreur HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      router.push(
        body.id
          ? `${PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}/${body.id}`
          : PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH,
      );
      router.refresh();
    } catch {
      setError("Réseau indisponible.");
      setBusy(false);
    }
  }

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Déclarer un paiement"
        description="Signalez un paiement déjà effectué. L’ADV le prendra en compte — aucun encaissement automatique."
        actions={
          <Link
            href={PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Déclarations
          </Link>
        }
      />
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mx-auto max-w-xl space-y-4 px-[var(--a-space-6)] py-[var(--a-space-5)]"
      >
        <div className="space-y-1">
          <label
            htmlFor="ppd-amount"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Montant (TND)
          </label>
          <AInput
            id="ppd-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.000"
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="ppd-method"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Mode
          </label>
          <select
            id="ppd-method"
            value={method}
            onChange={(e) =>
              setMethod(e.target.value as PortalPaymentMethod)
            }
            className="w-full rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {portalPaymentMethodLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="ppd-date"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Date de paiement
          </label>
          <AInput
            id="ppd-date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="ppd-ref"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Référence (optionnel)
          </label>
          <AInput
            id="ppd-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="N° virement / chèque"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="ppd-oi"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Créance concernée (optionnel)
          </label>
          <select
            id="ppd-oi"
            value={openItemId}
            onChange={(e) => setOpenItemId(e.target.value)}
            className="w-full rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
          >
            <option value="">— Aucune —</option>
            {openItems.map((oi) => (
              <option key={oi.id} value={oi.id}>
                {oi.number} · {oi.amountOpen} {oi.currency}
                {oi.label ? ` · ${oi.label}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="ppd-notes"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Notes (optionnel)
          </label>
          <textarea
            id="ppd-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-[var(--a-radius-sm)] bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
          />
        </div>

        {error ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">{error}</p>
        ) : null}

        <AButton type="submit" disabled={busy}>
          {busy ? "Envoi…" : "Soumettre"}
        </AButton>
      </form>
    </div>
  );
}
