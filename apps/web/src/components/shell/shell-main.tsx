"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Main column — home `/` locks outer scroll (list scrolls inside);
 * feature pages keep overflow scroll.
 */
export function ShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <main
      id="main"
      className={cn(
        "min-h-0 flex-1",
        isHome ? "overflow-hidden" : "overflow-auto",
      )}
    >
      {children}
    </main>
  );
}
