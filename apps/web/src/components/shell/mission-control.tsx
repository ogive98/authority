"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { tipsForPage } from "@/lib/tips-catalog";
import { useShellStore } from "@/stores/shell-store";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellT } from "@/stores/locale-store";
import { cn } from "@/lib/utils";
import { ALazySlot } from "@/components/a/a-lazy-slot";
import { ASkeleton } from "@/components/a/a-skeleton";
import { HeroContextWidget, HomeKpiStrip } from "./home-widgets";
import { ModuleFeatureList } from "./module-feature-list";

const DeferredShellStatus = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.ShellStatusWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={4} /> },
);
const DeferredTasks = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.TasksWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={2} /> },
);
const DeferredActivity = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.ActivityWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={4} /> },
);
const DeferredShortcuts = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.ModuleShortcutsWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={4} /> },
);
const DeferredAi = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.AiPanelWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={3} /> },
);
const DeferredTreasury = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.TreasuryWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={4} /> },
);
const DeferredBackup = dynamic(
  () =>
    import("./home-widgets-deferred").then((m) => ({
      default: m.BackupStatusWidget,
    })),
  { ssr: false, loading: () => <ASkeleton lines={4} /> },
);

function WidgetChrome({
  title,
  children,
  className,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={cn(
        "a-card a-stagger-in p-4 md:p-5",
        accent &&
          "ring-1 ring-[color-mix(in_oklab,var(--a-accent)_35%,transparent)]",
        className,
      )}
    >
      {title ? (
        <h3 className="mb-3 text-[length:var(--a-text-xs)] font-medium uppercase tracking-[0.08em] text-a-fg-muted">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Mission Control — D294 layout (live KPIs only; registry-driven modules).
 * D296: hero + KPI immediate; below-fold widgets viewport + dynamic chunk.
 */
export function MissionControl({ className }: { className?: string }) {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry } = useMeRegistry();
  const tip = tipsForPage("/", selectedModuleId, 1)[0] ?? null;
  const mod =
    registry.modules.find((m) => m.key === selectedModuleId) ??
    registry.modules[0];
  const financeOn = registry.modules.some((m) => m.key === "finance");
  const backupOn = registry.modules.some((m) => m.key === "backup");
  const showTreasury = financeOn && selectedModuleId === "finance";
  const showBackup = backupOn && selectedModuleId === "backup";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto p-4 md:gap-5 md:p-6",
        className,
      )}
    >
      <header className="min-w-0">
        <h1 className="text-[clamp(1.5rem,2.5vw,1.875rem)] font-medium tracking-[-0.03em] text-a-fg">
          {t("missionControl")}
        </h1>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {t("operationalOverview")}
        </p>
      </header>

      <HeroContextWidget />

      <HomeKpiStrip />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-7 lg:gap-5">
          {showTreasury ? (
            <WidgetChrome title={t("widgetTreasury")}>
              <ALazySlot name={t("widgetTreasury")} strategy="viewport">
                <DeferredTreasury />
              </ALazySlot>
            </WidgetChrome>
          ) : null}

          {showBackup ? (
            <WidgetChrome title={t("widgetBackup")}>
              <ALazySlot name={t("widgetBackup")} strategy="viewport">
                <DeferredBackup />
              </ALazySlot>
            </WidgetChrome>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <WidgetChrome title={t("widgetShellStatus")}>
              <ALazySlot name={t("widgetShellStatus")} strategy="viewport">
                <DeferredShellStatus />
              </ALazySlot>
            </WidgetChrome>
            <WidgetChrome title={t("widgetTasks")}>
              <ALazySlot
                name={t("widgetTasks")}
                strategy="viewport"
                skeletonLines={2}
              >
                <DeferredTasks />
              </ALazySlot>
            </WidgetChrome>
          </div>

          <WidgetChrome title={t("widgetActivity")}>
            <ALazySlot name={t("widgetActivity")} strategy="viewport">
              <DeferredActivity />
            </ALazySlot>
          </WidgetChrome>

          <WidgetChrome title={t("widgetShortcuts")}>
            <ALazySlot name={t("widgetShortcuts")} strategy="viewport">
              <DeferredShortcuts />
            </ALazySlot>
          </WidgetChrome>

          <WidgetChrome title={t("widgetAi")} accent>
            <ALazySlot name={t("widgetAi")} strategy="viewport" skeletonLines={3}>
              <DeferredAi />
            </ALazySlot>
          </WidgetChrome>

          {tip ? (
            <p className="px-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
              <span className="font-medium text-a-fg">{t("tipPrefix")} · </span>
              {tip.title}
              {tip.body
                ? ` — ${tip.body.length > 120 ? `${tip.body.slice(0, 117)}…` : tip.body}`
                : null}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-[0.08em] text-a-fg-muted">
              {t("featuresPrefix")} · {mod?.name ?? "Module"}
            </h3>
            <Link
              href="/settings"
              className="text-[length:var(--a-text-xs)] text-a-accent hover:underline"
            >
              {t("preferences")}
            </Link>
          </div>
          <div className="a-card min-h-[min(52vh,28rem)] flex-1 overflow-hidden">
            <ModuleFeatureList
              className="h-full min-h-0"
              variant="embedded"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
