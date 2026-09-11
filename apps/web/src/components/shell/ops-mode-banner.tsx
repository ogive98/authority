"use client";

import { useShellStore } from "@/stores/shell-store";

/** Persistent strip while ops modes are on (D208). SPECTRE tint-only still shown. */
export function OpsModeBanner() {
  const spectre = useShellStore((s) => s.spectreEnabled);
  const patch = useShellStore((s) => s.patchEnabled);
  const ghost = useShellStore((s) => s.ghostEnabled);
  if (!spectre && !patch && !ghost) return null;

  const labels = [
    spectre ? "SPECTRE" : null,
    patch ? "PATCH" : null,
    ghost ? "GHOST" : null,
  ].filter(Boolean);

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-[var(--a-space-4)] py-2 text-[length:var(--a-text-xs)] text-a-fg-muted"
      role="status"
    >
      <span className="a-underlay rounded-md px-2 py-1 font-medium text-a-fg">
        {labels.join(" · ")}
      </span>
      <span>
        Surfaces masquées selon Préférences. Sortie : code calculatrice.
      </span>
    </div>
  );
}
