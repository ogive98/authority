"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { localizeUiString } from "@/lib/i18n/route-labels";
import { useLocaleStore } from "@/stores/locale-store";

export type AScreenHeaderProps = {
  breadcrumb?: ReactNode;
  kicker?: string;
  title: string;
  description?: ReactNode;
  /** @deprecated Prefer `primary` + `more` (D225). Still supported. */
  actions?: ReactNode;
  /** Single page-level primary action (right). */
  primary?: ReactNode;
  /** Overflow / secondary cluster (right of primary). */
  more?: ReactNode;
  /** Optional status chip near title row right before actions. */
  status?: ReactNode;
  sticky?: boolean;
};

/** Soft Glass page title — D225 anatomy. Localizes known FR strings to IT. */
export function AScreenHeader({
  breadcrumb,
  kicker,
  title,
  description,
  actions,
  primary,
  more,
  status,
  sticky = false,
}: AScreenHeaderProps) {
  const locale = useLocaleStore((s) => s.locale);
  const kickerL = localizeUiString(kicker, locale);
  const titleL = localizeUiString(title, locale) ?? title;

  const right =
    primary || more || status || actions ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status}
        {primary}
        {more}
        {!primary && !more ? actions : null}
      </div>
    ) : null;

  return (
    <header
      className={cn(
        "flex flex-col gap-3 px-6 pb-3 pt-5 md:px-8",
        sticky &&
          "sticky top-12 z-[var(--a-z-sticky)] bg-a-surface-1",
      )}
    >
      {breadcrumb ? (
        <div className="text-[12px] text-a-fg-muted">{breadcrumb}</div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kickerL ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-a-fg-subtle">
              {kickerL}
            </p>
          ) : null}
          <h1
            className={cn(
              "text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold tracking-[-0.03em] text-a-fg",
              kickerL && "mt-1",
            )}
          >
            {titleL}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] text-a-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}
