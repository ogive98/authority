"use client";

import { useMeRegistry } from "@/hooks/use-me-registry";
import {
  SMART_ACTIONS_MAX,
  usePrefsStore,
} from "@/stores/prefs-store";
import { cn } from "@/lib/utils";
import {
  featurePinKey,
  listRegistryFeaturesFlat,
} from "@/lib/smart-actions-pins";

/**
 * Préférences → Poste — pick up to 5 registry features for the Smart Action Dock.
 */
export function SmartActionsPrefsPanel() {
  const { data: registry } = useMeRegistry();
  const pinned = usePrefsStore((s) => s.smartActionIds);
  const toggle = usePrefsStore((s) => s.toggleSmartActionId);
  const clear = usePrefsStore((s) => s.setSmartActionIds);
  const features = listRegistryFeaturesFlat(registry);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[length:var(--a-text-sm)] font-medium text-a-accent">
            Smart Actions
          </p>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Liste complète des fonctionnalités registry — choisissez jusqu’à{" "}
            {SMART_ACTIONS_MAX} raccourcis pour le rail droit. Vide = classement
            automatique par module.
          </p>
        </div>
        <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
          {pinned.length}/{SMART_ACTIONS_MAX}
        </p>
      </div>

      {pinned.length > 0 ? (
        <button
          type="button"
          onClick={() => clear([])}
          className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
        >
          Réinitialiser (auto)
        </button>
      ) : null}

      <ul className="a-ios-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
        {features.map((f) => {
          const key = featurePinKey(f.moduleKey, f.id);
          const on = pinned.includes(key);
          const full = !on && pinned.length >= SMART_ACTIONS_MAX;
          return (
            <li key={key}>
              <button
                type="button"
                disabled={full}
                onClick={() => toggle(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--a-radius-sm)] px-2.5 py-2 text-left transition-colors",
                  on
                    ? "bg-a-accent-muted text-a-fg"
                    : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                  full && "opacity-45",
                )}
                aria-pressed={on}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                    on
                      ? "border-a-accent bg-a-accent text-a-accent-fg"
                      : "border-[color:var(--a-border-strong)] bg-a-surface-2",
                  )}
                  aria-hidden
                >
                  {on ? (
                    <span className="text-[10px] font-bold leading-none">✓</span>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--a-text-sm)] font-medium">
                    {f.label}
                  </span>
                  <span className="a-mono mt-0.5 block truncate text-[10px] text-a-fg-subtle">
                    {f.moduleName} · {f.href}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
