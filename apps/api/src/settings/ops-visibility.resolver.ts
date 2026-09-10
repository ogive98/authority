import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildScopeKey,
  OPS_VISIBILITY_DEFAULTS,
  OPS_VISIBILITY_SETTING_KEYS,
} from '../settings/settings.constants';

export type OpsVisibilityPolicy = {
  ghostHideDelivery: boolean;
  patchHideDelivery: boolean;
  patchAccountingPartial: boolean;
  ghostAccountingPartial: boolean;
};

const META: Record<
  (typeof OPS_VISIBILITY_SETTING_KEYS)[keyof typeof OPS_VISIBILITY_SETTING_KEYS],
  string
> = {
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDE_DELIVERY]:
    'When GHOST mode is on, hide Delivery (BL) from navigation',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_HIDE_DELIVERY]:
    'When PATCH mode is on, hide Delivery (BL) from navigation',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PARTIAL]:
    'When PATCH mode is on, show only CoA (hide entries/TB/mapping write)',
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_ACCOUNTING_PARTIAL]:
    'When GHOST mode is on, show only CoA (hide entries/TB/mapping write)',
};

/**
 * Company ops visibility policy (D180).
 * Defaults: GHOST/PATCH hide BL; PATCH partial accounting; GHOST full accounting.
 * Admin Prefs UI can override later — keys are COMPANY_ONLY.
 */
@Injectable()
export class OpsVisibilityResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinitions(): Promise<void> {
    for (const key of Object.values(OPS_VISIBILITY_SETTING_KEYS)) {
      await this.prisma.setDef.upsert({
        where: { key },
        update: {
          valueType: 'boolean',
          defaultJson: OPS_VISIBILITY_DEFAULTS[key],
          description: META[key],
          isPrefOnly: true,
        },
        create: {
          key,
          valueType: 'boolean',
          defaultJson: OPS_VISIBILITY_DEFAULTS[key],
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

    const asBool = (
      key: keyof typeof OPS_VISIBILITY_DEFAULTS,
    ): boolean => {
      const raw = byKey.has(key)
        ? byKey.get(key)
        : defByKey.has(key)
          ? defByKey.get(key)
          : OPS_VISIBILITY_DEFAULTS[key];
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      return OPS_VISIBILITY_DEFAULTS[key];
    };

    return {
      ghostHideDelivery: asBool(
        OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDE_DELIVERY,
      ),
      patchHideDelivery: asBool(
        OPS_VISIBILITY_SETTING_KEYS.PATCH_HIDE_DELIVERY,
      ),
      patchAccountingPartial: asBool(
        OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PARTIAL,
      ),
      ghostAccountingPartial: asBool(
        OPS_VISIBILITY_SETTING_KEYS.GHOST_ACCOUNTING_PARTIAL,
      ),
    };
  }
}
