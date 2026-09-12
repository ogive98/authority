import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type HrDocKind } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import type { CreateDocKindDto, PatchDocKindDto } from './hr.dto';
import { HrException } from './hr.exception';
import { normalizeJobCode } from './job-title.service';

export type HrDocKindDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Company dossier kinds — empty until human; never seed CIN/contrat (D215). */
@Injectable()
export class DocKindService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<{ items: HrDocKindDto[] }> {
    const rows = await this.prisma.hrDocKind.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts.activeOnly ? { active: true } : {}),
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
    return { items: rows.map(serialize) };
  }

  async create(
    companyId: string,
    dto: CreateDocKindDto,
  ): Promise<HrDocKindDto> {
    const code = normalizeJobCode(dto.code);
    const name = dto.name.trim();
    if (!code) {
      throw new HrException(
        HR_ERROR_CODES.DOC_KIND_INVALID_CODE,
        'Document kind code is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!name) {
      throw new HrException(
        HR_ERROR_CODES.DOC_KIND_INVALID_CODE,
        'Document kind name is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const duplicate = await this.prisma.hrDocKind.findFirst({
      where: { companyId, code, deletedAt: null },
    });
    if (duplicate) {
      throw new HrException(
        HR_ERROR_CODES.DOC_KIND_CODE_EXISTS,
        'Document kind code already exists for this company.',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrDocKind.create({
        data: { companyId, code, name, active: true },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.DOC_KIND_CREATED,
        aggregateType: 'hr_doc_kind',
        aggregateId: row.id,
        payloadJson: { docKindId: row.id, code: row.code },
      });
      return row;
    });
    return serialize(created);
  }

  async patch(
    companyId: string,
    id: string,
    dto: PatchDocKindDto,
  ): Promise<HrDocKindDto> {
    const current = await this.findActive(companyId, id);
    const data: Prisma.HrDocKindUpdateInput = { version: { increment: 1 } };
    if (dto.code !== undefined) {
      const code = normalizeJobCode(dto.code);
      if (!code) {
        throw new HrException(
          HR_ERROR_CODES.DOC_KIND_INVALID_CODE,
          'Document kind code is required.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code !== current.code) {
        const duplicate = await this.prisma.hrDocKind.findFirst({
          where: { companyId, code, deletedAt: null, id: { not: id } },
        });
        if (duplicate) {
          throw new HrException(
            HR_ERROR_CODES.DOC_KIND_CODE_EXISTS,
            'Document kind code already exists for this company.',
            HttpStatus.CONFLICT,
          );
        }
        data.code = code;
      }
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new HrException(
          HR_ERROR_CODES.DOC_KIND_INVALID_CODE,
          'Document kind name is required.',
          HttpStatus.BAD_REQUEST,
        );
      }
      data.name = name;
    }
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrDocKind.update({
        where: { id: current.id },
        data,
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.DOC_KIND_UPDATED,
        aggregateType: 'hr_doc_kind',
        aggregateId: row.id,
        payloadJson: {
          docKindId: row.id,
          code: row.code,
          active: row.active,
        },
      });
      return row;
    });
    return serialize(updated);
  }

  /**
   * Resolve assignable kind id — null clears; inactive rejected unless
   * already on the document (allowInactiveId).
   */
  async resolveAssignableId(
    companyId: string,
    kindId: string | null | undefined,
    allowInactiveId?: string | null,
  ): Promise<string | null> {
    if (kindId === undefined) return null;
    if (kindId === null || kindId === '') return null;
    const row = await this.prisma.hrDocKind.findFirst({
      where: { id: kindId, companyId, deletedAt: null },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.DOC_KIND_NOT_FOUND,
        'Document kind not found.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!row.active && row.id !== allowInactiveId) {
      throw new HrException(
        HR_ERROR_CODES.DOC_KIND_INACTIVE,
        'Cannot assign an archived document kind.',
        HttpStatus.CONFLICT,
      );
    }
    return row.id;
  }

  private async findActive(companyId: string, id: string): Promise<HrDocKind> {
    const row = await this.prisma.hrDocKind.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.DOC_KIND_NOT_FOUND,
        'Document kind not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serialize(row: HrDocKind): HrDocKindDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
