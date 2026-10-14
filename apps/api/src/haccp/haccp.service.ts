import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HaccpService {
  constructor(private readonly prisma: PrismaService) {}

  async listCcps(companyId: string) {
    return this.prisma.hcpCcp.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCcp(
    companyId: string,
    dto: { code: string; name: string; criticalLimit: string; unit: string; siteId?: string },
  ) {
    return this.prisma.hcpCcp.create({
      data: { companyId, ...dto },
    });
  }

  async listRecords(companyId: string, ccpId?: string) {
    return this.prisma.hcpRecord.findMany({
      where: { companyId, ...(ccpId ? { ccpId } : {}) },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
  }

  async createRecord(
    companyId: string,
    dto: { ccpId: string; value: string; inSpec: boolean; recordedBy: string; recordedAt: string; notes?: string },
  ) {
    return this.prisma.hcpRecord.create({
      data: {
        companyId,
        ccpId: dto.ccpId,
        value: parseFloat(dto.value),
        inSpec: dto.inSpec,
        recordedBy: dto.recordedBy,
        recordedAt: new Date(dto.recordedAt),
        notes: dto.notes,
      },
    });
  }

  async listAudits(companyId: string) {
    return this.prisma.hcpAudit.findMany({
      where: { companyId },
      orderBy: { auditDate: 'desc' },
      take: 50,
    });
  }

  async createAudit(
    companyId: string,
    dto: { auditDate: string; auditor: string; findings?: any; status?: string },
  ) {
    const count = await this.prisma.hcpAudit.count({ where: { companyId } });
    const year = new Date().getFullYear();
    const number = `HCP-AUD-${year}-${(count + 1).toString().padStart(4, '0')}`;
    return this.prisma.hcpAudit.create({
      data: {
        companyId,
        number,
        auditDate: new Date(dto.auditDate),
        auditor: dto.auditor,
        findings: dto.findings,
        status: dto.status ?? 'PLANNED',
      },
    });
  }
}
