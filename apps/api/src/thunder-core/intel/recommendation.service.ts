import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma, ThuRecommendation } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { THUNDER_ERROR_CODES } from '../thunder.constants';
import { ThunderException } from '../thunder.exception';

export type CreateRecommendationInput = {
  companyId: string;
  signalId?: string | null;
  problem: string;
  evidence: Record<string, unknown>;
  options: Array<Record<string, unknown>>;
  autonomyLevel?: number;
  proposedAction: Record<string, unknown>;
  correlationId: string;
};

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateRecommendationInput): Promise<ThuRecommendation> {
    if (!input.companyId) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.COMPANY_REQUIRED,
        'companyId is required for recommendations',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.thuRecommendation.create({
      data: {
        companyId: input.companyId,
        signalId: input.signalId ?? null,
        problem: input.problem,
        evidenceJson: input.evidence as Prisma.InputJsonValue,
        optionsJson: input.options as Prisma.InputJsonValue,
        autonomyLevel: input.autonomyLevel ?? 2,
        proposedAction: input.proposedAction as Prisma.InputJsonValue,
        correlationId: input.correlationId,
      },
    });
  }

  async list(
    companyId: string,
    opts?: { status?: ThuRecommendation['status']; take?: number },
  ): Promise<ThuRecommendation[]> {
    return this.prisma.thuRecommendation.findMany({
      where: {
        companyId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
    });
  }

  async ignore(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<ThuRecommendation> {
    return this.decide(companyId, id, userId, 'IGNORED');
  }

  async approve(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<ThuRecommendation> {
    return this.decide(companyId, id, userId, 'APPROVED');
  }

  /**
   * Apply = record decision + audit. Domain capability execution is deferred
   * (no silent mutations). proposedAction is stored for later adapters.
   */
  async apply(
    companyId: string,
    id: string,
    userId: string,
  ): Promise<ThuRecommendation> {
    const row = await this.requireOpenOrApproved(companyId, id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.thuRecommendation.update({
        where: { id },
        data: {
          status: 'APPLIED',
          decidedByUserId: userId,
          decidedAt: new Date(),
        },
      });

      await this.audit.append(tx, {
        companyId,
        actorUserId: userId,
        action: AUDIT_ACTIONS.thunderRecoApply,
        entityType: AUDIT_ENTITY_TYPES.thuRecommendation,
        entityId: id,
        afterJson: {
          status: 'APPLIED',
          proposedAction: row.proposedAction,
          correlationId: row.correlationId,
          priorStatus: row.status,
        },
        correlationId: row.correlationId,
      });

      return updated;
    });
  }

  private async decide(
    companyId: string,
    id: string,
    userId: string,
    status: 'IGNORED' | 'APPROVED',
  ): Promise<ThuRecommendation> {
    await this.requireOpenOrApproved(companyId, id);
    return this.prisma.thuRecommendation.update({
      where: { id },
      data: {
        status,
        decidedByUserId: userId,
        decidedAt: new Date(),
      },
    });
  }

  private async requireOpenOrApproved(
    companyId: string,
    id: string,
  ): Promise<ThuRecommendation> {
    const row = await this.prisma.thuRecommendation.findFirst({
      where: { id, companyId },
    });
    if (!row) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.RECO_NOT_FOUND,
        'Recommendation not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      row.status === 'APPLIED' ||
      row.status === 'IGNORED' ||
      row.status === 'REJECTED'
    ) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.RECO_INVALID_STATE,
        `Recommendation is ${row.status}`,
        HttpStatus.CONFLICT,
      );
    }
    return row;
  }
}
