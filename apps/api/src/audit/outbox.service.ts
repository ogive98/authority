import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OutboxEnqueueInput {
  companyId?: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventVersion?: number;
  payloadJson: Prisma.InputJsonValue;
  headers?: Prisma.InputJsonValue;
}

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    tx: Prisma.TransactionClient,
    input: OutboxEnqueueInput,
  ): Promise<{ id: string }> {
    const row = await tx.coreOutbox.create({
      data: {
        companyId: input.companyId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        eventVersion: input.eventVersion ?? 1,
        payloadJson: input.payloadJson,
        headers: input.headers,
      },
      select: { id: true },
    });
    return row;
  }
}
