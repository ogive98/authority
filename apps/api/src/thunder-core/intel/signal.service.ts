import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  Prisma,
  ThuSignal,
  ThuSignalSeverity,
  ThuSignalStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { THUNDER_ERROR_CODES } from '../thunder.constants';
import { ThunderException } from '../thunder.exception';

export type CreateSignalInput = {
  companyId: string;
  siteId?: string | null;
  type: string;
  severity?: ThuSignalSeverity;
  source: string;
  sourceEventId?: string | null;
  sourceEventType?: string | null;
  correlationId: string;
  evidence: Record<string, unknown>;
  occurredAt?: Date;
};

@Injectable()
export class SignalService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSignalInput): Promise<ThuSignal> {
    if (!input.companyId) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.COMPANY_REQUIRED,
        'companyId is required for signals',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.sourceEventId) {
      const existing = await this.prisma.thuSignal.findUnique({
        where: {
          companyId_type_sourceEventId: {
            companyId: input.companyId,
            type: input.type,
            sourceEventId: input.sourceEventId,
          },
        },
      });
      if (existing) {
        return existing;
      }
    }

    try {
      return await this.prisma.thuSignal.create({
        data: {
          companyId: input.companyId,
          siteId: input.siteId ?? null,
          type: input.type,
          severity: input.severity ?? 'INFO',
          source: input.source,
          sourceEventId: input.sourceEventId ?? null,
          sourceEventType: input.sourceEventType ?? null,
          correlationId: input.correlationId,
          evidenceJson: input.evidence as Prisma.InputJsonValue,
          occurredAt: input.occurredAt ?? new Date(),
        },
      });
    } catch (error) {
      if (
        input.sourceEventId &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const again = await this.prisma.thuSignal.findUnique({
          where: {
            companyId_type_sourceEventId: {
              companyId: input.companyId,
              type: input.type,
              sourceEventId: input.sourceEventId,
            },
          },
        });
        if (again) {
          return again;
        }
      }
      throw error;
    }
  }

  async list(
    companyId: string,
    opts?: { status?: ThuSignalStatus; take?: number },
  ): Promise<ThuSignal[]> {
    return this.prisma.thuSignal.findMany({
      where: {
        companyId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
    });
  }

  async ack(companyId: string, id: string): Promise<ThuSignal> {
    const row = await this.prisma.thuSignal.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.SIGNAL_NOT_FOUND,
        'Signal not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status === 'ACK' || row.status === 'CLOSED') {
      return row;
    }
    return this.prisma.thuSignal.update({
      where: { id },
      data: { status: 'ACK' },
    });
  }
}
