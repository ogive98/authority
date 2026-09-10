"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Fingerprint,
  Lightbulb,
  Map,
  Play,
  Radar,
  ScrollText,
  Search,
  Shield,
  Undo2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REPAIR_PIPELINE,
  type RepairStage,
  type RepairStageId,
} from "@/lib/repair-control";

const ICONS: Record<RepairStage["icon"], LucideIcon> = {
  radar: Radar,
  search: Search,
  fingerprint: Fingerprint,
  lightbulb: Lightbulb,
  shield: Shield,
  map: Map,
  check: CheckCircle2,
  camera: Camera,
  play: Play,
  badge: BadgeCheck,
  undo: Undo2,
  scroll: ScrollText,
  upload: Upload,
};

type Props = {
  activeId: RepairStageId;
  reached: Set<RepairStageId>;
  running: boolean;
  onSelect: (id: RepairStageId) => void;
};

/** Interactive SVG pipeline — Control Console Repair V0. */
export function RepairWorkflowCanvas({
  activeId,
  reached,
  running,
  onSelect,
}: Props) {
  const stages = REPAIR_PIPELINE;
  const n = stages.length;
  const width = 1120;
  const height = 220;
  const padX = 48;
  const step = (width - padX * 2) / (n - 1);
  const y = 110;

  const points = stages.map((stage, i) => ({
    stage,
    x: padX + i * step,
    y,
  }));

  return (
    <div className="repair-canvas relative overflow-hidden a-underlay rounded-md bg-[var(--a-gradient-canvas)]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Pipeline Repair : Scan vers Report"
      >
        <defs>
          <linearGradient id="repair-edge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#6868f0" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* soft orbit rings */}
        <circle
          cx={width / 2}
          cy={y}
          r={86}
          fill="none"
          stroke="rgb(104 104 240 / 0.12)"
          strokeWidth="1"
          className="repair-orbit"
        />
        <circle
          cx={width / 2}
          cy={y}
          r={128}
          fill="none"
          stroke="rgb(5 150 105 / 0.1)"
          strokeWidth="1"
          className="repair-orbit repair-orbit-slow"
        />

        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1]!;
          const lit =
            reached.has(p.stage.id) &&
            (reached.has(next.stage.id) || activeId === next.stage.id);
          return (
            <line
              key={`e-${p.stage.id}`}
              x1={p.x + 22}
              y1={p.y}
              x2={next.x - 22}
              y2={next.y}
              stroke={lit ? "url(#repair-edge)" : "rgb(209 213 219 / 0.9)"}
              strokeWidth={lit ? 2.5 : 1.5}
              strokeDasharray="6 8"
              className={cn(lit && running && "repair-edge-flow")}
            />
          );
        })}

        {points.map(({ stage, x, y: cy }) => {
          const Icon = ICONS[stage.icon];
          const isActive = stage.id === activeId;
          const isDone = reached.has(stage.id) && !isActive;
          return (
            <g
              key={stage.id}
              transform={`translate(${x}, ${cy})`}
              className="repair-node"
            >
              <title>
                {stage.label} — {stage.hint}
              </title>
              {(isActive || isDone) && (
                <circle
                  r={28}
                  fill="none"
                  stroke={isActive ? "#059669" : "#34d399"}
                  strokeOpacity={isActive ? 0.35 : 0.25}
                  strokeWidth={2}
                  className={cn(isActive && "repair-node-pulse")}
                />
              )}
              <circle
                r={20}
                fill={
                  isActive
                    ? "#059669"
                    : isDone
                      ? "#ecfdf5"
                      : "rgb(255 255 255 / 0.92)"
                }
                stroke={
                  isActive ? "#047857" : isDone ? "#34d399" : "#e5e7eb"
                }
                strokeWidth={1.5}
                className="cursor-pointer"
                onClick={() => onSelect(stage.id)}
              />
              <foreignObject
                x={-10}
                y={-10}
                width={20}
                height={20}
                className="pointer-events-none overflow-visible"
              >
                <div className="flex h-5 w-5 items-center justify-center">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      isActive
                        ? "text-white"
                        : isDone
                          ? "text-a-accent"
                          : "text-a-fg-muted",
                    )}
                    strokeWidth={1.75}
                  />
                </div>
              </foreignObject>
              <text
                y={38}
                textAnchor="middle"
                className="fill-[var(--a-fg)] text-[11px] font-medium"
              >
                {stage.label}
              </text>
              <text
                y={52}
                textAnchor="middle"
                className="fill-[var(--a-fg-subtle)] text-[9px]"
              >
                {stage.short}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
