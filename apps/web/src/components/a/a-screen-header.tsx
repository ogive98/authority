"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { localizeUiString } from "@/lib/i18n/route-labels";
import { useLocaleStore } from "@/stores/locale-store";

export type AScreenHeaderProps = {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
};

/** Soft Glass page title — no chrome frame. Localizes known FR strings to IT. */
export function AScreenHeader({
  kicker,
  title,
  description,
  actions,
  sticky = false,
}: AScreenHeaderProps) {
  const locale = useLocaleStore((s) => s.locale);
  const kickerL = localizeUiString(kicker, locale);
  const titleL = localizeUiString(title, locale) ?? title;

  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 px-6 pb-3 pt-5 md:px-8",
        sticky &&
          "sticky top-12 z-[var(--a-z-sticky)] bg-[var(--a-gradient-canvas)]/80 backdrop-blur-xl",
      )}
    >
      <div className="min-w-0">
        {kickerL ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-a-fg-subtle">
            {kickerL}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-[22px] font-semibold tracking-[-0.022em] text-a-fg",
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
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
