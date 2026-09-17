"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AButton } from "@/components/a/a-button";
import { useUiT } from "@/lib/i18n/route-labels";
import { cn } from "@/lib/utils";

export type ADialogSize = "sm" | "md" | "lg";

export type ADialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ADialogSize;
  /** Show close icon (top-right). Default true. */
  showClose?: boolean;
  className?: string;
};

const SIZE_CLASS: Record<ADialogSize, string> = {
  sm: "w-[min(100%-2rem,24rem)]",
  md: "w-[min(100%-2rem,32rem)]",
  lg: "w-[min(100%-2rem,42rem)]",
};

/**
 * D294 general modal — opaque surface, zero frame chrome.
 * Risk/idempotent confirms → use `AConfirmDialog` instead.
 */
export function ADialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  showClose = true,
  className,
}: ADialogProps) {
  const { t } = useUiT();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--a-z-modal)] bg-a-fg/40 data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-[var(--a-z-modal)] max-h-[min(90vh,40rem)] -translate-x-1/2 -translate-y-1/2",
            "a-glass-strong flex flex-col rounded-[var(--a-radius-lg)] p-5 shadow-[var(--a-shadow-panel)] focus:outline-none",
            SIZE_CLASS[size],
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[length:var(--a-text-lg)] font-medium tracking-[var(--a-tracking-title)]">
                {t(title)}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  {t(description)}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  {t(title)}
                </Dialog.Description>
              )}
            </div>
            {showClose ? (
              <AButton
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("Fermer")}
                className="shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" aria-hidden />
              </AButton>
            ) : null}
          </div>

          {children ? (
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">{children}</div>
          ) : null}

          {footer ? (
            <div className="mt-5 flex shrink-0 flex-wrap justify-end gap-2">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
