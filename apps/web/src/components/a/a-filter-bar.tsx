"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AFilterBarProps = {
  search?: ReactNode;
  filters?: ReactNode;
  utilities?: ReactNode;
  className?: string;
};

/**
 * List filter row — search left · filters · utilities right (D225).
 */
export function AFilterBar({
  search,
  filters,
  utilities,
  className,
}: AFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        className,
      )}
    >
      {search ? <div className="min-w-[12rem] flex-1">{search}</div> : null}
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}
      {utilities ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {utilities}
        </div>
      ) : null}
    </div>
  );
}
