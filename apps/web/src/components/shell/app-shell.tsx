import type { ReactNode } from "react";
import { CommandPaletteHost } from "./command-palette-host";
import { NotificationsHost } from "./notifications-host";
import { ShellBreadcrumbs } from "./breadcrumbs";
import { FeatureMenu } from "./feature-menu";
import { ShellHeader } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ResourceMonitor } from "./resource-monitor";
import { ShellSidebar } from "./sidebar";
import { SyncModuleFromRoute } from "./sync-module-from-route";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-a-surface-1 text-a-fg">
      <SyncModuleFromRoute />
      <CommandPaletteHost />
      <NotificationsHost />
      <a
        href="#main"
        className="sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[var(--a-z-toast)] focus:block focus:bg-a-accent focus:px-3 focus:py-2 focus:text-a-accent-fg"
      >
        Aller au contenu
      </a>
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
