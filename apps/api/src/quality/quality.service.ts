import { Injectable } from '@nestjs/common';
import { QuaCheckResult, QuaCheckTarget, QuaNcrSeverity, QuaNcrStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async listChecks(companyId: string) {
    return this.prisma.quaCheck.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createCheck(
    companyId: string,
    dto: {
      target: QuaCheckTarget;
      targetId: string;
      lotId?: string;
      result?: QuaCheckResult;
      measures?: any;
      notes?: string;
      checkedBy?: string;
    },
  ) {
    const number = await this.nextCheckNumber(companyId);
    return this.prisma.quaCheck.create({
      data: {
        companyId,
        number,
        target: dto.target,
        targetId: dto.targetId,
        lotId: dto.lotId,
        result: dto.result ?? QuaCheckResult.PENDING,
        measures: dto.measures,
        notes: dto.notes,
        checkedBy: dto.checkedBy,
        checkedAt: dto.result ? new Date() : null,
      },
    });
  }

  async listNcrs(companyId: string) {
    return this.prisma.quaNcr.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createNcr(
    companyId: string,
    dto: {
      severity: QuaNcrSeverity;
      description: string;
      lotId?: string;
      checkId?: string;
      openedBy?: string;
    },
  ) {
    const number = await this.nextNcrNumber(companyId);
    return this.prisma.quaNcr.create({
      data: {
        companyId,
        number,
        severity: dto.severity,
        status: QuaNcrStatus.OPEN,
        description: dto.description,
        lotId: dto.lotId,
        checkId: dto.checkId,
        openedBy: dto.openedBy,
      },
    });
  }

  async closeNcr(companyId: string, id: string, disposition: string, closedBy: string) {
    return this.prisma.quaNcr.update({
      where: { id, companyId },
      data: {
        status: QuaNcrStatus.CLOSED,
        disposition,
        closedBy,
        closedAt: new Date(),
      },
    });
  }

  async holdLot(companyId: string, lotId: string, reason: string, heldBy: string) {
    await this.prisma.invLot.update({
      where: { id: lotId, companyId },
      data: { status: 'QUARANTINE' },
    });
    return this.prisma.quaLotHold.create({
      data: {
        companyId,
        lotId,
        reason,
        heldBy,
        heldAt: new Date(),
      },
    });
  }

  async releaseLot(companyId: string, lotId: string, releasedBy: string) {
    await this.prisma.invLot.update({
      where: { id: lotId, companyId },
      data: { status: 'OPEN' },
    });
    return this.prisma.quaLotHold.update({
      where: { companyId_lotId: { companyId, lotId } },
      data: {
        releasedBy,
        releasedAt: new Date(),
      },
    });
  }

  private async nextCheckNumber(companyId: string): Promise<string> {
    const count = await this.prisma.quaCheck.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `QC-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }

  private async nextNcrNumber(companyId: string): Promise<string> {
    const count = await this.prisma.quaNcr.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `NCR-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
}
