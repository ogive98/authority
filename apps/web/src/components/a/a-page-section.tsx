"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { softPanel } from "@/lib/d294-ui";

export type APageSectionProps = {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bare?: boolean;
};

/** One section = one business question (D294). Opaque card when not bare. */
export function APageSection({
  title,
  description,
  action,
  children,
  className,
  bare = false,
}: APageSectionProps) {
  const body = (
    <>
      {title || action || description ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-[length:var(--a-text-md)] font-medium tracking-[-0.01em] text-a-fg">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[length:var(--a-text-sm)] text-a-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {action}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </>
  );

  if (bare) {
    return <section className={cn("space-y-3", className)}>{body}</section>;
  }

  return <section className={cn(softPanel, className)}>{body}</section>;
}
