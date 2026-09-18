"use client";

/**
 * Viewport-gated widget slot (D296) — same pattern as AWidgetHost WidgetSlot.
 * Defers children until near viewport; isolates failures with AWidgetBoundary.
 */
import type { ReactNode } from "react";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import { ASkeleton } from "./a-skeleton";
import { AWidgetBoundary } from "./a-widget-boundary";

export type ALazySlotProps = {
  name: string;
  /** immediate = mount now; viewport = wait for IntersectionObserver */
  strategy?: "immediate" | "viewport";
  className?: string;
  skeletonLines?: number;
  children: ReactNode;
};

export function ALazySlot({
  name,
  strategy = "viewport",
  className,
  skeletonLines = 4,
  children,
}: ALazySlotProps) {
  const lazy = strategy === "viewport";
  const { ref, inView } = useInView<HTMLDivElement>(lazy);

  return (
    <div ref={ref} className={cn("min-h-0", className)}>
      {lazy && !inView ? (
        <ASkeleton lines={skeletonLines} />
      ) : (
        <AWidgetBoundary name={name}>
          {children}
        </AWidgetBoundary>
      )}
    </div>
  );
}
