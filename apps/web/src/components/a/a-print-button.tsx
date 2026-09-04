"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { AButton } from "@/components/a/a-button";
import { createIdempotencyKey } from "@/lib/idempotency";
import { postPrintJob } from "@/lib/print-client";
import type { PrintJob } from "@/lib/print-job-mock";

export type APrintButtonProps = {
  documentId: string;
  reprintOf?: string | null;
  planC?: boolean;
  label?: string;
  disabled?: boolean;
  onJob?: (job: PrintJob) => void;
  onError?: (message: string) => void;
};

/**
 * Official print chrome: enqueue Thunder-shaped print job.
 * Never calls window.print — that remains a user fallback elsewhere.
 */
export function APrintButton({
  documentId,
  reprintOf = null,
  planC = false,
  label,
  disabled,
  onJob,
  onError,
}: APrintButtonProps) {
  const [busy, setBusy] = useState(false);
  const isReprint = Boolean(reprintOf);
  const text = label ?? (isReprint ? "Réimprimer" : "Imprimer");

  async function enqueue() {
    setBusy(true);
    try {
      const job = await postPrintJob({
        documentId,
        idempotencyKey: createIdempotencyKey(isReprint ? "print-reprint" : "print"),
        reprintOf,
        planC,
      });
      onJob?.(job);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Enqueue impression impossible.";
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AButton
      type="button"
      size="sm"
      variant={isReprint ? "secondary" : "primary"}
      disabled={disabled || busy}
      onClick={() => void enqueue()}
    >
      <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      {busy ? "Enqueue…" : text}
    </AButton>
  );
}
