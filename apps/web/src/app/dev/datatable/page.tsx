"use client";

import { useMemo } from "react";
import { ADevPage } from "@/components/a";
import { ADataTableLots } from "@/components/a/a-data-table-lots";
import { buildMockLots } from "@/lib/mock-lots";

export default function DevDataTablePage() {
  const rows = useMemo(() => buildMockLots(1000), []);

  return (
    <ADevPage
      kicker="UI-06 · DataTable"
      title="Lots (1000 mock)"
      description="Cursor pagination · filtres · colonnes · bulk · saved views local"
      mainClassName="mx-auto max-w-6xl px-[var(--a-space-6)] py-[var(--a-space-6)]"
    >
      <ADataTableLots rows={rows} />
    </ADevPage>
  );
}
