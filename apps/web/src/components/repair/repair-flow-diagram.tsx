"use client";

import {
  Database,
  FileStack,
  HardDrive,
  Radar,
  Server,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCES = [
  { label: "App", icon: Server },
  { label: "Postgres", icon: Database },
  { label: "Redis", icon: HardDrive },
  { label: "Files", icon: FileStack },
];

const FLOW = [
  { label: "Scan", icon: Radar },
  { label: "Detect", icon: Workflow },
  { label: "Match", icon: Workflow },
  { label: "Act", icon: Workflow },
  { label: "Verify", icon: Workflow },
  { label: "Report", icon: Workflow },
];

type Props = {
  danger?: boolean;
};

/** Full-bleed animated ops flow — no nested frames. */
export function RepairFlowDiagram({ danger }: Props) {
  return (
    <section className="relative overflow-hidden rounded-[var(--a-radius-lg)] bg-[var(--a-gradient-canvas)] px-4 py-6 sm:px-6">
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-40 blur-3xl",
          danger ? "bg-a-danger/40 repair-spark" : "bg-a-accent/30",
        )}
        aria-hidden
      />
      <div className="relative z-[1] mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            Flux live
          </p>
          <h2 className="text-[length:var(--a-text-lg)] font-medium tracking-tight">
            Orchestration Thunder
          </h2>
        </div>
        <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
          HOW only · pas de mutation métier
        </p>
      </div>

      <div className="relative z-[1] mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
          Sources
        </span>
        {SOURCES.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            <s.icon className="h-3.5 w-3.5 text-a-accent" strokeWidth={1.75} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative z-[1]">
        <div
          className={cn(
            "absolute left-4 right-4 top-[28px] hidden h-1 rounded-full sm:block",
            danger ? "bg-a-danger/25" : "bg-a-accent/20",
          )}
          aria-hidden
        >
          <div
            className={cn(
              "repair-flow-runner h-full w-1/3 rounded-full",
              danger ? "bg-a-danger" : "bg-a-accent",
            )}
          />
        </div>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-6 sm:gap-2">
          {FLOW.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className="relative flex flex-col items-center gap-2 text-center"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span
                  className={cn(
                    "repair-flow-node flex h-14 w-14 items-center justify-center rounded-full",
                    danger
                      ? "bg-a-danger text-white"
                      : "bg-a-accent text-a-accent-fg",
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <span className="text-[length:var(--a-text-sm)] font-medium">
                  {step.label}
                </span>
                <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
