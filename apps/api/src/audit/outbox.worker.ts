import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OutboxService } from './outbox.service';

const TICK_MS = 5_000;

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly outboxService: OutboxService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      await this.outboxService.publishDue();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Outbox stub tick failed',
      );
    }
  }
}
