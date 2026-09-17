"use client";

import { softChipClass, softUnderlineTabClass } from "@/lib/soft-glass-ui";
import { useUiT } from "@/lib/i18n/route-labels";
import { cn } from "@/lib/utils";

export type ATabItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type ATabsVariant = "chip" | "underline";

export type ATabsProps = {
  items: readonly ATabItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** Accessible name for the tablist. */
  ariaLabel: string;
  /**
   * `chip` — Soft Glass filter/section chips (default, matches ERP lists).
   * `underline` — quiet underline (D228) for denser section rows.
   */
  variant?: ATabsVariant;
  className?: string;
};

/**
 * D294 tabs — chip filters (default) or underline section tabs.
 */
export function ATabs({
  items,
  value,
  onValueChange,
  ariaLabel,
  variant = "chip",
  className,
}: ATabsProps) {
  const { t } = useUiT();
  const tabClass = variant === "underline" ? softUnderlineTabClass : softChipClass;

  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="tablist"
      aria-label={t(ariaLabel)}
    >
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            id={`a-tab-${item.id}`}
            onClick={() => {
              if (!item.disabled) onValueChange(item.id);
            }}
            className={tabClass(active)}
          >
            {t(item.label)}
          </button>
        );
      })}
    </div>
  );
}
