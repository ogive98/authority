import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OUTBOX_EVENT_TYPES } from '../audit/audit.constants';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_ENTITY_TYPES,
  PLATFORM_ERROR_CODES,
} from './platform.constants';
import { PlatformException } from './platform.exception';

export interface AllocateNumberInput {
  companyId: string;
  siteId?: string;
  docType: string;
  year: number;
  actorUserId: string;
  correlationId?: string;
}

export interface AllocateNumberResult {
  docType: string;
  year: number;
  allocatedValue: number;
  number: string;
  seriesId: string;
}

interface LockedSeriesRow {
  id: string;
  prefix: string;
  padding: number;
  next_value: number;
}

@Injectable()
export class NumberingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async allocate(input: AllocateNumberInput): Promise<AllocateNumberResult> {
    return this.prisma.$transaction(async (tx) => {
      const siteId = input.siteId ?? null;

      const series = await tx.coreNumberingSeries.findFirst({
        where: {
          companyId: input.companyId,
          siteId,
          docType: input.docType,
          year: input.year,
          deletedAt: null,
        },
      });

      if (!series) {
        throw new PlatformException(
          PLATFORM_ERROR_CODES.SERIES_MISSING,
          `Numbering series not found for ${input.docType}/${input.year}.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const locked = await tx.$queryRaw<LockedSeriesRow[]>(
        Prisma.sql`
          SELECT id, prefix, padding, next_value
          FROM core_numbering_series
          WHERE id = ${series.id}::uuid
          FOR UPDATE
        `,
      );

      const row = locked[0];
      const allocatedValue = row.next_value;

      await tx.coreNumberingSeries.update({
        where: { id: row.id },
        data: {
          nextValue: allocatedValue + 1,
          version: { increment: 1 },
        },
      });

      const number = formatDocumentNumber(
        row.prefix,
        input.year,
        allocatedValue,
        row.padding,
      );

      const result: AllocateNumberResult = {
        docType: input.docType,
        year: input.year,
        allocatedValue,
        number,
        seriesId: row.id,
      };

      await this.auditService.append(tx, {
        companyId: input.companyId,
        siteId: input.siteId,
        actorUserId: input.actorUserId,
        action: PLATFORM_AUDIT_ACTIONS.numberAllocated,
        entityType: PLATFORM_ENTITY_TYPES.numberingSeries,
        entityId: row.id,
        afterJson: result as unknown as Prisma.InputJsonValue,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: PLATFORM_ENTITY_TYPES.numberingSeries,
        aggregateId: row.id,
        eventType: OUTBOX_EVENT_TYPES.platformNumberAllocated,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.platformNumberAllocated,
          eventVersion: 1,
          source: 'platform',
          actorId: input.actorUserId,
          companyId: input.companyId,
          siteId: input.siteId ?? null,
          correlationId: input.correlationId ?? null,
          payload: result as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });
  }
}

export function formatDocumentNumber(
  prefix: string,
  year: number,
  value: number,
  padding: number,
): string {
  return `${prefix}${year}-${String(value).padStart(padding, '0')}`;
}
