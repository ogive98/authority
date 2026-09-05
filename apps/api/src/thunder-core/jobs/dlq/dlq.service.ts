import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scrubSecrets } from '../../../common/json-safety';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordDlqInput {
  jobId: string;
  companyId?: string;
  jobType: string;
  queue: string;
  payloadJson: Prisma.JsonValue;
  lastError: string;
  attempts: number;
}

@Injectable()
export class DlqService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordDlqInput): Promise<{ id: string }> {
    const scrubbed = scrubSecrets(input.payloadJson) as Prisma.InputJsonValue;
    const row = await this.prisma.thunderDlqEntry.create({
      data: {
        jobId: input.jobId,
        companyId: input.companyId,
        jobType: input.jobType,
        queue: input.queue,
        payloadJson: scrubbed,
        lastError: input.lastError,
        attempts: input.attempts,
      },
      select: { id: true },
    });
    return row;
  }

  async list(params: { limit?: number; cursor?: string }) {
    const limit = Math.min(params.limit ?? 20, 100);
    const rows = await this.prisma.thunderDlqEntry.findMany({
      take: limit + 1,
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        jobId: true,
        companyId: true,
        jobType: true,
        queue: true,
        lastError: true,
        attempts: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }
}
