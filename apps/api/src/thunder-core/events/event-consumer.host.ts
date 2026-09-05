import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
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

  async pollOnce(): Promise<number> {
    if (!thunderConsumersEnabled()) {
      return 0;
    }

    const connection = this.getConsumerRedis();
    if (!connection) {
      return 0;
    }

    const streamKey = thunderEventStreamKey();
    let handled = 0;

    for (const consumer of this.registry.list()) {
      handled += await this.pollConsumer(
        connection,
        streamKey,
        consumer.consumerId,
      );
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

    const response = (await connection.xreadgroup(
      'GROUP',
      consumerGroup,
      'worker-1',
      'COUNT',
      10,
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

              await registration.handler(envelope);
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
