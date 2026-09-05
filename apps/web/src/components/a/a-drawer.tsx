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
        <Dialog.Overlay className="fixed inset-0 z-[var(--a-z-modal)] bg-[#0b1220]/35 backdrop-blur-sm data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            "a-glass-strong fixed inset-y-0 right-0 z-[var(--a-z-modal)] flex w-full max-w-lg flex-col border-l border-a-border-subtle",
            "shadow-[var(--a-shadow-panel)] focus:outline-none",
            className,
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-a-border-subtle px-5">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[length:var(--a-text-md)] font-semibold tracking-tight">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted hover:bg-white/50 hover:text-a-fg"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? (
            <div className="a-glass shrink-0 border-t border-a-border-subtle px-5 py-4">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
