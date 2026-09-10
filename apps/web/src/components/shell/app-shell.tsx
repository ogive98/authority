import type { ReactNode } from "react";
import { ASkipLink } from "@/components/a/a-skip-link";
import { CommandPaletteHost } from "./command-palette-host";
import { NotificationsHost } from "./notifications-host";
import { ShellBreadcrumbs } from "./breadcrumbs";
import { ShellHeader } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ShellSidebar } from "./sidebar";
import { PrefsHydrator } from "./prefs-hydrator";
import { OpsModeOverlays } from "./ops-mode-overlays";
import { SyncModuleFromRoute } from "./sync-module-from-route";
import { ShellMain } from "./shell-main";
import { FloatingToolbox } from "./floating-toolbox";
import { SmartActionDock } from "./smart-action-dock";

/**
 * Enterprise OS shell (D184) — topbar; sidebar + main + dock (online/sync/resources).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="a-canvas flex h-dvh flex-col overflow-hidden text-a-fg">
      <SyncModuleFromRoute />
      <PrefsHydrator />
      <CommandPaletteHost />
      <NotificationsHost />
      <OpsModeOverlays />
      <ASkipLink />
      <ShellHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden pb-12 md:pb-0">
        <ShellSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ShellBreadcrumbs />
          <ShellMain>{children}</ShellMain>
        </div>
        <SmartActionDock />
      </div>
      <FloatingToolbox />
      <MobileBottomNav />
    </div>
  );
}
