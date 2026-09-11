"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AButton, ASwitch } from "@/components/a";
import { localizeRegistry } from "@/lib/i18n/registry-labels";
import {
  FALLBACK_REGISTRY,
  fetchMeRegistry,
  type MeRegistry,
} from "@/lib/registry";
import {
  derivePatchPartial,
  featureHideKey,
  OPS_VISIBILITY_KEYS,
  PATCH_DISPLAY_RULE_OPTIONS,
  type PatchAccountingPreset,
  type PatchDisplayRule,
} from "@/lib/ops-visibility";
import { putCompanySetting } from "@/lib/settings";
import { useLocaleStore } from "@/stores/locale-store";
import { usePrefsStore } from "@/stores/prefs-store";

type Props = {
  unlockDraft: string;
  setUnlockDraft: (v: string) => void;
  unlockBusy: boolean;
  unlockMsg: string | null;
  unlockError: string | null;
  onSaveUnlockCode: () => void;
};

/** Prefs Modes ops (D203) — PATCH + GHOST. SPECTRE unchanged. */
export function PrefsModesOpsPanel({
  unlockDraft,
  setUnlockDraft,
  unlockBusy,
  unlockMsg,
  unlockError,
  onSaveUnlockCode,
}: Props) {
  const opsVisibility = usePrefsStore((s) => s.opsVisibility);
  const setOpsVisibility = usePrefsStore((s) => s.setOpsVisibility);
  const locale = useLocaleStore((s) => s.locale);
  const query = useQuery<MeRegistry>({
    queryKey: ["me-registry"],
    queryFn: fetchMeRegistry,
    placeholderData: FALLBACK_REGISTRY,
    staleTime: 30_000,
  });
  const modules = useMemo(() => {
    const localized = localizeRegistry(query.data ?? FALLBACK_REGISTRY, locale);
    return localized.modules;
  }, [query.data, locale]);

  async function persist(key: string, value: unknown, rollback: () => void) {
    const r = await putCompanySetting(key, value);
    if (!r.ok) rollback();
  }

  function setPreset(preset: PatchAccountingPreset) {
    const prev = { ...opsVisibility };
    const intensity =
      preset === "none"
        ? 0
        : preset === "full"
          ? 100
          : prev.patchAccountingIntensity || 30;
    const partial = derivePatchPartial(preset);
    setOpsVisibility({
      patchAccountingPreset: preset,
      patchAccountingIntensity: intensity,
      patchAccountingPartial: partial,
    });
    void persist(OPS_VISIBILITY_KEYS.patchAccountingPreset, preset, () =>
      setOpsVisibility(prev),
    );
    void persist(OPS_VISIBILITY_KEYS.patchAccountingIntensity, intensity, () =>
      setOpsVisibility(prev),
    );
    void persist(OPS_VISIBILITY_KEYS.patchAccountingPartial, partial, () =>
      setOpsVisibility(prev),
    );
  }

  function setIntensity(n: number) {
    const prev = { ...opsVisibility };
    const intensity = Math.max(0, Math.min(100, Math.round(n)));
    const preset: PatchAccountingPreset =
      intensity <= 0 ? "none" : intensity >= 100 ? "full" : "partial";
    setOpsVisibility({
      patchAccountingIntensity: intensity,
      patchAccountingPreset: preset,
      patchAccountingPartial: derivePatchPartial(preset),
    });
    void persist(OPS_VISIBILITY_KEYS.patchAccountingIntensity, intensity, () =>
      setOpsVisibility(prev),
    );
    void persist(OPS_VISIBILITY_KEYS.patchAccountingPreset, preset, () =>
      setOpsVisibility(prev),
    );
  }

  function toggleRule(rule: PatchDisplayRule) {
    const prev = { ...opsVisibility };
    const cur = new Set(opsVisibility.patchDisplayRules);
    if (cur.has(rule)) cur.delete(rule);
    else cur.add(rule);
    const next = [...cur] as PatchDisplayRule[];
    if (!next.length) next.push("by_date");
    setOpsVisibility({ patchDisplayRules: next });
    void persist(OPS_VISIBILITY_KEYS.patchDisplayRules, next, () =>
      setOpsVisibility(prev),
    );
  }

  function toggleGhostFeature(moduleKey: string, featureId: string) {
    const key = featureHideKey(moduleKey, featureId);
    const prev = { ...opsVisibility };
    const set = new Set(opsVisibility.ghostHiddenFeatures);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    const next = [...set];
    setOpsVisibility({ ghostHiddenFeatures: next });
    void persist(OPS_VISIBILITY_KEYS.ghostHiddenFeatures, next, () =>
      setOpsVisibility(prev),
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-[length:var(--a-text-md)] font-medium">
          Code sortie modes
        </h2>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          SPECTRE / PATCH / GHOST : sortie via ce code sur la calculatrice.
          Modes combinables.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={unlockDraft}
            onChange={(e) =>
              setUnlockDraft(e.target.value.replace(/\D/g, "").slice(0, 12))
            }
            className="a-mono h-9 w-36 rounded-xl bg-a-surface-3 px-3 text-[length:var(--a-text-sm)] text-a-fg outline-none focus:ring-2 focus:ring-a-accent"
            aria-label="Code déverrouillage modes"
          />
          <AButton
            type="button"
            size="sm"
            variant="primary"
            disabled={unlockBusy}
            onClick={onSaveUnlockCode}
          >
            {unlockBusy ? "…" : "Enregistrer"}
          </AButton>
        </div>
        {unlockMsg ? (
          <p className="mt-2 text-[length:var(--a-text-xs)] text-a-success">
            {unlockMsg}
          </p>
        ) : null}
        {unlockError ? (
          <p className="mt-2 text-[length:var(--a-text-xs)] text-a-danger">
            {unlockError}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="text-[length:var(--a-text-md)] font-medium">PATCH</h2>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          Prefs + topbar. Presets nul/partiel/full · slider % · règles
          d’échantillon.
        </p>
        <div className="mt-3">
          <ASwitch
            label="PATCH masque livraison (BL)"
            checked={opsVisibility.patchHideDelivery}
            onCheckedChange={(on) => {
              const prev = opsVisibility.patchHideDelivery;
              setOpsVisibility({ patchHideDelivery: on });
              void persist(OPS_VISIBILITY_KEYS.patchHideDelivery, on, () =>
                setOpsVisibility({ patchHideDelivery: prev }),
              );
            }}
          />
        </div>
        <p className="mt-4 text-[length:var(--a-text-sm)] font-medium">
          Intensité comptable
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["none", "Nul"],
              ["partial", "Partiel"],
              ["full", "Full"],
            ] as const
          ).map(([id, label]) => (
            <AButton
              key={id}
              type="button"
              size="sm"
              variant={
                opsVisibility.patchAccountingPreset === id
                  ? "primary"
                  : "secondary"
              }
              onClick={() => setPreset(id)}
            >
              {label}
            </AButton>
          ))}
        </div>
        <label className="mt-4 block space-y-2">
          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Slider % visible —{" "}
            <span className="a-mono">
              {opsVisibility.patchAccountingIntensity}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={opsVisibility.patchAccountingIntensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full accent-[var(--a-accent)]"
          />
        </label>
        <p className="mt-4 text-[length:var(--a-text-sm)] font-medium">
          Règles d’affichage
        </p>
        <div className="mt-2 space-y-2">
          {PATCH_DISPLAY_RULE_OPTIONS.map((opt) => (
            <ASwitch
              key={opt.id}
              label={`${opt.label} — ${opt.hint}`}
              checked={opsVisibility.patchDisplayRules.includes(opt.id)}
              onCheckedChange={() => toggleRule(opt.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-[length:var(--a-text-md)] font-medium">GHOST</h2>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          Prefs + topbar. Checklist registry — combinable avec PATCH.
        </p>
        <div className="mt-3 space-y-2">
          <ASwitch
            label="GHOST masque livraison (BL) — raccourci"
            checked={opsVisibility.ghostHideDelivery}
            onCheckedChange={(on) => {
              const prev = opsVisibility.ghostHideDelivery;
              setOpsVisibility({ ghostHideDelivery: on });
              void persist(OPS_VISIBILITY_KEYS.ghostHideDelivery, on, () =>
                setOpsVisibility({ ghostHideDelivery: prev }),
              );
            }}
          />
          <ASwitch
            label="GHOST compta partielle (plan seul)"
            checked={opsVisibility.ghostAccountingPartial}
            onCheckedChange={(on) => {
              const prev = opsVisibility.ghostAccountingPartial;
              setOpsVisibility({ ghostAccountingPartial: on });
              void persist(OPS_VISIBILITY_KEYS.ghostAccountingPartial, on, () =>
                setOpsVisibility({ ghostAccountingPartial: prev }),
              );
            }}
          />
        </div>
        <p className="mt-4 text-[length:var(--a-text-sm)] font-medium">
          Checklist fonctionnalités
        </p>
        <div className="mt-2 max-h-72 space-y-3 overflow-y-auto">
          {modules
            .filter((m) => m.key !== "home" && m.key !== "settings")
            .map((m) => (
              <div key={m.key}>
                <p className="text-[length:var(--a-text-xs)] font-medium text-a-fg-muted">
                  {m.name}
                </p>
                <div className="mt-1 space-y-1">
                  {m.features.map((f) => {
                    const hk = featureHideKey(m.key, f.id);
                    return (
                      <ASwitch
                        key={hk}
                        label={f.label}
                        checked={opsVisibility.ghostHiddenFeatures.includes(hk)}
                        onCheckedChange={() =>
                          toggleGhostFeature(m.key, f.id)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-[length:var(--a-text-md)] font-medium">SPECTRE</h2>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          Teinte topbar uniquement — aucun réglage supplémentaire ce lot.
        </p>
      </div>
    </div>
  );
}
