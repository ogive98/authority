"use client";

import { ASwitch } from "@/components/a";
import {
  FULFILLMENT_DOC_LABELS,
  type FulfillmentDoc,
} from "@/lib/customers";

type Props = {
  value: FulfillmentDoc;
  onChange: (next: FulfillmentDoc) => void;
  hint?: string;
};

/** D262 — title only (same finance document, AR/GL/modes unchanged). */
export function FulfillmentDocToggle({ value, onChange, hint }: Props) {
  const invoice = value === "INVOICE";
  return (
    <div>
      <p className="mb-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
        Document
      </p>
      {hint ? (
        <p className="mb-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={
            invoice
              ? "text-[length:var(--a-text-sm)] text-a-fg-muted"
              : "text-[length:var(--a-text-sm)] font-medium"
          }
        >
          {FULFILLMENT_DOC_LABELS.DELIVERY_NOTE}
        </span>
        <ASwitch
          size="sm"
          label="Titre du document : bon de livraison ou facture"
          checked={invoice}
          onCheckedChange={(on) =>
            onChange(on ? "INVOICE" : "DELIVERY_NOTE")
          }
        />
        <span
          className={
            invoice
              ? "text-[length:var(--a-text-sm)] font-medium"
              : "text-[length:var(--a-text-sm)] text-a-fg-muted"
          }
        >
          {FULFILLMENT_DOC_LABELS.INVOICE}
        </span>
      </div>
    </div>
  );
}
