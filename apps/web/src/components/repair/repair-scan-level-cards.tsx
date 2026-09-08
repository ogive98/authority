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

/** Depth picker — underline strip, no card frames (Utility Cube density). */
export function RepairScanLevelCards({ levels, selected, onSelect }: Props) {
  return (
    <div
      className="flex flex-wrap gap-1 border-b border-a-border-subtle"
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
              "group relative flex min-w-[7.5rem] flex-1 flex-col gap-1 px-3 py-3 text-left transition-colors",
              active
                ? "text-a-accent-hover"
                : "text-a-fg-muted hover:text-a-fg",
            )}
          >
            <span
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all",
                active
                  ? "bg-a-accent repair-underline-glow"
                  : "bg-transparent group-hover:bg-a-surface-4",
              )}
            />
            <span className="flex items-center gap-2">
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  active && "scale-110 text-a-accent",
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
            <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
              {level.hint} · {level.duration}
            </span>
          </button>
        );
      })}
    </div>
  );
}
