/**
 * AUTHORITY notification tones (D249).
 * Procedural Web Audio — no binary asset; teal-soft industrial chime.
 */

import type { NotifSoundVariant } from "@/lib/notification-prefs";

let sharedCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function tone(
  audio: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gainPeak: number,
  type: OscillatorType = "sine",
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainPeak), start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/**
 * Play AUTHORITY notification audio.
 * @param volume 0–1
 */
export async function playAuthorityNotifSound(opts: {
  variant?: NotifSoundVariant;
  volume?: number;
  critical?: boolean;
}): Promise<void> {
  const audio = ctx();
  if (!audio) return;
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      return;
    }
  }

  const vol = Math.max(0, Math.min(1, opts.volume ?? 0.45));
  if (vol <= 0) return;
  const now = audio.currentTime;
  const variant = opts.variant ?? "pulse";
  const peak = vol * (opts.critical ? 0.55 : 0.38);

  if (variant === "soft") {
    // Soft teal ping — A4
    tone(audio, 440, now, 0.28, peak);
    tone(audio, 880, now + 0.02, 0.18, peak * 0.25, "triangle");
    return;
  }

  if (variant === "chime") {
    // Descending AUTHORITY chime — C5 · A4 · E4
    tone(audio, 523.25, now, 0.22, peak);
    tone(audio, 440, now + 0.12, 0.24, peak * 0.85);
    tone(audio, 329.63, now + 0.26, 0.32, peak * 0.7);
    return;
  }

  // pulse (default AUTHORITY) — soft two-tone industrial
  tone(audio, 392, now, 0.18, peak); // G4
  tone(audio, 523.25, now + 0.1, 0.26, peak * 0.9); // C5
  if (opts.critical) {
    tone(audio, 311.13, now + 0.22, 0.2, peak * 0.55); // Eb4 hint
  }
}

/** Test tone from Prefs — always soft pulse at given volume. */
export function previewAuthorityNotifSound(
  volume: number,
  variant: NotifSoundVariant,
): void {
  void playAuthorityNotifSound({ volume, variant, critical: false });
}
