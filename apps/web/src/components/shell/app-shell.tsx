import type { ReactNode } from "react";
import { ASkipLink } from "@/components/a/a-skip-link";
import { CommandPaletteHost } from "./command-palette-host";
import { NotificationsHost } from "./notifications-host";
import { ShellBreadcrumbs } from "./breadcrumbs";
import { ShellHeader } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ResourceMonitor } from "./resource-monitor";
import { ShellSidebar } from "./sidebar";
import { PrefsHydrator } from "./prefs-hydrator";
import { SpectreOverlay } from "./spectre-overlay";
import { SyncModuleFromRoute } from "./sync-module-from-route";
import { ShellMain } from "./shell-main";
import { FloatingToolbox } from "./floating-toolbox";

/**
 * Contiental Apple shell — Finder sidebar + Launchpad (viewport = sidebar height).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="a-canvas flex h-dvh overflow-hidden text-a-fg">
      <SyncModuleFromRoute />
      <PrefsHydrator />
      <CommandPaletteHost />
      <NotificationsHost />
      <SpectreOverlay />
      <ASkipLink />
      <ShellSidebar />
      <div className="flex h-full min-w-0 flex-1 flex-col pb-12 md:pb-0">
        <ShellHeader />
        <ShellBreadcrumbs />
        <ShellMain>{children}</ShellMain>
        <div className="hidden md:block">
          <ResourceMonitor />
        </div>
      </div>
      <FloatingToolbox />
      <MobileBottomNav />
    </div>
  );
}
