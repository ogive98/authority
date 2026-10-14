import { Injectable } from '@nestjs/common';
import { TrcRecallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listLots(companyId: string, productId?: string) {
    return this.prisma.trcLot.findMany({
      where: { companyId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createLot(
    companyId: string,
    dto: { lotCode: string; productId: string; productionDate?: string; expiryDate?: string },
  ) {
    return this.prisma.trcLot.create({
      data: {
        companyId,
        lotCode: dto.lotCode,
        productId: dto.productId,
        productionDate: dto.productionDate ? new Date(dto.productionDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });
  }

  async getLotTree(companyId: string, lotId: string) {
    const lot = await this.prisma.trcLot.findFirst({
      where: { id: lotId, companyId },
    });
    if (!lot) return null;

    const parents = await this.prisma.trcLink.findMany({
      where: { companyId, childLotId: lotId },
    });
    const children = await this.prisma.trcLink.findMany({
      where: { companyId, parentLotId: lotId },
    });

    return { lot, parents, children };
  }

  async linkLots(
    companyId: string,
    dto: { parentLotId: string; childLotId: string; qty: string },
  ) {
    return this.prisma.trcLink.create({
      data: {
        companyId,
        parentLotId: dto.parentLotId,
        childLotId: dto.childLotId,
        qty: parseFloat(dto.qty),
      },
    });
  }

  async listRecalls(companyId: string) {
    return this.prisma.trcRecall.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createRecall(
    companyId: string,
    dto: { lotId: string; reason: string; initiatedBy: string },
  ) {
    const count = await this.prisma.trcRecall.count({ where: { companyId } });
    const year = new Date().getFullYear();
    const number = `RECALL-${year}-${(count + 1).toString().padStart(4, '0')}`;
    return this.prisma.trcRecall.create({
      data: {
        companyId,
        number,
        lotId: dto.lotId,
        reason: dto.reason,
        status: TrcRecallStatus.PLANNED,
        initiatedBy: dto.initiatedBy,
        initiatedAt: new Date(),
      },
    });
  }

  async completeRecall(companyId: string, id: string) {
    return this.prisma.trcRecall.update({
      where: { id, companyId },
      data: {
        status: TrcRecallStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }
}
