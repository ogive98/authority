"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ADataTableLots } from "@/components/a/a-data-table-lots";
import { ThemeToggle } from "@/components/shell";
import { buildMockLots } from "@/lib/mock-lots";

export default function DevDataTablePage() {
  const rows = useMemo(() => buildMockLots(1000), []);

  return (
    <div className="min-h-screen bg-a-surface-1 text-a-fg">
      <header className="flex items-center justify-between gap-4 border-b border-a-border-subtle px-[var(--a-space-6)] py-[var(--a-space-4)]">
        <div>
          <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-widest text-a-fg-subtle">
            UI-06 · DataTable
          </p>
          <h1 className="mt-1 text-[length:var(--a-text-xl)] font-semibold">
            Lots (1000 mock)
          </h1>
          <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            Cursor pagination · filtres · colonnes · bulk · saved views local
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-accent"
          >
            Shell
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-[var(--a-space-6)] py-[var(--a-space-6)]">
        <ADataTableLots rows={rows} />
      </main>
    </div>
  );
}
