import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditAppendInput {
  companyId?: string;
  siteId?: string;
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  beforeJson?: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
  ip?: string;
  device?: string;
  correlationId?: string;
  mode?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append-only: never update or delete aud_event rows. */
  async append(
    tx: Prisma.TransactionClient,
    input: AuditAppendInput,
  ): Promise<{ id: string }> {
    const row = await tx.audEvent.create({
      data: {
        companyId: input.companyId,
        siteId: input.siteId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: input.beforeJson,
        afterJson: input.afterJson,
        ip: input.ip,
        device: input.device,
        correlationId: input.correlationId,
        mode: input.mode,
      },
      select: { id: true },
    });
    return row;
  }
}
