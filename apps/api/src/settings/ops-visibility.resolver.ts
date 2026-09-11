import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildScopeKey,
  OPS_VISIBILITY_DEFAULTS,
  OPS_VISIBILITY_SETTING_KEYS,
  type OpsVisibilitySettingKey,
} from '../settings/settings.constants';

export type OpsVisibilityPolicy = {
  ghostHideDelivery: boolean;
  patchHideDelivery: boolean;
  patchAccountingPartial: boolean;
  ghostAccountingPartial: boolean;
  patchAccountingPreset: 'none' | 'partial' | 'full';
  patchAccountingIntensity: number;
  patchDisplayRules: string[];
  ghostHiddenFeatures: string[];
};

const META: Record<OpsVisibilitySettingKey, string> = {
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDE_DELIVERY]:
    'When GHOST mode is on, hide Delivery (BL) from navigation',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_HIDE_DELIVERY]:
    'When PATCH mode is on, hide Delivery (BL) from navigation',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PARTIAL]:
    'When PATCH mode is on, show only CoA (legacy bool — prefer preset)',
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_ACCOUNTING_PARTIAL]:
    'When GHOST mode is on, show only CoA (hide entries/TB/mapping write)',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PRESET]:
    'PATCH accounting preset: none | partial | full (D203)',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_INTENSITY]:
    'PATCH ledger visibility percent 0–100 (D203)',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_DISPLAY_RULES]:
    'PATCH display rules JSON: random | large_moves | by_date (D203)',
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDDEN_FEATURES]:
    'GHOST hidden features JSON moduleKey/featureId (D203)',
};

function valueTypeFor(key: OpsVisibilitySettingKey): string {
  if (
    key === OPS_VISIBILITY_SETTING_KEYS.PATCH_DISPLAY_RULES ||
    key === OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDDEN_FEATURES
  ) {
    return 'json';
  }
  if (key === OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_INTENSITY) {
    return 'number';
  }
  if (key === OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PRESET) {
    return 'string';
  }
  return 'boolean';
}

/**
 * Company ops visibility policy (D180/D203).
 * Admin Prefs — COMPANY_ONLY. Modes combinable (lock 2A).
 */
@Injectable()
export class OpsVisibilityResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinitions(): Promise<void> {
    for (const key of Object.values(OPS_VISIBILITY_SETTING_KEYS)) {
      await this.prisma.setDef.upsert({
        where: { key },
        update: {
          valueType: valueTypeFor(key),
          defaultJson: OPS_VISIBILITY_DEFAULTS[key] as never,
          description: META[key],
          isPrefOnly: true,
        },
        create: {
          key,
          valueType: valueTypeFor(key),
          defaultJson: OPS_VISIBILITY_DEFAULTS[key] as never,
          description: META[key],
          isPrefOnly: true,
        },
      });
    }
  }

  async resolve(companyId: string): Promise<OpsVisibilityPolicy> {
    await this.ensureDefinitions();
    const keys = Object.values(OPS_VISIBILITY_SETTING_KEYS);
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [values, defs] = await Promise.all([
      this.prisma.setValue.findMany({
        where: { defKey: { in: keys }, scopeKey, deletedAt: null },
      }),
      this.prisma.setDef.findMany({ where: { key: { in: keys } } }),
    ]);
    const byKey = new Map(values.map((v) => [v.defKey, v.valueJson]));
    const defByKey = new Map(defs.map((d) => [d.key, d.defaultJson]));

    const read = (key: OpsVisibilitySettingKey): unknown => {
      if (byKey.has(key)) return byKey.get(key);
      if (defByKey.has(key)) return defByKey.get(key);
      return OPS_VISIBILITY_DEFAULTS[key];
    };

    const asBool = (key: OpsVisibilitySettingKey, fallback: boolean): boolean => {
      const raw = read(key);
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      return fallback;
    };

    const presetRaw = read(OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PRESET);
    const preset =
      presetRaw === 'none' || presetRaw === 'partial' || presetRaw === 'full'
        ? presetRaw
        : 'partial';

    const intensityRaw = read(
      OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_INTENSITY,
    );
    let intensity =
      typeof intensityRaw === 'number' && Number.isFinite(intensityRaw)
        ? Math.round(intensityRaw)
        : 30;
    intensity = Math.max(0, Math.min(100, intensity));

    const rulesRaw = read(OPS_VISIBILITY_SETTING_KEYS.PATCH_DISPLAY_RULES);
    const rules = Array.isArray(rulesRaw)
      ? rulesRaw.filter((x): x is string => typeof x === 'string')
      : ['by_date'];

    const hiddenRaw = read(OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDDEN_FEATURES);
    const hidden = Array.isArray(hiddenRaw)
      ? hiddenRaw.filter((x): x is string => typeof x === 'string')
      : [];

    const patchPartialLegacy = asBool(
      OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PARTIAL,
      true,
    );

    return {
      ghostHideDelivery: asBool(
        OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDE_DELIVERY,
        true,
      ),
      patchHideDelivery: asBool(
        OPS_VISIBILITY_SETTING_KEYS.PATCH_HIDE_DELIVERY,
        true,
      ),
      patchAccountingPartial: preset !== 'full' || patchPartialLegacy,
      ghostAccountingPartial: asBool(
        OPS_VISIBILITY_SETTING_KEYS.GHOST_ACCOUNTING_PARTIAL,
        false,
      ),
      patchAccountingPreset: preset,
      patchAccountingIntensity: intensity,
      patchDisplayRules: rules,
      ghostHiddenFeatures: hidden,
    };
  }
}
