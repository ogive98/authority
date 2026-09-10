"use client";

import type { LucideIcon } from "lucide-react";
import {
  Crosshair,
  Layers,
  Radar,
  ScanSearch,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScanDepth } from "@/lib/repair-control";

const ICONS: Record<ScanDepth, LucideIcon> = {
  L0: Zap,
  L1: Radar,
  L2: ScanSearch,
  L3: ShieldCheck,
  L4: Crosshair,
};

export type ScanLevelCard = {
  id: ScanDepth;
  label: string;
  hint: string;
  duration: string;
};

type Props = {
  levels: ScanLevelCard[];
  selected: ScanDepth;
  onSelect: (id: ScanDepth) => void;
};

/** Depth picker — Soft Glass chips (no underline strip / frames). */
export function RepairScanLevelCards({ levels, selected, onSelect }: Props) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Profondeur de scan"
    >
      {levels.map((level) => {
        const Icon = ICONS[level.id] ?? Layers;
        const active = selected === level.id;
        return (
          <button
            key={level.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(level.id)}
            className={cn(
              "flex min-w-[7.5rem] flex-1 flex-col gap-1 rounded-md px-3 py-3 text-left transition-colors",
              active
                ? "bg-a-accent text-white"
                : "a-underlay text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  active && "scale-110",
                )}
                strokeWidth={1.75}
              />
              <span className="a-mono text-[length:var(--a-text-xs)] font-medium">
                {level.id}
              </span>
            </span>
            <span className="text-[length:var(--a-text-sm)] font-medium text-inherit">
              {level.label}
            </span>
            <span
              className={cn(
                "a-mono text-[length:var(--a-text-xs)]",
                active ? "text-white/75" : "text-a-fg-subtle",
              )}
            >
              {level.hint} · {level.duration}
            </span>
          </button>
        );
      })}
    </div>
  );
}
