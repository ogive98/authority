"use client";

import { ModuleAppsGrid } from "@/components/shell/module-apps-grid";

/**
 * Home = Launchpad viewport (aligned with sidebar / Déconnexion).
 * Extra content = iOS-style page dots inside ModuleAppsGrid.
 */
export default function HomePage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ModuleAppsGrid className="min-h-0 flex-1" />
    </div>
  );
}
