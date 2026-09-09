/**
 * Local RAM relief (D115) — client shell side.
 * Set NEXT_PUBLIC_AUTHORITY_SHELL_LIGHT=true (restart `dev:web`).
 */
export function isShellLight(): boolean {
  return process.env.NEXT_PUBLIC_AUTHORITY_SHELL_LIGHT === "true";
}

/** Monitor poll: paused when tab hidden; slower in light mode. */
export function monitorPollMs(): number | false {
  if (typeof document !== "undefined" && document.hidden) {
    return false;
  }
  return isShellLight() ? 60_000 : 15_000;
}
