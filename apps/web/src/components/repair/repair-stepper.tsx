"use client";

import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Loader2,
  Search,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RepairStepperPhase =
  | "idle"
  | "analysis"
  | "backup"
  | "repair"
  | "verify"
  | "result";

const STEPS: Array<{
  id: RepairStepperPhase;
  label: string;
  icon: typeof Search;
}> = [
  { id: "analysis", label: "Analyse", icon: Search },
  { id: "backup", label: "Backup", icon: Camera },
  { id: "repair", label: "Réparation", icon: Wrench },
  { id: "verify", label: "Vérification", icon: BadgeCheck },
  { id: "result", label: "Résultat", icon: CheckCircle2 },
];

const ORDER: RepairStepperPhase[] = [
  "analysis",
  "backup",
  "repair",
  "verify",
  "result",
];

type Props = {
  phase: RepairStepperPhase;
  progress: number;
  running?: boolean;
  scenarioId?: string | null;
  risk?: string | null;
  stepsLog?: string[];
};

/** Centre de réparation — stepper animé (sentiment de réparation). */
export function RepairStepper({
  phase,
  progress,
  running,
  scenarioId,
  risk,
  stepsLog = [],
}: Props) {
  const activeIdx = ORDER.indexOf(phase === "idle" ? "analysis" : phase);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = phase !== "idle" && i < activeIdx;
          const active = phase === step.id || (phase === "idle" && i === 0 && false);
          const isCurrent = phase === step.id;
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[length:var(--a-text-sm)] transition-colors",
                  isCurrent
                    ? "bg-a-accent-muted text-a-accent-hover"
                    : done
                      ? "bg-a-success-soft text-a-success-fg"
                      : "bg-a-surface-3 text-a-fg-muted",
                )}
              >
                {isCurrent && running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {step.label}
              </div>
              {i < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "h-0.5 w-6 rounded-full",
                    done || isCurrent ? "bg-a-accent" : "bg-a-surface-4",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="a-underlay rounded-md space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[length:var(--a-text-sm)] font-medium">
              Progression
            </p>
            <span className="a-mono text-[length:var(--a-text-sm)] tabular-nums text-a-fg-muted">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-a-surface-3">
            <div
              className="repair-progress-bar h-full rounded-full bg-a-accent transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
            />
          </div>
          <ul className="space-y-2">
            {(stepsLog.length ? stepsLog : ["En attente d’un plan…"]).map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                <CheckCircle2
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    running ? "text-a-accent" : "text-a-success",
                  )}
                  strokeWidth={1.75}
                />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="a-underlay rounded-md flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg viewBox="0 0 96 96" className="absolute inset-0 -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="var(--a-surface-4)"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="var(--a-accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={
                  2 * Math.PI * 40 * (1 - Math.min(100, progress) / 100)
                }
                className="transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <span className="a-mono text-[length:var(--a-text-xl)] font-semibold tabular-nums">
              {Math.round(progress)}
            </span>
          </div>
          <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
            {scenarioId ?? "aucun scénario"}
          </p>
          {risk ? (
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Risque · <span className="font-medium text-a-fg">{risk}</span>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
