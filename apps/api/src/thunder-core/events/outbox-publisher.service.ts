import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { CoreOutbox, Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { thunderEventStreamKey } from '../thunder.constants';
import { buildEventEnvelope } from './event-envelope.builder';

const DEFAULT_BATCH = 100;
const MIN_BATCH = 1;
const MAX_BATCH = 200;

type ClaimedOutboxRow = {
  id: string;
  companyId: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  payloadJson: Prisma.JsonValue;
  headers: Prisma.JsonValue | null;
  createdAt: Date;
  publishedAt: Date | null;
  publishAttempts: number;
};

/** Clamp outbox batch to 1–200 (THU-HARD-01). */
export function clampOutboxBatchSize(
  value: number,
  fallback = DEFAULT_BATCH,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.trunc(value)));
}

/** Configurable outbox batch from env (THU-HARD-01). */
export function resolveOutboxBatchSize(
  raw: string | undefined = process.env.THUNDER_OUTBOX_BATCH_SIZE,
  fallback = DEFAULT_BATCH,
): number {
  if (raw === undefined || raw === '') {
    return clampOutboxBatchSize(fallback, fallback);
  }
  return clampOutboxBatchSize(Number(raw), fallback);
}

@Injectable()
export class OutboxPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private publisherRedis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Claim unpublished rows with FOR UPDATE SKIP LOCKED (multi-publisher safe),
   * then XADD + mark published inside the same transaction.
   */
  async publishDue(limit = resolveOutboxBatchSize()): Promise<number> {
    const connection = this.getPublisherRedis();
    if (!connection) {
      return 0;
    }

    const batchSize = clampOutboxBatchSize(limit);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedOutboxRow[]>`
        SELECT
          id,
          company_id AS "companyId",
          aggregate_type AS "aggregateType",
          aggregate_id AS "aggregateId",
          event_type AS "eventType",
          event_version AS "eventVersion",
          payload_json AS "payloadJson",
          headers,
          created_at AS "createdAt",
          published_at AS "publishedAt",
          publish_attempts AS "publishAttempts"
        FROM core_outbox
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) {
        return 0;
      }

      const streamKey = thunderEventStreamKey();
      let published = 0;

      for (const row of rows) {
        const coreRow = this.toCoreOutbox(row);
        const envelope = buildEventEnvelope(coreRow);
        try {
          await connection.xadd(
            streamKey,
            '*',
            'data',
            JSON.stringify(envelope),
          );
          await tx.coreOutbox.update({
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
    });
  }

  private toCoreOutbox(row: ClaimedOutboxRow): CoreOutbox {
    return {
      id: row.id,
      companyId: row.companyId,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      eventVersion: row.eventVersion,
      payloadJson: row.payloadJson,
      headers: row.headers,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      publishedAt: row.publishedAt
        ? row.publishedAt instanceof Date
          ? row.publishedAt
          : new Date(row.publishedAt)
        : null,
      publishAttempts: row.publishAttempts,
    };
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
