import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MdParty,
  MdPartyStatus,
  MdPartyType,
  MdRefKind,
  Prisma,
} from '@prisma/client';
import { PRODUCTS_ERROR_CODES } from '../products/products.constants';
import { ProductsException } from '../products/products.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MASTER_DATA_ERROR_CODES } from './master-data.constants';
import { MasterDataException } from './master-data.exception';

export type RefValueDto = {
  kind: MdRefKind;
  code: string;
  label: string;
  sort: number;
  enabled: boolean;
  meta: Record<string, unknown>;
};

export type PartyDto = {
  id: string;
  companyId: string;
  type: MdPartyType;
  legalName: string;
  taxId: string | null;
  defaultLang: string | null;
  status: MdPartyStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listRefs(
    companyId: string,
    kind?: MdRefKind,
  ): Promise<{ items: RefValueDto[] }> {
    const rows = await this.prisma.mdRefValue.findMany({
      where: {
        companyId,
        deletedAt: null,
        enabled: true,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ kind: 'asc' }, { sort: 'asc' }, { code: 'asc' }],
    });
    return {
      items: rows.map((r) => ({
        kind: r.kind,
        code: r.code,
        label: r.label,
        sort: r.sort,
        enabled: r.enabled,
        meta: asObject(r.metaJson),
      })),
    };
  }

  async assertProductRefs(
    companyId: string,
    refs: {
      typeKey: string;
      uom: string;
      storageClassKey: string;
      allergenFlags: string[];
    },
  ): Promise<void> {
    await this.assertCode(companyId, MdRefKind.product_type, refs.typeKey);
    await this.assertCode(companyId, MdRefKind.uom, refs.uom);
    await this.assertCode(
      companyId,
      MdRefKind.storage_class,
      refs.storageClassKey,
    );
    for (const code of refs.allergenFlags) {
      await this.assertCode(companyId, MdRefKind.allergen, code);
    }
  }

  async assertCode(
    companyId: string,
    kind: MdRefKind,
    code: string,
  ): Promise<void> {
    const row = await this.prisma.mdRefValue.findFirst({
      where: {
        companyId,
        kind,
        code,
        enabled: true,
        deletedAt: null,
      },
    });
    if (!row) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.REF_UNKNOWN,
        `Unknown or disabled reference ${kind}/${code}.`,
        HttpStatus.BAD_REQUEST,
        { kind, refCode: code },
      );
    }
  }

  async applyIndustryPack(
    companyId: string,
    packKey: string,
  ): Promise<{ packKey: string; upserted: number }> {
    const pack = await this.prisma.saIndustryPack.findUnique({
      where: { key: packKey },
      include: { items: true },
    });
    if (!pack) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.REF_UNKNOWN,
        `Industry pack not found: ${packKey}`,
        HttpStatus.NOT_FOUND,
        { packKey },
      );
    }

    let upserted = 0;
    for (const item of pack.items) {
      await this.prisma.mdRefValue.upsert({
        where: {
          companyId_kind_code: {
            companyId,
            kind: item.kind,
            code: item.code,
          },
        },
        update: {
          label: item.label,
          sort: item.sort,
          metaJson: toInputJson(item.metaJson),
          enabled: true,
          deletedAt: null,
          version: { increment: 1 },
        },
        create: {
          companyId,
          kind: item.kind,
          code: item.code,
          label: item.label,
          sort: item.sort,
          metaJson: toInputJson(item.metaJson),
          enabled: true,
        },
      });
      upserted += 1;
    }
    return { packKey: pack.key, upserted };
  }

  async listParties(
    companyId: string,
    opts: { q?: string; type?: MdPartyType; limit?: number } = {},
  ): Promise<{ items: PartyDto[] }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.MdPartyWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts.type ? { type: opts.type } : {}),
    };
    if (opts.q?.trim()) {
      where.legalName = { contains: opts.q.trim(), mode: 'insensitive' };
    }
    const rows = await this.prisma.mdParty.findMany({
      where,
      orderBy: [{ legalName: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return { items: rows.map(serializeParty) };
  }

  async getParty(companyId: string, id: string): Promise<PartyDto> {
    const row = await this.requireParty(companyId, id);
    return serializeParty(row);
  }

  async createParty(
    companyId: string,
    input: {
      type: MdPartyType;
      legalName: string;
      taxId?: string;
      defaultLang?: string;
    },
    db: DbClient = this.prisma,
  ): Promise<MdParty> {
    return db.mdParty.create({
      data: {
        companyId,
        type: input.type,
        legalName: input.legalName.trim(),
        taxId: input.taxId?.trim() || null,
        defaultLang: input.defaultLang?.trim() || null,
        status: MdPartyStatus.ACTIVE,
      },
    });
  }

  async requireParty(
    companyId: string,
    id: string,
    db: DbClient = this.prisma,
  ): Promise<MdParty> {
    const row = await db.mdParty.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new MasterDataException(
        MASTER_DATA_ERROR_CODES.PARTY_NOT_FOUND,
        'Party not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeParty(row: MdParty): PartyDto {
  return {
    id: row.id,
    companyId: row.companyId,
    type: row.type,
    legalName: row.legalName,
    taxId: row.taxId,
    defaultLang: row.defaultLang,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function toInputJson(
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
