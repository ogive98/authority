"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ADrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional footer actions */
  footer?: ReactNode;
  className?: string;
};

/** Right-side fiche drawer — focus trap via Radix. */
export function ADrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ADrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--a-z-modal)] bg-a-surface-1/70 data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-[var(--a-z-modal)] flex w-full max-w-md flex-col border-l border-a-border-subtle bg-a-surface-2 shadow-none",
            "focus:outline-none",
            className,
          )}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-a-border-subtle px-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[length:var(--a-text-md)] font-semibold">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">
                  Panneau latéral
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--a-radius-md)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-a-border-subtle p-4">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
