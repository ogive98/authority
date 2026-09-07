import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_PRUNE_BATCH = 5_000;

@Injectable()
export class ProcessedEventService {
  constructor(private readonly prisma: PrismaService) {}

  async isProcessed(consumer: string, eventId: string): Promise<boolean> {
    const row = await this.prisma.coreProcessedEvent.findFirst({
      where: { consumer, eventId },
      select: { id: true },
    });
    return row !== null;
  }

  async markProcessed(
    consumer: string,
    eventId: string,
  ): Promise<'new' | 'duplicate'> {
    try {
      await this.prisma.coreProcessedEvent.create({
        data: { consumer, eventId },
      });
      return 'new';
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return 'duplicate';
      }
      throw error;
    }
  }

  async countRows(): Promise<number> {
    return this.prisma.coreProcessedEvent.count();
  }

  /**
   * Delete oldest processed rows past retention (batched).
   * Env: THUNDER_PROCESSED_EVENT_RETENTION_DAYS (default 7),
   *      THUNDER_PROCESSED_EVENT_PRUNE_BATCH (default 5000).
   */
  async pruneExpired(opts?: {
    retentionDays?: number;
    batchSize?: number;
  }): Promise<{ deleted: number; cutoff: string }> {
    const retentionDays = Math.max(
      1,
      opts?.retentionDays ??
        readPositiveInt(
          process.env.THUNDER_PROCESSED_EVENT_RETENTION_DAYS,
          DEFAULT_RETENTION_DAYS,
        ),
    );
    const batchSize = Math.max(
      1,
      opts?.batchSize ??
        readPositiveInt(
          process.env.THUNDER_PROCESSED_EVENT_PRUNE_BATCH,
          DEFAULT_PRUNE_BATCH,
        ),
    );
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM core_processed_event
      WHERE processed_at < ${cutoff}
      ORDER BY processed_at ASC
      LIMIT ${batchSize}
    `;

    if (ids.length === 0) {
      return { deleted: 0, cutoff: cutoff.toISOString() };
    }

    const result = await this.prisma.coreProcessedEvent.deleteMany({
      where: { id: { in: ids.map((row) => row.id) } },
    });

    return {
      deleted: result.count,
      cutoff: cutoff.toISOString(),
    };
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}
