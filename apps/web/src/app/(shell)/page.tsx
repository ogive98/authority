"use client";

import { MissionControl } from "@/components/shell/mission-control";

/**
 * Home = Mission Control (D161) — adaptive widgets + module features.
 * Sidebar selects module; dock exposes registry actions.
 */
export default function HomePage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <MissionControl className="min-h-0 flex-1" />
    </div>
  );
}
