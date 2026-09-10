import { Injectable } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinOpenItemStatus,
  SetLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  FINANCE_SETTING_DEFAULTS,
  FINANCE_SETTING_KEYS,
} from './finance.constants';

export type CreditPressureLevel = 'ok' | 'warn' | 'breach';

export type CreditPressureEval = {
  level: CreditPressureLevel | null;
  ratio: number | null;
  warnRatio: number;
  outstanding: number;
  creditLimit: number | null;
};

/**
 * Company credit warn ratio (D185) — outstanding / limit.
 * Operational pref only — not a tax rate.
 */
@Injectable()
export class CreditPressureResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinition(): Promise<void> {
    const key = FINANCE_SETTING_KEYS.CREDIT_WARN_RATIO;
    await this.prisma.setDef.upsert({
      where: { key },
      update: {
        valueType: 'number',
        defaultJson: FINANCE_SETTING_DEFAULTS[key],
        description:
          'Warn when AR outstanding / creditLimit ≥ ratio (0–1). Breach at ≥1. Not tax.',
        isPrefOnly: true,
      },
      create: {
        key,
        valueType: 'number',
        defaultJson: FINANCE_SETTING_DEFAULTS[key],
        description:
          'Warn when AR outstanding / creditLimit ≥ ratio (0–1). Breach at ≥1. Not tax.',
        isPrefOnly: true,
      },
    });
  }

  async resolveWarnRatio(companyId: string): Promise<number> {
    await this.ensureDefinition();
    const key = FINANCE_SETTING_KEYS.CREDIT_WARN_RATIO;
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [value, def] = await Promise.all([
      this.prisma.setValue.findFirst({
        where: { defKey: key, scopeKey, deletedAt: null },
      }),
      this.prisma.setDef.findUnique({ where: { key } }),
    ]);
    const raw =
      value?.valueJson ?? def?.defaultJson ?? FINANCE_SETTING_DEFAULTS[key];
    return normalizeWarnRatio(raw);
  }

  async evaluate(
    companyId: string,
    customerId: string,
  ): Promise<CreditPressureEval> {
    const [warnRatio, customer, agg] = await Promise.all([
      this.resolveWarnRatio(companyId),
      this.prisma.cusCustomer.findFirst({
        where: { id: customerId, companyId, deletedAt: null },
        select: { creditLimit: true },
      }),
      this.prisma.finOpenItem.aggregate({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
          status: {
            in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
          },
        },
        _sum: { amountOpen: true },
      }),
    ]);
    const outstanding = Number(agg._sum.amountOpen ?? 0);
    const creditLimit =
      customer?.creditLimit != null ? Number(customer.creditLimit) : null;
    return evaluateCreditPressure({ outstanding, creditLimit, warnRatio });
  }
}

export function normalizeWarnRatio(raw: unknown): number {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return 0.8;
  return Math.min(1, Math.max(0.05, n));
}

export function evaluateCreditPressure(input: {
  outstanding: number;
  creditLimit: number | null;
  warnRatio: number;
}): CreditPressureEval {
  const warnRatio = normalizeWarnRatio(input.warnRatio);
  if (input.creditLimit == null || !(input.creditLimit > 0)) {
    return {
      level: null,
      ratio: null,
      warnRatio,
      outstanding: input.outstanding,
      creditLimit: input.creditLimit,
    };
  }
  const ratio = input.outstanding / input.creditLimit;
  let level: CreditPressureLevel = 'ok';
  if (ratio >= 1) level = 'breach';
  else if (ratio >= warnRatio) level = 'warn';
  return {
    level,
    ratio,
    warnRatio,
    outstanding: input.outstanding,
    creditLimit: input.creditLimit,
  };
}
