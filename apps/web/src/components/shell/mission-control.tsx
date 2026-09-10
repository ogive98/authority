"use client";

import Link from "next/link";
import { tipsForPage } from "@/lib/tips-catalog";
import { HOME_WIDGETS } from "@/lib/widget-catalog";
import { useShellStore } from "@/stores/shell-store";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellT } from "@/stores/locale-store";
import { cn } from "@/lib/utils";
import {
  ActivityWidget,
  AiPanelWidget,
  HeroContextWidget,
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
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-a-fg-subtle">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function KpiEmptyCard({ label }: { label: string }) {
  const { t } = useShellT();
  return (
    <div className="a-glass a-stagger-in flex min-h-[7.5rem] flex-col justify-between rounded-[1.25rem] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-a-fg-subtle">
        {label}
      </p>
      <div>
        <p className="a-mono text-[1.5rem] font-semibold tracking-tight text-a-fg-subtle">
          —
        </p>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          {t("kpiEmpty")}
        </p>
      </div>
      <div className="mt-3 h-8 rounded-lg bg-a-surface-3/60 a-shimmer" aria-hidden />
    </div>
  );
}

/**
 * Mission Control (D162) — maquette layout, empty KPIs + wired widgets.
 */
export function MissionControl({ className }: { className?: string }) {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry } = useMeRegistry();
  const tip = tipsForPage("/", selectedModuleId, 1)[0] ?? null;
  const mod =
    registry.modules.find((m) => m.key === selectedModuleId) ??
    registry.modules[0];

  const titles = Object.fromEntries(HOME_WIDGETS.map((w) => [w.id, w.title]));

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiEmptyCard label={t("kpiRevenue")} />
        <KpiEmptyCard label={t("kpiOrders")} />
        <KpiEmptyCard label={t("kpiStock")} />
        <KpiEmptyCard label={t("kpiEfficiency")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-7 lg:gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <WidgetChrome title={titles["shell-status"] ?? t("system")}>
              <ShellStatusWidget />
            </WidgetChrome>
            <WidgetChrome title={titles["tasks"] ?? "Tasks"}>
              <TasksWidget />
            </WidgetChrome>
          </div>

          <WidgetChrome title={titles["module-shortcuts"] ?? t("shortcuts")}>
            <ModuleShortcutsWidget />
          </WidgetChrome>

          <div className="grid gap-4 sm:grid-cols-2">
            <WidgetChrome title={titles["activity"] ?? "Activity"}>
              <ActivityWidget />
            </WidgetChrome>
            <WidgetChrome title={titles["ai-panel"] ?? "IA"} accent>
              <AiPanelWidget />
            </WidgetChrome>
          </div>

          {tip ? (
            <p className="px-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
              <span className="font-medium text-a-fg">Astuce · </span>
              {tip.title}
              {tip.body
                ? ` — ${tip.body.length > 120 ? `${tip.body.slice(0, 117)}…` : tip.body}`
                : null}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-5">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-a-fg-subtle">
              Features · {mod?.name ?? "Module"}
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
