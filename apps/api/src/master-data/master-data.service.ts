import { HttpStatus, Injectable } from '@nestjs/common';
import { MdRefKind, Prisma } from '@prisma/client';
import { PRODUCTS_ERROR_CODES } from '../products/products.constants';
import { ProductsException } from '../products/products.exception';
import { PrismaService } from '../prisma/prisma.service';

export type RefValueDto = {
  kind: MdRefKind;
  code: string;
  label: string;
  sort: number;
  enabled: boolean;
  meta: Record<string, unknown>;
};

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
