import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  ACCOUNTING_SETTING_DEFAULTS,
  ACCOUNTING_SETTING_KEYS,
  type GlMappingCodes,
} from './accounting.constants';

const SETTING_META: Record<
  (typeof ACCOUNTING_SETTING_KEYS)[keyof typeof ACCOUNTING_SETTING_KEYS],
  string
> = {
  [ACCOUNTING_SETTING_KEYS.AR]:
    'GL account code for Accounts Receivable (Finance→GL)',
  [ACCOUNTING_SETTING_KEYS.BANK]:
    'GL account code for Bank (Finance→GL payment)',
  [ACCOUNTING_SETTING_KEYS.REVENUE]:
    'GL account code for Revenue (Finance→GL invoice)',
  [ACCOUNTING_SETTING_KEYS.SALES_JOURNAL]:
    'Sales journal code for invoice GL posting',
  [ACCOUNTING_SETTING_KEYS.BANK_JOURNAL]:
    'Bank journal code for payment GL posting',
};

/**
 * Resolve Finance→GL account/journal codes (D179).
 * Order: company set_value → set_def.defaultJson → code defaults.
 */
@Injectable()
export class AccountingGlMappingResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent set_def rows so Prefs PUT works without re-seed. */
  async ensureDefinitions(): Promise<void> {
    for (const key of Object.values(ACCOUNTING_SETTING_KEYS)) {
      await this.prisma.setDef.upsert({
        where: { key },
        update: {
          valueType: 'string',
          defaultJson: ACCOUNTING_SETTING_DEFAULTS[key],
          description: SETTING_META[key],
          isPrefOnly: true,
        },
        create: {
          key,
          valueType: 'string',
          defaultJson: ACCOUNTING_SETTING_DEFAULTS[key],
          description: SETTING_META[key],
          isPrefOnly: true,
        },
      });
    }
  }

  async resolve(companyId: string): Promise<GlMappingCodes> {
    await this.ensureDefinitions();
    const keys = Object.values(ACCOUNTING_SETTING_KEYS);
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [values, defs] = await Promise.all([
      this.prisma.setValue.findMany({
        where: {
          defKey: { in: keys },
          scopeKey,
          deletedAt: null,
        },
      }),
      this.prisma.setDef.findMany({ where: { key: { in: keys } } }),
    ]);
    const byKey = new Map(values.map((v) => [v.defKey, v.valueJson]));
    const defByKey = new Map(defs.map((d) => [d.key, d.defaultJson]));

    const read = (key: keyof typeof ACCOUNTING_SETTING_DEFAULTS): string => {
      const raw = byKey.has(key)
        ? byKey.get(key)
        : defByKey.has(key)
          ? defByKey.get(key)
          : ACCOUNTING_SETTING_DEFAULTS[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      return ACCOUNTING_SETTING_DEFAULTS[key];
    };

    return {
      ar: read(ACCOUNTING_SETTING_KEYS.AR),
      bank: read(ACCOUNTING_SETTING_KEYS.BANK),
      revenue: read(ACCOUNTING_SETTING_KEYS.REVENUE),
      salesJournal: read(ACCOUNTING_SETTING_KEYS.SALES_JOURNAL),
      bankJournal: read(ACCOUNTING_SETTING_KEYS.BANK_JOURNAL),
    };
  }
}
