"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState } from "react";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { createIdempotencyKey } from "@/lib/idempotency";
import { useUiT } from "@/lib/i18n/route-labels";
import { cn } from "@/lib/utils";

export type ConfirmRisk = "stock" | "money" | "destroy" | "send" | "generic";

export type AConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: ConfirmRisk;
  /** Human consequence line (stock/money wording). */
  consequence: string;
  /** Optional phrase the user must type to unlock confirm. */
  confirmPhrase?: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (idempotencyKey: string) => void | Promise<void>;
};

const DEFAULT_TITLES: Record<ConfirmRisk, string> = {
  stock: "Confirmer un mouvement de stock",
  money: "Confirmer un montant",
  destroy: "Confirmer la destruction",
  send: "Confirmer l’envoi",
  generic: "Confirmer",
};

/**
 * Risk-adapted confirm. Stock/money require explicit wording.
 * Generates Idempotency-Key once per open intent.
 */
export function AConfirmDialog({
  open,
  onOpenChange,
  risk,
  consequence,
  confirmPhrase,
  title,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
}: AConfirmDialogProps) {
  const { t } = useUiT();
  const phraseId = useId();
  const [typed, setTyped] = useState("");
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped("");
      setIdemKey(createIdempotencyKey("confirm"));
      setBusy(false);
    }
  }, [open]);

  const needsType = Boolean(confirmPhrase);
  const unlocked = !needsType || typed.trim() === confirmPhrase;
  const isDanger = risk === "stock" || risk === "money" || risk === "destroy";
  const resolvedTitle = t(title ?? DEFAULT_TITLES[risk]);
  const resolvedConfirm = t(confirmLabel);
  const resolvedCancel = t(cancelLabel);

  async function handleConfirm() {
    if (!unlocked || !idemKey || busy) return;
    setBusy(true);
    try {
      await onConfirm(idemKey);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--a-z-modal)] bg-a-surface-1/70" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-[var(--a-z-modal)] w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2",
            "a-glass-strong rounded-[var(--a-radius-lg)] p-5 focus:outline-none shadow-[var(--a-shadow-panel)]",
          )}
        >
          <Dialog.Title className="text-[length:var(--a-text-lg)] font-medium">
            {resolvedTitle}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
            {consequence}
          </Dialog.Description>

          {(risk === "stock" || risk === "money") && (
            <p className="mt-3 text-[length:var(--a-text-xs)] font-medium text-a-warning">
              {risk === "stock"
                ? t(
                    "Impact stock — irréversible sans correction d’inventaire.",
                  )
                : t(
                    "Impact financier (TND) — vérifiez le montant avant confirmation.",
                  )}
            </p>
          )}

          {needsType && confirmPhrase ? (
            <div className="mt-4 space-y-1.5">
              <label
                htmlFor={phraseId}
                className="text-[length:var(--a-text-sm)] text-a-fg"
              >
                {t("Tapez")}{" "}
                <span className="a-mono font-medium text-a-fg">{confirmPhrase}</span>{" "}
                {t("pour confirmer")}
              </label>
              <AInput
                id={phraseId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>
          ) : null}

          {idemKey ? (
            <p className="a-mono mt-3 text-[length:var(--a-text-xs)] text-a-fg-subtle">
              Idempotency-Key: {idemKey}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <AButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {resolvedCancel}
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant={isDanger ? "danger" : "primary"}
              disabled={!unlocked || busy}
              onClick={() => void handleConfirm()}
            >
              {resolvedConfirm}
            </AButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
