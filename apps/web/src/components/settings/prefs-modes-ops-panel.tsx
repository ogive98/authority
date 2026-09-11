"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AButton } from "@/components/a";
import { PrefsToggleRow } from "@/components/settings/prefs-toggle-row";
import { localizeRegistry } from "@/lib/i18n/registry-labels";
import {
  ensureShellModules,
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

/** Prefs Modes ops — documented rows, compact toggles (D203 polish). */
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
    const raw = ensureShellModules(query.data ?? FALLBACK_REGISTRY);
    const localized = localizeRegistry(raw, locale);
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
    <div className="max-w-2xl space-y-10">
      <section className="space-y-3">
        <div>
          <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
            Code sortie modes
          </h2>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            SPECTRE / PATCH / GHOST : sortie uniquement en tapant ce code (4–12
            chiffres) sur la calculatrice du toolbox. Les trois modes restent
            combinables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <p className="text-[length:var(--a-text-xs)] text-a-success">
            {unlockMsg}
          </p>
        ) : null}
        {unlockError ? (
          <p className="text-[length:var(--a-text-xs)] text-a-danger">
            {unlockError}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
            PATCH
          </h2>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Mode démo topbar. Réduit la visibilité comptable (intensité) et peut
            masquer la livraison. Les règles d’affichage choisissent comment
            échantillonner les écritures restantes.
          </p>
        </div>
        <PrefsToggleRow
          title="Masquer la livraison (BL)"
          description="En PATCH actif, retire le module Livraison de la navigation et bloque /delivery."
          checked={opsVisibility.patchHideDelivery}
          onCheckedChange={(on) => {
            const prev = opsVisibility.patchHideDelivery;
            setOpsVisibility({ patchHideDelivery: on });
            void persist(OPS_VISIBILITY_KEYS.patchHideDelivery, on, () =>
              setOpsVisibility({ patchHideDelivery: prev }),
            );
          }}
        />
        <div>
          <p className="text-[length:var(--a-text-sm)] font-medium">
            Intensité comptable
          </p>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Nul = aucune écriture · Partiel = % ci-dessous · Full = tout
            visible. Le plan comptable reste accessible en partiel.
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
          <label className="mt-3 block space-y-2">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Part de journal / mensuel affichée —{" "}
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
        </div>
        <div>
          <p className="text-[length:var(--a-text-sm)] font-medium">
            Règles d’affichage (échantillon)
          </p>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Appliquées quand PATCH est actif et l’intensité &lt; 100 %. Plusieurs
            règles peuvent être combinées.
          </p>
          <div className="mt-1 divide-y divide-transparent">
            {PATCH_DISPLAY_RULE_OPTIONS.map((opt) => (
              <PrefsToggleRow
                key={opt.id}
                title={opt.label}
                description={opt.hint}
                checked={opsVisibility.patchDisplayRules.includes(opt.id)}
                onCheckedChange={() => toggleRule(opt.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
            GHOST
          </h2>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Mode topbar. Masque des opérations choisies (checklist) sans changer
            les permissions serveur. Combinable avec PATCH.
          </p>
        </div>
        <PrefsToggleRow
          title="Raccourci — masquer livraison (BL)"
          description="Équivalent à cocher Livraison / Tournées dans la checklist."
          checked={opsVisibility.ghostHideDelivery}
          onCheckedChange={(on) => {
            const prev = opsVisibility.ghostHideDelivery;
            setOpsVisibility({ ghostHideDelivery: on });
            void persist(OPS_VISIBILITY_KEYS.ghostHideDelivery, on, () =>
              setOpsVisibility({ ghostHideDelivery: prev }),
            );
          }}
        />
        <PrefsToggleRow
          title="Compta partielle (plan seul)"
          description="En GHOST, retire écritures / journaux / balance / mapping du module Comptabilité."
          checked={opsVisibility.ghostAccountingPartial}
          onCheckedChange={(on) => {
            const prev = opsVisibility.ghostAccountingPartial;
            setOpsVisibility({ ghostAccountingPartial: on });
            void persist(OPS_VISIBILITY_KEYS.ghostAccountingPartial, on, () =>
              setOpsVisibility({ ghostAccountingPartial: prev }),
            );
          }}
        />
        <div>
          <p className="text-[length:var(--a-text-sm)] font-medium">
            Checklist fonctionnalités à masquer
          </p>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Coché = masqué dans la navigation / Mission Control lorsque GHOST
            est actif. Liste issue du registry modules.
          </p>
          <div className="mt-3 max-h-96 space-y-4 overflow-y-auto">
            {modules
              .filter((m) => m.key !== "home" && m.key !== "settings")
              .map((m) => (
                <div key={m.key}>
                  <p className="text-[length:var(--a-text-xs)] font-semibold uppercase tracking-wider text-a-orange">
                    {m.name}
                  </p>
                  <div className="mt-1">
                    {m.features.length === 0 ? (
                      <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                        Aucune feature exposée.
                      </p>
                    ) : (
                      m.features.map((f) => {
                        const hk = featureHideKey(m.key, f.id);
                        return (
                          <PrefsToggleRow
                            key={hk}
                            title={f.label}
                            description={`Masque « ${f.label} » (${m.key}/${f.id}) en mode GHOST.`}
                            checked={opsVisibility.ghostHiddenFeatures.includes(
                              hk,
                            )}
                            onCheckedChange={() =>
                              toggleGhostFeature(m.key, f.id)
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[length:var(--a-text-md)] font-medium text-a-orange">
          SPECTRE
        </h2>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          Teinte topbar uniquement — aucun réglage supplémentaire pour l’instant.
        </p>
      </section>
    </div>
  );
}
