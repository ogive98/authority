"use client";

import Link from "next/link";
import { tipsForPage } from "@/lib/tips-catalog";
import { useShellStore } from "@/stores/shell-store";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellT } from "@/stores/locale-store";
import { cn } from "@/lib/utils";
import {
  ActivityWidget,
  AiPanelWidget,
  HeroContextWidget,
  HomeKpiStrip,
  ModuleShortcutsWidget,
  ShellStatusWidget,
  TasksWidget,
} from "./home-widgets";
import { ModuleFeatureList } from "./module-feature-list";

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
        "a-glass a-stagger-in rounded-[1.25rem] p-4 md:p-5",
        accent &&
          "ring-1 ring-[color-mix(in_oklab,var(--a-violet)_35%,transparent)]",
        className,
      )}
    >
      {title ? (
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f97316]">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Mission Control (D168) — KPIs scoped to selected module + i18n chrome.
 */
export function MissionControl({ className }: { className?: string }) {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry } = useMeRegistry();
  const tip = tipsForPage("/", selectedModuleId, 1)[0] ?? null;
  const mod =
    registry.modules.find((m) => m.key === selectedModuleId) ??
    registry.modules[0];

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto p-4 md:gap-5 md:p-6",
        className,
      )}
    >
      <WidgetChrome title="" className="a-glass-strong relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--a-accent) 28%, transparent), transparent 55%), radial-gradient(ellipse at 90% 40%, color-mix(in srgb, var(--a-accent-2) 18%, transparent), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative">
          <HeroContextWidget />
        </div>
      </WidgetChrome>

      <HomeKpiStrip />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-7 lg:gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <WidgetChrome title={t("widgetShellStatus")}>
              <ShellStatusWidget />
            </WidgetChrome>
            <WidgetChrome title={t("widgetTasks")}>
              <TasksWidget />
            </WidgetChrome>
          </div>

          <WidgetChrome title={t("widgetShortcuts")}>
            <ModuleShortcutsWidget />
          </WidgetChrome>

          <div className="grid gap-4 sm:grid-cols-2">
            <WidgetChrome title={t("widgetActivity")}>
              <ActivityWidget />
            </WidgetChrome>
            <WidgetChrome title={t("widgetAi")} accent>
              <AiPanelWidget />
            </WidgetChrome>
          </div>

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
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f97316]">
              {t("featuresPrefix")} · {mod?.name ?? "Module"}
            </h3>
            <Link
              href="/settings"
              className="text-[length:var(--a-text-xs)] text-a-accent hover:underline"
            >
              {t("preferences")}
            </Link>
          </div>
          <div className="a-glass min-h-[min(52vh,28rem)] flex-1 overflow-hidden rounded-[1.25rem]">
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
