import { Injectable } from '@nestjs/common';
import type { ThunderQueueFamily } from '../thunder.constants';
import {
  QUEUE_DEFAULT_PRIORITY,
  SHEDDABLE_QUEUES,
  type ResourcePressureSnapshot,
} from './resource-manager.types';

@Injectable()
export class ResourceManagerService {
  private forcedShedP4 = false;
  private readonly tokens = new Map<
    string,
    { tokens: number; updatedAt: number }
  >();

  getMaxWorkers(): number {
    return readPositiveInt(process.env.THUNDER_MAX_WORKERS, 8);
  }

  getMaxImportWorkers(): number {
    return readPositiveInt(process.env.THUNDER_MAX_IMPORT_WORKERS, 2);
  }

  getStallThresholdMs(): number {
    return readPositiveInt(process.env.THUNDER_STALL_MS, 60_000);
  }

  getConcurrency(queue: ThunderQueueFamily): number {
    if (queue === 'critical') {
      return Math.max(2, Math.min(4, this.getMaxWorkers()));
    }
    if (queue === 'import' || queue === 'analytics') {
      // 0 = do not start / pause workers for sheddable lanes under pressure
      if (this.getPressure().shedP4) {
        return 0;
      }
      return Math.max(1, this.getMaxImportWorkers());
    }
    return Math.max(1, Math.min(2, this.getMaxWorkers()));
  }

  isSheddableQueue(queue: ThunderQueueFamily): boolean {
    return SHEDDABLE_QUEUES.includes(queue);
  }

  defaultPriority(queue: ThunderQueueFamily): number {
    return QUEUE_DEFAULT_PRIORITY[queue];
  }

  /** Test / ops hook — force P4 shed without real CPU/PG probes. */
  setShedP4(enabled: boolean, reason = 'forced'): void {
    this.forcedShedP4 = enabled;
    if (enabled) {
      this.pressureReason = reason;
    } else {
      this.pressureReason = undefined;
    }
  }

  private pressureReason?: string;

  getPressure(): ResourcePressureSnapshot {
    if (this.forcedShedP4 || process.env.THUNDER_SHED_P4 === 'true') {
      return {
        shedP4: true,
        reason: this.pressureReason ?? 'THUNDER_SHED_P4',
      };
    }

    const pgPressure = Number(process.env.THUNDER_PG_POOL_USAGE ?? '0');
    const cpuPressure = Number(process.env.THUNDER_CPU_USAGE ?? '0');
    if (pgPressure >= 0.8 || cpuPressure >= 0.85) {
      return {
        shedP4: true,
        reason: pgPressure >= 0.8 ? 'pg_pool_pressure' : 'cpu_pressure',
      };
    }

    return { shedP4: false };
  }

  shouldAdmitEnqueue(
    queue: ThunderQueueFamily,
    companyId: string,
  ): {
    allowed: boolean;
    reason?: string;
  } {
    if (this.isSheddableQueue(queue) && this.getPressure().shedP4) {
      return {
        allowed: false,
        reason: this.getPressure().reason ?? 'shed_p4',
      };
    }

    if (queue === 'import' || queue === 'analytics') {
      if (!this.consumeFairnessToken(companyId, queue)) {
        return { allowed: false, reason: 'fairness_throttle' };
      }
    }

    return { allowed: true };
  }

  private consumeFairnessToken(
    companyId: string,
    queue: ThunderQueueFamily,
  ): boolean {
    const key = `${companyId}:${queue}`;
    const now = Date.now();
    const maxTokens = readPositiveInt(process.env.THUNDER_FAIRNESS_BURST, 5);
    const refillPerSec = readPositiveInt(
      process.env.THUNDER_FAIRNESS_REFILL_PER_SEC,
      1,
    );

    const current = this.tokens.get(key) ?? {
      tokens: maxTokens,
      updatedAt: now,
    };
    const elapsedSec = Math.max(0, (now - current.updatedAt) / 1000);
    const refilled = Math.min(
      maxTokens,
      current.tokens + elapsedSec * refillPerSec,
    );

    if (refilled < 1) {
      this.tokens.set(key, { tokens: refilled, updatedAt: now });
      return false;
    }

    this.tokens.set(key, { tokens: refilled - 1, updatedAt: now });
    return true;
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}
