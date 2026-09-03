import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { thunderWorkersEnabled } from '../thunder.constants';
import { WatchdogService } from './watchdog.service';

const TICK_MS = 10_000;

@Injectable()
export class WatchdogWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatchdogWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly watchdog: WatchdogService) {}

  onModuleInit(): void {
    if (!thunderWorkersEnabled()) {
      return;
    }
    if (process.env.THUNDER_WATCHDOG_ENABLED === 'false') {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.timer.unref?.();
    this.logger.log('Thunder watchdog started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      await this.watchdog.scanOnce();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Watchdog tick failed',
      );
    }
  }
}
