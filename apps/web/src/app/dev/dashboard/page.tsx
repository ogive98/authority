"use client";

import { ADevPage } from "@/components/a";
import { AWidgetHost } from "@/components/a/a-widget-host";

export default function DevDashboardPage() {
  return (
    <ADevPage
      kicker="UI-10 · WidgetHost"
      title="Dashboard + isolation"
      description="Gate : le widget cassé n’abat pas la page. Jobs / audit / boom = lazy viewport + dynamic import. LB : shed P4 dans monitor."
    >
      <AWidgetHost includeBoom />
      <p className="mt-8 max-w-lg text-[length:var(--a-text-xs)] text-a-fg-subtle">
        Faites défiler : les widgets viewport ne chargent le chunk que
        lorsqu’ils approchent. Reorder ↑↓ persisté (localStorage).
      </p>
      <div className="h-[40vh]" aria-hidden />
    </ADevPage>
  );
}
