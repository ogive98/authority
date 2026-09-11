"use client";

import { useShellStore } from "@/stores/shell-store";

export const OPS_MODES_HEADER = "X-Authority-Ops-Modes";

/** Client-declared ops modes for display sampling (D208) — not IAM. */
export function opsModesHeaderValue(): string | null {
  const s = useShellStore.getState();
  const parts: string[] = [];
  if (s.patchEnabled) parts.push("patch");
  if (s.ghostEnabled) parts.push("ghost");
  if (s.spectreEnabled) parts.push("spectre");
  return parts.length ? parts.join(",") : null;
}

export function opsModesHeaders(): Record<string, string> {
  const v = opsModesHeaderValue();
  return v ? { [OPS_MODES_HEADER]: v } : {};
}
