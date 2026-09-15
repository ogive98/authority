/**
 * Soft Glass → AUTHORITY X summon (loopback).
 * Requires Electron companion running (`npm run dev -w authority-x`).
 */
export const AUTHORITY_X_SUMMON_URL = "http://127.0.0.1:17898/open";
export const AUTHORITY_X_UI_URL = "http://127.0.0.1:5173";

export type SummonAuthorityXResult =
  | { ok: true; via: "summon" | "ui" }
  | { ok: false; reason: "offline" | "blocked" };

/**
 * Bring AUTHORITY X to the front. Soft Glass stays open underneath.
 */
export async function summonAuthorityX(): Promise<SummonAuthorityXResult> {
  try {
    const res = await fetch(AUTHORITY_X_SUMMON_URL, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      // Soft Glass yields focus — X is alwaysOnTop
      try {
        window.blur();
      } catch {
        /* ignore */
      }
      return { ok: true, via: "summon" };
    }
  } catch {
    /* companion not running */
  }

  // Dev fallback: open Vite UI if Electron summon is down
  try {
    const win = window.open(AUTHORITY_X_UI_URL, "authority-x", "noopener,noreferrer");
    if (win) {
      try {
        win.focus();
      } catch {
        /* ignore */
      }
      return { ok: true, via: "ui" };
    }
  } catch {
    /* ignore */
  }

  return { ok: false, reason: "offline" };
}
