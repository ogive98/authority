import { HttpStatus, Injectable } from '@nestjs/common';
import {
  HrPrintDocKind,
  Prisma,
  type HrPrintTemplate,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import type {
  CreatePrintTemplateDto,
  PatchPrintTemplateDto,
} from './hr.dto';
import { HrException } from './hr.exception';
import { normalizeJobCode } from './job-title.service';

export type HrPrintTemplateDto = {
  id: string;
  companyId: string;
  kind: HrPrintDocKind;
  code: string;
  name: string;
  letterhead: string;
  bodyHtml: string;
  footer: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Company print templates (D217 B) — empty until human; never seed legal text. */
@Injectable()
export class PrintTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: { kind?: HrPrintDocKind; activeOnly?: boolean } = {},
  ): Promise<{ items: HrPrintTemplateDto[] }> {
    const rows = await this.prisma.hrPrintTemplate.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }, { code: 'asc' }],
    });
    return { items: rows.map(serialize) };
  }

  async create(
    companyId: string,
    dto: CreatePrintTemplateDto,
  ): Promise<HrPrintTemplateDto> {
    const code = normalizeJobCode(dto.code);
    const name = dto.name.trim();
    if (!code) {
      throw new HrException(
        HR_ERROR_CODES.PRINT_TEMPLATE_INVALID_CODE,
        'Print template code is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!name) {
      throw new HrException(
        HR_ERROR_CODES.PRINT_TEMPLATE_INVALID_CODE,
        'Print template name is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const duplicate = await this.prisma.hrPrintTemplate.findFirst({
      where: { companyId, kind: dto.kind, code, deletedAt: null },
    });
    if (duplicate) {
      throw new HrException(
        HR_ERROR_CODES.PRINT_TEMPLATE_CODE_EXISTS,
        'Print template code already exists for this kind.',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrPrintTemplate.create({
        data: {
          companyId,
          kind: dto.kind,
          code,
          name,
          letterhead: dto.letterhead?.trim() ?? '',
          bodyHtml: dto.bodyHtml?.trim() ?? '',
          footer: dto.footer?.trim() ?? '',
          active: true,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.PRINT_TEMPLATE_CREATED,
        aggregateType: 'hr_print_template',
        aggregateId: row.id,
        payloadJson: { templateId: row.id, kind: row.kind, code: row.code },
      });
      return row;
    });
    return serialize(created);
  }

  async patch(
    companyId: string,
    id: string,
    dto: PatchPrintTemplateDto,
  ): Promise<HrPrintTemplateDto> {
    const current = await this.findActive(companyId, id);
    const data: Prisma.HrPrintTemplateUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.code !== undefined) {
      const code = normalizeJobCode(dto.code);
      if (!code) {
        throw new HrException(
          HR_ERROR_CODES.PRINT_TEMPLATE_INVALID_CODE,
          'Print template code is required.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const duplicate = await this.prisma.hrPrintTemplate.findFirst({
        where: {
          companyId,
          kind: current.kind,
          code,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new HrException(
          HR_ERROR_CODES.PRINT_TEMPLATE_CODE_EXISTS,
          'Print template code already exists for this kind.',
          HttpStatus.CONFLICT,
        );
      }
      data.code = code;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new HrException(
          HR_ERROR_CODES.PRINT_TEMPLATE_INVALID_CODE,
          'Print template name is required.',
          HttpStatus.BAD_REQUEST,
        );
      }
      data.name = name;
    }
    if (dto.letterhead !== undefined) data.letterhead = dto.letterhead;
    if (dto.bodyHtml !== undefined) data.bodyHtml = dto.bodyHtml;
    if (dto.footer !== undefined) data.footer = dto.footer;
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrPrintTemplate.update({
        where: { id },
        data,
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.PRINT_TEMPLATE_UPDATED,
        aggregateType: 'hr_print_template',
        aggregateId: row.id,
        payloadJson: { templateId: row.id, kind: row.kind, code: row.code },
      });
      return row;
    });
    return serialize(updated);
  }

  async resolveForGenerate(
    companyId: string,
    kind: HrPrintDocKind,
    templateId: string | undefined,
  ): Promise<{ letterhead: string; bodyHtml: string; footer: string } | null> {
    if (!templateId) return null;
    const row = await this.prisma.hrPrintTemplate.findFirst({
      where: {
        id: templateId,
        companyId,
        kind,
        deletedAt: null,
        active: true,
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.PRINT_TEMPLATE_NOT_FOUND,
        'Print template not found or inactive.',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      letterhead: row.letterhead,
      bodyHtml: row.bodyHtml,
      footer: row.footer,
    };
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<HrPrintTemplate> {
    const row = await this.prisma.hrPrintTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.PRINT_TEMPLATE_NOT_FOUND,
        'Print template not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serialize(row: HrPrintTemplate): HrPrintTemplateDto {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind,
    code: row.code,
    name: row.name,
    letterhead: row.letterhead,
    bodyHtml: row.bodyHtml,
    footer: row.footer,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
