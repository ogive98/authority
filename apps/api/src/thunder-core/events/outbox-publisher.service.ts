import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { thunderEventStreamKey } from '../thunder.constants';
import { buildEventEnvelope } from './event-envelope.builder';

@Injectable()
export class OutboxPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private publisherRedis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async publishDue(limit = 20): Promise<number> {
    const connection = this.getPublisherRedis();
    if (!connection) {
      return 0;
    }

    const rows = await this.prisma.coreOutbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    if (rows.length === 0) {
      return 0;
    }

    const streamKey = thunderEventStreamKey();
    let published = 0;

    for (const row of rows) {
      const envelope = buildEventEnvelope(row);
      try {
        await connection.xadd(streamKey, '*', 'data', JSON.stringify(envelope));
        await this.prisma.coreOutbox.update({
          where: { id: row.id },
          data: {
            publishedAt: new Date(),
            publishAttempts: { increment: 1 },
          },
        });
        published += 1;
      } catch (error) {
        this.logger.warn(
          error instanceof Error
            ? error.message
            : `Failed to publish outbox row ${row.id}`,
        );
      }
    }

    return published;
  }

  private getPublisherRedis(): Redis | null {
    if (!this.publisherRedis) {
      this.publisherRedis = this.redis.createBullConnection();
    }
    return this.publisherRedis;
  }

  onModuleDestroy(): void {
    if (this.publisherRedis) {
      try {
        this.publisherRedis.disconnect();
      } catch {
        // ignore shutdown races
      }
      this.publisherRedis = null;
    }
  }
}
