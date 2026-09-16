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
  [ACCOUNTING_SETTING_KEYS.VAT]:
    'GL account code for VAT collected (as-recorded tax only)',
  [ACCOUNTING_SETTING_KEYS.AP]:
    'GL account code for Accounts Payable (AP bill / AP payment)',
  [ACCOUNTING_SETTING_KEYS.EXPENSE]:
    'GL account code for AP bill expense / purchases (as-recorded)',
  [ACCOUNTING_SETTING_KEYS.BANK_FEE]:
    'GL account code for bank fees (empty until human — D193)',
  [ACCOUNTING_SETTING_KEYS.SALES_JOURNAL]:
    'Sales journal code for invoice GL posting',
  [ACCOUNTING_SETTING_KEYS.BANK_JOURNAL]:
    'Bank journal code for payment / bank fee / AP payment GL posting',
  [ACCOUNTING_SETTING_KEYS.PURCHASES_JOURNAL]:
    'Purchases journal code for AP bill GL posting',
  [ACCOUNTING_SETTING_KEYS.RAS]:
    'GL account code for RAS withheld on AP payment (empty until human — D275)',
  [ACCOUNTING_SETTING_KEYS.VAT_INPUT]:
    'GL account code for deductible VAT on AP bills (empty until human — D276)',
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
      vat: read(ACCOUNTING_SETTING_KEYS.VAT),
      ap: read(ACCOUNTING_SETTING_KEYS.AP),
      expense: read(ACCOUNTING_SETTING_KEYS.EXPENSE),
      bankFee: read(ACCOUNTING_SETTING_KEYS.BANK_FEE),
      salesJournal: read(ACCOUNTING_SETTING_KEYS.SALES_JOURNAL),
      bankJournal: read(ACCOUNTING_SETTING_KEYS.BANK_JOURNAL),
      purchasesJournal: read(ACCOUNTING_SETTING_KEYS.PURCHASES_JOURNAL),
      ras: read(ACCOUNTING_SETTING_KEYS.RAS),
      vatInput: read(ACCOUNTING_SETTING_KEYS.VAT_INPUT),
    };
  }

  /**
   * Human company Prefs override for `accounting.gl.bank` (D197).
   * Seed/default alone is NOT enough to reveal treasury balances.
   */
  async companyBankGlOverride(
    companyId: string,
  ): Promise<{ configured: boolean; code: string | null }> {
    await this.ensureDefinitions();
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: ACCOUNTING_SETTING_KEYS.BANK,
        scopeKey,
        deletedAt: null,
      },
    });
    if (!row) return { configured: false, code: null };
    const code =
      typeof row.valueJson === 'string' ? row.valueJson.trim() : '';
    if (!code) return { configured: false, code: null };
    return { configured: true, code };
  }
}
