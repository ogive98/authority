"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ADetailGridProps = {
  primary: ReactNode;
  context?: ReactNode;
  below?: ReactNode;
  className?: string;
};

/**
 * Detail layout — primary workspace + optional in-page context column (D225).
 * Context is NOT the Smart Action Dock.
 */
export function ADetailGrid({
  primary,
  context,
  below,
  className,
}: ADetailGridProps) {
  return (
    <div className={cn("space-y-5", className)}>
      <div
        className={cn(
          "grid gap-5",
          context && "lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]",
        )}
      >
        <div className="min-w-0 space-y-5">{primary}</div>
        {context ? (
          <aside className="min-w-0 space-y-5 lg:sticky lg:top-16 lg:self-start">
            {context}
          </aside>
        ) : null}
      </div>
      {below ? <div className="min-w-0 space-y-5">{below}</div> : null}
    </div>
  );
}
