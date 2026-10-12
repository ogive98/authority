import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  thunderEventPublisherEnabled,
  thunderTickMs,
} from '../thunder.constants';
import { OutboxPublisherService } from './outbox-publisher.service';

const TICK_MS = thunderTickMs('THUNDER_OUTBOX_TICK_MS', 10_000);

@Injectable()
export class OutboxPublisherWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly publisher: OutboxPublisherService) {}

  onModuleInit(): void {
    if (!thunderEventPublisherEnabled()) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.timer.unref?.();
    this.logger.log('Outbox publisher worker started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      await this.publisher.publishDue();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Outbox publish tick failed',
      );
    }
  }
}
