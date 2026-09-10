import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  FINANCE_SETTING_DEFAULTS,
  FINANCE_SETTING_KEYS,
} from './finance.constants';

/**
 * Company collection schedule (D182) — days past due milestones.
 * Operational prefs only — not tax rates.
 */
@Injectable()
export class CollectionScheduleResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinition(): Promise<void> {
    const key = FINANCE_SETTING_KEYS.COLLECTION_REMIND_DAYS;
    await this.prisma.setDef.upsert({
      where: { key },
      update: {
        valueType: 'json',
        defaultJson: FINANCE_SETTING_DEFAULTS[key],
        description:
          'Collection milestones as days past due (e.g. [1,7,15,30]). Empty = any overdue.',
        isPrefOnly: true,
      },
      create: {
        key,
        valueType: 'json',
        defaultJson: FINANCE_SETTING_DEFAULTS[key],
        description:
          'Collection milestones as days past due (e.g. [1,7,15,30]). Empty = any overdue.',
        isPrefOnly: true,
      },
    });
  }

  /** Sorted unique non-negative integers. */
  async resolveRemindDays(companyId: string): Promise<number[]> {
    await this.ensureDefinition();
    const key = FINANCE_SETTING_KEYS.COLLECTION_REMIND_DAYS;
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [value, def] = await Promise.all([
      this.prisma.setValue.findFirst({
        where: { defKey: key, scopeKey, deletedAt: null },
      }),
      this.prisma.setDef.findUnique({ where: { key } }),
    ]);
    const raw = value?.valueJson ?? def?.defaultJson ?? FINANCE_SETTING_DEFAULTS[key];
    return normalizeRemindDays(raw);
  }
}

export function normalizeRemindDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<number>();
  for (const item of raw) {
    const n =
      typeof item === 'number'
        ? item
        : typeof item === 'string'
          ? Number(item)
          : NaN;
    if (Number.isFinite(n) && n >= 0) out.add(Math.trunc(n));
  }
  return [...out].sort((a, b) => a - b);
}

/** Highest schedule day reached by maxDaysPastDue (null if none). */
export function matchedMilestones(
  remindDays: number[],
  maxDaysPastDue: number,
): number[] {
  if (maxDaysPastDue <= 0) return [];
  if (remindDays.length === 0) return [];
  return remindDays.filter((d) => maxDaysPastDue >= d);
}
