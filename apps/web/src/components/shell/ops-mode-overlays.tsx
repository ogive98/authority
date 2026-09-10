"use client";

import { useShellStore } from "@/stores/shell-store";

/**
 * Ops mode visual tints — SPECTRE / PATCH / GHOST (D162).
 * Never capture clicks. Never bypass permissions.
 */
export function OpsModeOverlays() {
  const spectre = useShellStore((s) => s.spectreEnabled);
  const patch = useShellStore((s) => s.patchEnabled);
  const ghost = useShellStore((s) => s.ghostEnabled);

  return (
    <>
      {spectre ? (
        <div
          className="pointer-events-none fixed inset-0 z-[var(--a-z-spectre)]"
          style={{ background: "var(--a-spectre-overlay)" }}
          aria-hidden
          data-spectre="on"
        />
      ) : null}
      {patch ? (
        <div
          className="pointer-events-none fixed inset-0 z-[calc(var(--a-z-spectre)-1)]"
          style={{
            background:
              "color-mix(in srgb, var(--a-warning) 8%, transparent)",
          }}
          aria-hidden
          data-patch="on"
        />
      ) : null}
      {ghost ? (
        <div
          className="a-ghost-overlay pointer-events-none fixed inset-0 z-[calc(var(--a-z-spectre)-2)]"
          aria-hidden
          data-ghost="on"
        />
      ) : null}
    </>
  );
}
