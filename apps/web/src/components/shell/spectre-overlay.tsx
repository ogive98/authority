"use client";

import { useShellStore } from "@/stores/shell-store";

/**
 * SPECTRE MODE visual tint — ops visibility cue only.
 * Never captures clicks (pointer-events-none). Does not bypass permissions.
 */
export function SpectreOverlay() {
  const enabled = useShellStore((s) => s.spectreEnabled);
  if (!enabled) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[var(--a-z-spectre)]"
      style={{ background: "var(--a-spectre-overlay)" }}
      aria-hidden
      data-spectre="on"
    />
  );
}
