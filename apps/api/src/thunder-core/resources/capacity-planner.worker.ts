import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JobProcessorHost } from '../jobs/job-processor.host';
import { thunderWorkersEnabled } from '../thunder.constants';
import { createProcessCpuProbe, sampleRamUsageRatio } from './live-metrics';
import { ResourceManagerService } from './resource-manager.service';

const TICK_MS = 2_000;

/**
 * Closed loop: sample process CPU/RAM → ResourceManager → pause P4 lanes.
 * Does not assign named workers.
 */
@Injectable()
export class CapacityPlannerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CapacityPlannerWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly cpu = createProcessCpuProbe();

  constructor(
    private readonly resources: ResourceManagerService,
    private readonly processors: JobProcessorHost,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (process.env.THUNDER_CAPACITY_PLANNER === 'false') {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.timer.unref?.();
    this.logger.log('Thunder capacity planner started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    const pgRaw = Number(process.env.THUNDER_PG_POOL_USAGE ?? '');
    this.resources.observeLive({
      cpuUsageRatio: this.cpu.sample(),
      ramUsageRatio: sampleRamUsageRatio(),
      pgPoolUsage: Number.isFinite(pgRaw) ? pgRaw : null,
      sampledAt: Date.now(),
    });

    if (!thunderWorkersEnabled()) {
      return;
    }

    try {
      await this.processors.syncSheddableLanes();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Capacity planner tick failed',
      );
    }
  }
}
