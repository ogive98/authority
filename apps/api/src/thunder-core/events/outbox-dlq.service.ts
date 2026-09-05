import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scrubSecrets } from '../../common/json-safety';
import { PrismaService } from '../../prisma/prisma.service';

export interface MoveOutboxToDlqInput {
  outboxId: string;
  companyId?: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  payloadJson: Prisma.JsonValue;
  headers?: Prisma.JsonValue | null;
  lastError: string;
  publishAttempts: number;
  createdAt: Date;
}

@Injectable()
export class OutboxDlqService {
  private readonly logger = new Logger(OutboxDlqService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Persist scrubbed outbox row into DLQ (caller deletes/updates outbox). */
  async record(
    tx: Prisma.TransactionClient,
    input: MoveOutboxToDlqInput,
  ): Promise<{ id: string }> {
    const scrubbedPayload = scrubSecrets(input.payloadJson) as Prisma.InputJsonValue;
    const scrubbedHeaders =
      input.headers == null
        ? undefined
        : (scrubSecrets(input.headers) as Prisma.InputJsonValue);

    const row = await tx.coreOutboxDlq.create({
      data: {
        outboxId: input.outboxId,
        companyId: input.companyId ?? undefined,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        eventVersion: input.eventVersion,
        payloadJson: scrubbedPayload,
        headers: scrubbedHeaders,
        lastError: input.lastError.slice(0, 2000),
        publishAttempts: input.publishAttempts,
        createdAt: input.createdAt,
        failedAt: new Date(),
      },
      select: { id: true },
    });

    this.logger.error(
      `Outbox ${input.outboxId} moved to DLQ after ${input.publishAttempts} publish attempts (${input.eventType})`,
    );

    return row;
  }

  async list(params: { limit?: number; cursor?: string }) {
    const limit = Math.min(params.limit ?? 20, 100);
    const rows = await this.prisma.coreOutboxDlq.findMany({
      take: limit + 1,
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { failedAt: 'desc' },
      select: {
        id: true,
        outboxId: true,
        companyId: true,
        aggregateType: true,
        aggregateId: true,
        eventType: true,
        eventVersion: true,
        lastError: true,
        publishAttempts: true,
        createdAt: true,
        failedAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  async count(): Promise<number> {
    return this.prisma.coreOutboxDlq.count();
  }
}
