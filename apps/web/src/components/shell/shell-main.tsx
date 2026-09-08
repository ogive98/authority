"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Main column — Launchpad locks height (no page scroll);
 * feature pages keep overflow scroll.
 */
export function ShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLaunchpad = pathname === "/";

  return (
    <main
      id="main"
      className={cn(
        "min-h-0 flex-1",
        isLaunchpad ? "overflow-hidden" : "overflow-auto",
      )}
    >
      {children}
    </main>
  );
}
