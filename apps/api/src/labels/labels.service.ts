import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LabelsException } from './labels.exception';
import { LABELS_ERROR_CODES } from './labels.constants';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(companyId: string) {
    return this.prisma.lblTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(
    companyId: string,
    dto: { code: string; name: string; zpl: string; widthMm: number; heightMm: number },
  ) {
    return this.prisma.lblTemplate.create({
      data: { companyId, ...dto },
    });
  }

  async renderLabel(
    companyId: string,
    dto: { templateId: string; lotId?: string; data?: any; printerName?: string },
  ) {
    const template = await this.prisma.lblTemplate.findFirst({
      where: { id: dto.templateId, companyId },
    });
    if (!template) {
      throw new LabelsException(LABELS_ERROR_CODES.NOT_FOUND, 'Template not found');
    }

    // Simple variable substitution in ZPL
    let zpl = template.zpl;
    for (const [key, value] of Object.entries(dto.data || {})) {
      zpl = zpl.replace(new RegExp(`\{${key}\}`, 'g'), String(value));
    }

    const log = await this.prisma.lblPrintLog.create({
      data: {
        companyId,
        templateId: dto.templateId,
        lotId: dto.lotId,
        data: dto.data,
        status: 'PRINTED',
        printedAt: new Date(),
        printerName: dto.printerName,
      },
    });

    return { zpl, log };
  }

  async listLogs(companyId: string) {
    return this.prisma.lblPrintLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
