"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  FileOutput,
  Radar,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RepairStageId } from "@/lib/repair-control";

export type MissionPhaseId =
  | "scan"
  | "diagnose"
  | "plan"
  | "repair"
  | "report";

const PHASES: Array<{
  id: MissionPhaseId;
  label: string;
  guide: string;
  detail: string;
  icon: LucideIcon;
  stageIds: RepairStageId[];
}> = [
  {
    id: "scan",
    label: "Scan",
    guide: "Collectors allowlistés · aucune mutation",
    detail:
      "Lance les health checkers selon la profondeur choisie. Lecture seule sur Postgres, Redis, workers et registry.",
    icon: Radar,
    stageIds: ["scan"],
  },
  {
    id: "diagnose",
    label: "Diagnose",
    guide: "Finding → signature → risque",
    detail:
      "Fingerprints, matching registry, et classement de risque. Pas d’invention de scénario si match faible.",
    icon: ShieldAlert,
    stageIds: ["finding", "signature", "recommend", "risk"],
  },
  {
    id: "plan",
    label: "Plan",
    guide: "Approbation · snapshot méta",
    detail:
      "Construit un plan versionné. HIGH/BLOCKED restent plan / dry-run. Snapshot = métadonnée locale (pas un backup SOC).",
    icon: ClipboardCheck,
    stageIds: ["plan", "approve", "snapshot"],
  },
  {
    id: "repair",
    label: "Repair",
    guide: "SAFE/LOW · re-auth · pas de fake rollback",
    detail:
      "Dry-run sans side-effect, puis execute allowlisté après mot de passe. Rollback installable BLOCKED jusqu’au Recovery SOC (pas GitHub).",
    icon: Wrench,
    stageIds: ["execute", "verify", "rollback"],
  },
  {
    id: "report",
    label: "Report",
    guide: "Audit local · outbox",
    detail:
      "Journal d’ops et file reporting. Upload Control central encore différé (D060).",
    icon: FileOutput,
    stageIds: ["audit", "report"],
  },
];

export function missionPhaseFromStage(stageId: RepairStageId): MissionPhaseId {
  for (const p of PHASES) {
    if (p.stageIds.includes(stageId)) return p.id;
  }
  return "scan";
}

type Props = {
  activeStageId: RepairStageId;
  reached: Set<RepairStageId>;
  running?: boolean;
  danger?: boolean;
  onSelectPhase: (stageId: RepairStageId) => void;
};

/**
 * Professional ops orbit — one lit animated stage; others muted.
 * Hover expands focus + shows guide panel below (progressive disclosure).
 */
export function RepairMissionRail({
  activeStageId,
  reached,
  running,
  danger,
  onSelectPhase,
}: Props) {
  const activePhase = missionPhaseFromStage(activeStageId);
  const [hoverId, setHoverId] = useState<MissionPhaseId | null>(null);
  const focusId = hoverId ?? activePhase;
  const focus = PHASES.find((p) => p.id === focusId) ?? PHASES[0]!;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            Mission
          </p>
          <p className="text-[length:var(--a-text-lg)] font-medium tracking-tight">
            Pipeline ops
          </p>
        </div>
        <p className="max-w-xs text-right text-[length:var(--a-text-xs)] text-a-fg-subtle">
          Une étape active · survol pour le guide · HOW only
        </p>
      </div>

      <div
        className="relative flex items-center justify-between gap-1 px-1 sm:gap-2"
        role="list"
        aria-label="Phases pipeline"
      >
        <div
          className="pointer-events-none absolute left-[8%] right-[8%] top-1/2 hidden h-px -translate-y-1/2 bg-a-border-subtle sm:block"
          aria-hidden
        />
        {PHASES.map((phase, i) => {
          const Icon = phase.icon;
          const isActive = phase.id === activePhase;
          const isFocus = phase.id === focusId;
          const isDone =
            phase.stageIds.some((s) => reached.has(s)) && !isActive;
          const muted = !isActive && !isDone;

          return (
            <button
              key={phase.id}
              type="button"
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              onClick={() => onSelectPhase(phase.stageIds[0]!)}
              onMouseEnter={() => setHoverId(phase.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(phase.id)}
              onBlur={() => setHoverId(null)}
              className={cn(
                "repair-ops-node group relative z-[1] flex flex-1 flex-col items-center gap-2 rounded-[var(--a-radius-md)] px-1 py-2 transition-all duration-300 outline-none",
                "focus-visible:ring-2 focus-visible:ring-a-accent/40",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-500",
                  isActive &&
                    !danger &&
                    "h-16 w-16 bg-a-accent text-a-accent-fg shadow-[0_10px_28px_color-mix(in_srgb,var(--a-accent)_40%,transparent)] repair-ops-pulse",
                  isActive &&
                    danger &&
                    "h-16 w-16 bg-a-danger text-white shadow-[0_10px_28px_color-mix(in_srgb,var(--a-danger)_45%,transparent)] repair-ops-pulse",
                  !isActive &&
                    isDone &&
                    "h-11 w-11 bg-a-accent-muted text-a-accent-hover",
                  muted &&
                    "h-10 w-10 bg-a-surface-3 text-a-fg-subtle group-hover:h-12 group-hover:w-12 group-hover:text-a-fg-muted",
                  isFocus && !isActive && "scale-105",
                )}
              >
                <Icon
                  className={cn(
                    "transition-transform duration-500",
                    isActive ? "h-7 w-7" : "h-5 w-5",
                    isActive && running && "animate-pulse",
                    isFocus && !isActive && "scale-110",
                  )}
                  strokeWidth={isActive ? 2 : 1.5}
                />
              </span>
              <span className="flex flex-col items-center gap-0.5 text-center">
                <span
                  className={cn(
                    "a-mono text-[length:var(--a-text-xs)]",
                    isActive ? "text-a-accent-hover" : "text-a-fg-subtle",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "text-[length:var(--a-text-sm)] font-medium",
                    isActive ? "text-a-fg" : "text-a-fg-muted",
                    muted && "font-normal",
                  )}
                >
                  {phase.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "repair-ops-detail a-underlay rounded-md px-5 py-4 transition-all duration-300",
          danger && activePhase === focusId && "bg-a-danger-soft",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
              Guide
            </p>
            <h3 className="mt-0.5 text-[length:var(--a-text-lg)] font-medium tracking-tight">
              {focus.label}
            </h3>
            <p className="mt-1 a-mono text-[length:var(--a-text-xs)] text-a-accent-hover">
              {focus.guide}
            </p>
          </div>
          {focus.id === activePhase && running ? (
            <span className="inline-flex items-center gap-2 text-[length:var(--a-text-xs)] font-medium text-a-accent">
              <span className="repair-dot-pulse h-2 w-2 rounded-full bg-a-accent" />
              En cours
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-[length:var(--a-text-sm)] leading-relaxed text-a-fg-muted">
          {focus.detail}
        </p>
      </div>
    </div>
  );
}
