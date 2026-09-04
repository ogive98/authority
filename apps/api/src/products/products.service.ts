import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PrdProduct, PrdProductStatus } from '@prisma/client';
import { MasterDataService } from '../master-data/master-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRODUCTS_ERROR_CODES } from './products.constants';
import { ProductsException } from './products.exception';
import type { CreateProductDto, UpdateProductDto } from './products.dto';

export type ProductDto = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  typeKey: string;
  uom: string;
  trackLot: boolean;
  perishable: boolean;
  storageClassKey: string;
  allergenFlags: string[];
  status: PrdProductStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: MasterDataService,
  ) {}

  async list(
    companyId: string,
    opts: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: ProductDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.PrdProductWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.prdProduct.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map(serialize), nextCursor };
  }

  async get(companyId: string, id: string): Promise<ProductDto> {
    const row = await this.findActive(companyId, id);
    return serialize(row);
  }

  async create(companyId: string, dto: CreateProductDto): Promise<ProductDto> {
    const sku = dto.sku.trim();
    const typeKey = dto.typeKey.trim();
    const uom = dto.uom.trim();
    const storageClassKey = dto.storageClassKey.trim();
    const allergenFlags = dto.allergenFlags ?? [];

    await this.masterData.assertProductRefs(companyId, {
      typeKey,
      uom,
      storageClassKey,
      allergenFlags,
    });

    try {
      const row = await this.prisma.prdProduct.create({
        data: {
          companyId,
          sku,
          name: dto.name.trim(),
          typeKey,
          uom,
          trackLot: dto.trackLot ?? false,
          perishable: dto.perishable ?? false,
          storageClassKey,
          allergenFlags,
          status: PrdProductStatus.DRAFT,
        },
      });
      return serialize(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ProductsException(
          PRODUCTS_ERROR_CODES.SKU_DUP,
          'SKU already exists for this company.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.version !== dto.version) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.VERSION_CONFLICT,
        'Product was modified by another request.',
        HttpStatus.CONFLICT,
        { currentVersion: existing.version },
      );
    }

    const typeKey = dto.typeKey?.trim() ?? existing.typeKey;
    const uom = dto.uom?.trim() ?? existing.uom;
    const storageClassKey =
      dto.storageClassKey?.trim() ?? existing.storageClassKey;
    const allergenFlags =
      dto.allergenFlags ?? asStringArray(existing.allergenFlags);

    await this.masterData.assertProductRefs(companyId, {
      typeKey,
      uom,
      storageClassKey,
      allergenFlags,
    });

    const row = await this.prisma.prdProduct.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.typeKey !== undefined ? { typeKey } : {}),
        ...(dto.uom !== undefined ? { uom } : {}),
        ...(dto.trackLot !== undefined ? { trackLot: dto.trackLot } : {}),
        ...(dto.perishable !== undefined ? { perishable: dto.perishable } : {}),
        ...(dto.storageClassKey !== undefined ? { storageClassKey } : {}),
        ...(dto.allergenFlags !== undefined ? { allergenFlags } : {}),
        version: { increment: 1 },
      },
    });
    return serialize(row);
  }

  async activate(companyId: string, id: string): Promise<ProductDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status === PrdProductStatus.ACTIVE) {
      return serialize(existing);
    }
    if (existing.status !== PrdProductStatus.DRAFT) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.INVALID_STATUS,
        'Only draft products can be activated.',
        HttpStatus.CONFLICT,
      );
    }
    const row = await this.prisma.prdProduct.update({
      where: { id },
      data: {
        status: PrdProductStatus.ACTIVE,
        version: { increment: 1 },
      },
    });
    return serialize(row);
  }

  async softDelete(companyId: string, id: string): Promise<void> {
    await this.findActive(companyId, id);
    await this.prisma.prdProduct.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: PrdProductStatus.OBSOLETE,
        version: { increment: 1 },
      },
    });
  }

  private async findActive(companyId: string, id: string): Promise<PrdProduct> {
    const row = await this.prisma.prdProduct.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.NOT_FOUND,
        'Product not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serialize(row: PrdProduct): ProductDto {
  return {
    id: row.id,
    companyId: row.companyId,
    sku: row.sku,
    name: row.name,
    typeKey: row.typeKey,
    uom: row.uom,
    trackLot: row.trackLot,
    perishable: row.perishable,
    storageClassKey: row.storageClassKey,
    allergenFlags: asStringArray(row.allergenFlags),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}
