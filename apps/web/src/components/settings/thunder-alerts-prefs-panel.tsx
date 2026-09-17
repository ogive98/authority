"use client";

import {
  DEFAULT_THUNDER_ALERT_THRESHOLDS,
  type ThunderAlertThresholds,
} from "@/lib/thunder/alert-thresholds";
import { useThunderDashboardStore } from "@/stores/thunder-dashboard-store";

const FIELDS: Array<{
  key: keyof ThunderAlertThresholds;
  label: string;
  hint: string;
  pct?: boolean;
}> = [
  { key: "cpuWarn", label: "CPU warn", hint: "ratio 0–1", pct: true },
  { key: "cpuCrit", label: "CPU critical", hint: "ratio 0–1", pct: true },
  { key: "ramWarn", label: "RAM warn", hint: "ratio 0–1", pct: true },
  { key: "ramCrit", label: "RAM critical", hint: "ratio 0–1", pct: true },
  { key: "queueWarn", label: "Queue warn", hint: "pending count" },
  { key: "queueCrit", label: "Queue critical", hint: "pending count" },
  {
    key: "apiLatencyWarnMs",
    label: "API p95 warn (ms)",
    hint: "milliseconds",
  },
  {
    key: "apiLatencyCritMs",
    label: "API p95 critical (ms)",
    hint: "milliseconds",
  },
];

/**
 * Prefs → Poste — Thunder alert thresholds (local V1, never hardcoded in widgets).
 */
export function ThunderAlertsPrefsPanel() {
  const thresholds = useThunderDashboardStore((s) => s.thresholds);
  const setThresholds = useThunderDashboardStore((s) => s.setThresholds);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[length:var(--a-text-sm)] font-medium text-a-accent">
          Thunder Core — alertes
        </p>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          Seuils consommés par le Command Center (`/thunder`). Persistés en local
          (poste). Pas de secrets.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label
            key={f.key}
            className="flex flex-col gap-1 text-[length:var(--a-text-xs)] text-a-fg-muted"
          >
            <span className="font-medium text-a-fg">{f.label}</span>
            <input
              type="number"
              step={f.pct ? 0.01 : 1}
              min={0}
              value={thresholds[f.key]}
              onChange={(e) => {
                const n = Number.parseFloat(e.target.value);
                if (Number.isNaN(n)) return;
                setThresholds({ [f.key]: n });
              }}
              className="a-mono rounded-[var(--a-radius-sm)] bg-a-surface-3 px-2 py-1.5 text-[13px] text-a-fg outline-none focus:ring-2 focus:ring-a-accent/30"
            />
            <span className="text-[10px] text-a-fg-subtle">{f.hint}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
        onClick={() => setThresholds({ ...DEFAULT_THUNDER_ALERT_THRESHOLDS })}
      >
        Restaurer défauts
      </button>
    </div>
  );
}
