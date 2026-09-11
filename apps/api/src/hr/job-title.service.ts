import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type HrJobTitle } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import type { CreateJobTitleDto, PatchJobTitleDto } from './hr.dto';
import { HrException } from './hr.exception';

export type HrJobTitleDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class JobTitleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<{ items: HrJobTitleDto[] }> {
    const rows = await this.prisma.hrJobTitle.findMany({
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
    dto: CreateJobTitleDto,
  ): Promise<HrJobTitleDto> {
    const code = normalizeJobCode(dto.code);
    const name = dto.name.trim();
    if (!code) {
      throw new HrException(
        HR_ERROR_CODES.JOB_TITLE_INVALID_CODE,
        'Job title code is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!name) {
      throw new HrException(
        HR_ERROR_CODES.JOB_TITLE_INVALID_CODE,
        'Job title name is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const duplicate = await this.prisma.hrJobTitle.findFirst({
      where: { companyId, code, deletedAt: null },
    });
    if (duplicate) {
      throw new HrException(
        HR_ERROR_CODES.JOB_TITLE_CODE_EXISTS,
        'Job title code already exists for this company.',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrJobTitle.create({
        data: { companyId, code, name, active: true },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.JOB_TITLE_CREATED,
        aggregateType: 'hr_job_title',
        aggregateId: row.id,
        payloadJson: { jobTitleId: row.id, code: row.code },
      });
      return row;
    });
    return serialize(created);
  }

  async patch(
    companyId: string,
    id: string,
    dto: PatchJobTitleDto,
  ): Promise<HrJobTitleDto> {
    const current = await this.findActive(companyId, id);
    const data: Prisma.HrJobTitleUpdateInput = { version: { increment: 1 } };
    if (dto.code !== undefined) {
      const code = normalizeJobCode(dto.code);
      if (!code) {
        throw new HrException(
          HR_ERROR_CODES.JOB_TITLE_INVALID_CODE,
          'Job title code is required.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code !== current.code) {
        const duplicate = await this.prisma.hrJobTitle.findFirst({
          where: { companyId, code, deletedAt: null, id: { not: id } },
        });
        if (duplicate) {
          throw new HrException(
            HR_ERROR_CODES.JOB_TITLE_CODE_EXISTS,
            'Job title code already exists for this company.',
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
          HR_ERROR_CODES.JOB_TITLE_INVALID_CODE,
          'Job title name is required.',
          HttpStatus.BAD_REQUEST,
        );
      }
      data.name = name;
    }
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrJobTitle.update({
        where: { id },
        data,
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.JOB_TITLE_UPDATED,
        aggregateType: 'hr_job_title',
        aggregateId: row.id,
        payloadJson: {
          jobTitleId: row.id,
          code: row.code,
          active: row.active,
        },
      });
      return row;
    });
    return serialize(updated);
  }

  async findActive(companyId: string, id: string): Promise<HrJobTitle> {
    const row = await this.prisma.hrJobTitle.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.JOB_TITLE_NOT_FOUND,
        'Job title not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  /**
   * Resolve a catalog id for assignment. `allowInactiveId` keeps a current
   * archived poste on the employee without forcing a new pick.
   */
  async resolveAssignableId(
    companyId: string,
    jobTitleId: string | null | undefined,
    allowInactiveId?: string | null,
  ): Promise<string | null | undefined> {
    if (jobTitleId === undefined) return undefined;
    if (jobTitleId === null) return null;
    const row = await this.findActive(companyId, jobTitleId);
    if (!row.active && row.id !== allowInactiveId) {
      throw new HrException(
        HR_ERROR_CODES.JOB_TITLE_INACTIVE,
        'Cannot assign an archived job title.',
        HttpStatus.CONFLICT,
      );
    }
    return row.id;
  }
}

export function normalizeJobCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function serialize(row: HrJobTitle): HrJobTitleDto {
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
