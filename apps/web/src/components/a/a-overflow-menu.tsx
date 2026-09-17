"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { AButton } from "@/components/a/a-button";
import { cn } from "@/lib/utils";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";

export type AOverflowItem = {
  id: string;
  label: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export type AOverflowMenuProps = {
  items: AOverflowItem[];
  label?: string;
  className?: string;
  align?: "start" | "end";
};

/** Tertiary actions — D225 `•••` overflow (opaque underlay panel). */
export function AOverflowMenu({
  items,
  label = LAYOUT_ACTIONS.more,
  className,
  align = "end",
}: AOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <AButton
        type="button"
        variant="secondary"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="min-w-9 px-2"
      >
        {label === LAYOUT_ACTIONS.more ? (
          <MoreHorizontal className="size-4" aria-hidden />
        ) : (
          label
        )}
        <span className="sr-only">Plus d’actions</span>
      </AButton>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={cn(
            "a-underlay absolute z-[var(--a-z-popover,40)] mt-1 min-w-[11rem] py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-[length:var(--a-text-sm)] transition-colors",
                  item.danger
                    ? "text-a-danger hover:bg-a-surface-3/70"
                    : "text-a-fg hover:bg-a-surface-3/70",
                  item.disabled && "opacity-50",
                )}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect?.();
                  close();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
