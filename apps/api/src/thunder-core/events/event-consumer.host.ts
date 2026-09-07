import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { getDefaultEventContractRegistry } from '../../modules-registry/catalog/event-contract.registry';
import { RedisService } from '../../infrastructure/redis.service';
import {
  thunderConsumersEnabled,
  thunderEventStreamKey,
} from '../thunder.constants';
import { withThunderSpan } from '../observability/tracing';
import { ConsumerRegistryService } from './consumer-registry.service';
import { parseEventEnvelopeFromStreamFields } from './event-envelope.builder';
import { ProcessedEventService } from './processed-event.service';

@Injectable()
export class EventConsumerHost implements OnModuleDestroy {
  private readonly logger = new Logger(EventConsumerHost.name);
  private consumerRedis: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly registry: ConsumerRegistryService,
    private readonly processedEvents: ProcessedEventService,
  ) {}

  /**
   * Poll all consumer groups. Parallelism across groups via
   * THUNDER_CONSUMER_PARALLEL (default 4). Batch size via
   * THUNDER_CONSUMER_BATCH_SIZE (default 10).
   */
  async pollOnce(): Promise<number> {
    if (!thunderConsumersEnabled()) {
      return 0;
    }

    const connection = this.getConsumerRedis();
    if (!connection) {
      return 0;
    }

    const streamKey = thunderEventStreamKey();
    const consumers = this.registry.list();
    const parallel = readPositiveInt(process.env.THUNDER_CONSUMER_PARALLEL, 4);
    let handled = 0;

    for (let i = 0; i < consumers.length; i += parallel) {
      const chunk = consumers.slice(i, i + parallel);
      const counts = await Promise.all(
        chunk.map((consumer) =>
          this.pollConsumer(connection, streamKey, consumer.consumerId),
        ),
      );
      handled += counts.reduce((sum, n) => sum + n, 0);
    }

    return handled;
  }

  private async pollConsumer(
    connection: Redis,
    streamKey: string,
    consumerGroup: string,
  ): Promise<number> {
    await this.ensureConsumerGroup(connection, streamKey, consumerGroup);

    const registration = this.registry.get(consumerGroup);
    if (!registration) {
      return 0;
    }

    const batchSize = readPositiveInt(
      process.env.THUNDER_CONSUMER_BATCH_SIZE,
      10,
    );
    const workerName =
      process.env.THUNDER_CONSUMER_WORKER_ID?.trim() ||
      `worker-${process.pid}`;

    const response = (await connection.xreadgroup(
      'GROUP',
      consumerGroup,
      workerName,
      'COUNT',
      batchSize,
      'STREAMS',
      streamKey,
      '>',
    )) as Array<[string, Array<[string, string[]]>]> | null;

    if (!response) {
      return 0;
    }

    let handled = 0;

    for (const [, messages] of response) {
      for (const [messageId, fields] of messages) {
        try {
          const envelope = parseEventEnvelopeFromStreamFields(fields);
          await withThunderSpan(
            'thunder.event.consume',
            {
              'thunder.consumer_id': consumerGroup,
              'thunder.event_type': envelope.eventType,
              'thunder.event_id': envelope.eventId,
            },
            async () => {
              const alreadyProcessed = await this.processedEvents.isProcessed(
                consumerGroup,
                envelope.eventId,
              );

              if (alreadyProcessed) {
                await connection.xack(streamKey, consumerGroup, messageId);
                return;
              }

              const current = this.registry.get(consumerGroup);
              const accepts = getDefaultEventContractRegistry().consumerAccepts(
                current?.consumes,
                envelope.eventType,
              );
              if (!accepts) {
                await this.processedEvents.markProcessed(
                  consumerGroup,
                  envelope.eventId,
                );
                await connection.xack(streamKey, consumerGroup, messageId);
                return;
              }

              await current!.handler(envelope);
              await this.processedEvents.markProcessed(
                consumerGroup,
                envelope.eventId,
              );
              await connection.xack(streamKey, consumerGroup, messageId);
              handled += 1;
            },
          );
        } catch (error) {
          this.logger.warn(
            error instanceof Error
              ? error.message
              : `Consumer ${consumerGroup} failed`,
          );
        }
      }
    }

    return handled;
  }

  private async ensureConsumerGroup(
    connection: Redis,
    streamKey: string,
    consumerGroup: string,
  ): Promise<void> {
    try {
      await connection.xgroup(
        'CREATE',
        streamKey,
        consumerGroup,
        '0',
        'MKSTREAM',
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  private getConsumerRedis(): Redis | null {
    if (!this.consumerRedis) {
      this.consumerRedis = this.redis.createBullConnection();
    }
    return this.consumerRedis;
  }

  onModuleDestroy(): void {
    if (this.consumerRedis) {
      try {
        this.consumerRedis.disconnect();
      } catch {
        // ignore shutdown races
      }
      this.consumerRedis = null;
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
