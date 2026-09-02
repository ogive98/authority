import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { thunderConsumersEnabled } from '../thunder.constants';
import { EventConsumerHost } from './event-consumer.host';

const TICK_MS = 2_000;

@Injectable()
export class EventConsumerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumerWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly consumerHost: EventConsumerHost) {}

  onModuleInit(): void {
    if (!thunderConsumersEnabled()) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    this.logger.log('Event consumer worker started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      await this.consumerHost.pollOnce();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Event consumer tick failed',
      );
    }
  }
}
