import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { thunderConsumersEnabled } from '../thunder.constants';
import { EventConsumerHost } from './event-consumer.host';
import { ProcessedEventService } from './processed-event.service';

const TICK_MS = 2_000;
const DEFAULT_PRUNE_EVERY_MS = 60_000;

@Injectable()
export class EventConsumerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumerWorker.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastPruneAt = 0;

  constructor(
    private readonly consumerHost: EventConsumerHost,
    private readonly processedEvents: ProcessedEventService,
  ) {}

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
      await this.maybePrune();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Event consumer tick failed',
      );
    }
  }

  private async maybePrune(): Promise<void> {
    if (process.env.THUNDER_PROCESSED_EVENT_PRUNE === 'false') {
      return;
    }
    const everyMs = readPositiveInt(
      process.env.THUNDER_PROCESSED_EVENT_PRUNE_EVERY_MS,
      DEFAULT_PRUNE_EVERY_MS,
    );
    const now = Date.now();
    if (now - this.lastPruneAt < everyMs) {
      return;
    }
    this.lastPruneAt = now;
    try {
      const result = await this.processedEvents.pruneExpired();
      if (result.deleted > 0) {
        this.logger.log(
          `Pruned ${result.deleted} processed-event rows older than ${result.cutoff}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `processed-event prune failed: ${error.message}`
          : 'processed-event prune failed',
      );
    }
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}
