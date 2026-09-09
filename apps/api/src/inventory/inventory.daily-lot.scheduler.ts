import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ModModuleStatus, SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  INVENTORY_SETTING_DEFAULTS,
  INVENTORY_SETTING_KEYS,
} from './inventory.constants';
import { InventoryService } from './inventory.service';
import { shouldRunDailyGen, tunisClock } from './inventory.shelf';

/**
 * D101 — tick every minute; at configured Tunis hour, generate 1 lot/article/day.
 * Business rules stay in InventoryService (Thunder does not own them).
 */
@Injectable()
export class InventoryDailyLotScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InventoryDailyLotScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly lastRunByCompany = new Map<string, string>();
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    // Fire once shortly after boot (idempotent) so demos don't wait until midnight.
    setTimeout(() => void this.tick(), 5_000);
    this.logger.log(
      'Daily cheese lot scheduler armed (Africa/Tunis, default hour=0)',
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const clock = tunisClock();
      const states = await this.prisma.modModuleState.findMany({
        where: { moduleKey: 'inventory', status: ModModuleStatus.ENABLED },
        select: { companyId: true },
      });
      for (const state of states) {
        const hour = await this.resolveHour(state.companyId);
        const last = this.lastRunByCompany.get(state.companyId) ?? null;
        if (!shouldRunDailyGen(clock, hour, last)) continue;
        try {
          const result = await this.inventory.generateDailyCheeseLots(
            state.companyId,
            { packDate: clock.date },
          );
          this.lastRunByCompany.set(state.companyId, clock.date);
          this.logger.log(
            `daily lots company=${state.companyId} pack=${result.packDate} created=${result.created} skipped=${result.skipped}`,
          );
        } catch (err) {
          this.logger.warn(
            `daily lots failed company=${state.companyId}: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private async resolveHour(companyId: string): Promise<number> {
    const key = INVENTORY_SETTING_KEYS.DAILY_LOT_GEN_HOUR_TUNIS;
    const fallback = INVENTORY_SETTING_DEFAULTS[key];
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
      },
    });
    if (!row) return fallback;
    const raw = row.valueJson;
    if (typeof raw === 'number') return Math.trunc(raw);
    if (typeof raw === 'string') {
      const n = Number(raw.replace(/^"|"$/g, ''));
      return Number.isFinite(n) ? Math.trunc(n) : fallback;
    }
    return fallback;
  }
}
