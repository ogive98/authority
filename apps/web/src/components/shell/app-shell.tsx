import type { ReactNode } from "react";
import { ASkipLink } from "@/components/a/a-skip-link";
import { CommandPaletteHost } from "./command-palette-host";
import { NotificationsHost } from "./notifications-host";
import { ShellBreadcrumbs } from "./breadcrumbs";
import { FeatureMenu } from "./feature-menu";
import { ShellHeader } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ResourceMonitor } from "./resource-monitor";
import { ShellSidebar } from "./sidebar";
import { PrefsHydrator } from "./prefs-hydrator";
import { SpectreOverlay } from "./spectre-overlay";
import { SyncModuleFromRoute } from "./sync-module-from-route";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-a-surface-1 text-a-fg">
      <SyncModuleFromRoute />
      <PrefsHydrator />
      <CommandPaletteHost />
      <NotificationsHost />
      <SpectreOverlay />
      <ASkipLink />
      <ShellSidebar />
      <FeatureMenu />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-12 md:pb-0">
        <ShellHeader />
        <ShellBreadcrumbs />
        <main id="main" className="min-h-0 flex-1 overflow-auto">
          {children}
        </main>
        <div className="hidden md:block">
          <ResourceMonitor />
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
