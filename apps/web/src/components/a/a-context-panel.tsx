"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { softPanel } from "@/lib/soft-glass-ui";

export type AContextPanelProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

/**
 * In-page record/workflow context (280–360px). Never replaces Smart Action Dock.
 */
export function AContextPanel({
  title,
  children,
  className,
}: AContextPanelProps) {
  return (
    <aside
      className={cn(
        softPanel,
        "w-full max-w-[22.5rem]",
        className,
      )}
    >
      {title ? (
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-a-fg-muted">
          {title}
        </h2>
      ) : null}
      {children}
    </aside>
  );
}
