import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PrdFiscalOverrideMode,
  TaxDecisionSource,
  TaxKind,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRD_FISCAL_NEVER_SOURCES,
  PRODUCTS_ERROR_CODES,
  PRODUCTS_EVENT_TYPES,
} from './products.constants';
import type {
  UpsertProductFiscalOverrideDto,
  UpsertProductFiscalProfileDto,
} from './products.dto';
import { ProductsException } from './products.exception';
import { ProductsService } from './products.service';

export type ProductFiscalCodeDto = {
  id: string;
  code: string;
  label: string;
  kind: string;
  status: string;
  active: boolean;
};

export type ProductFiscalProfileDto = {
  id: string | null;
  defaultVatTaxCodeId: string | null;
  defaultVatCode: string | null;
  hsCode: string | null;
  fiscalCategory: string | null;
  notes: string | null;
  version: number;
};

export type ProductFiscalOverrideDto = {
  id: string;
  taxCodeId: string;
  taxCode: string;
  taxLabel: string;
  kind: string;
  ruleStatus: string;
  mode: PrdFiscalOverrideMode;
  source: TaxDecisionSource;
  validFrom: string | null;
  validTo: string | null;
  justification: string | null;
  reference: string | null;
  documentId: string | null;
  comment: string | null;
  version: number;
};

export type ProductFiscalDto = {
  productId: string;
  sku: string;
  profile: ProductFiscalProfileDto;
  overrides: ProductFiscalOverrideDto[];
  availableCodes: ProductFiscalCodeDto[];
};

@Injectable()
export class ProductFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly outbox: OutboxService,
  ) {}

  async get(companyId: string, productId: string): Promise<ProductFiscalDto> {
    const product = await this.products.get(companyId, productId);
    const [profile, overrides, codes] = await Promise.all([
      this.prisma.prdFiscalProfile.findFirst({
        where: { companyId, productId, deletedAt: null },
        include: { defaultVatCode: true },
      }),
      this.prisma.prdFiscalRuleOverride.findMany({
        where: { companyId, productId, deletedAt: null },
        include: { taxCode: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.taxCode.findMany({
        where: { companyId, deletedAt: null },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          label: true,
          kind: true,
          status: true,
          active: true,
        },
      }),
    ]);

    return {
      productId,
      sku: product.sku,
      profile: profile
        ? {
            id: profile.id,
            defaultVatTaxCodeId: profile.defaultVatTaxCodeId,
            defaultVatCode: profile.defaultVatCode?.code ?? null,
            hsCode: profile.hsCode,
            fiscalCategory: profile.fiscalCategory,
            notes: profile.notes,
            version: profile.version,
          }
        : emptyProfile(),
      overrides: overrides.map((row) => ({
        id: row.id,
        taxCodeId: row.taxCodeId,
        taxCode: row.taxCode.code,
        taxLabel: row.taxCode.label,
        kind: row.taxCode.kind,
        ruleStatus: row.taxCode.status,
        mode: row.mode,
        source: row.source,
        validFrom: isoDate(row.validFrom),
        validTo: isoDate(row.validTo),
        justification: row.justification,
        reference: row.reference,
        documentId: row.documentId,
        comment: row.comment,
        version: row.version,
      })),
      availableCodes: codes,
    };
  }

  async upsertProfile(
    companyId: string,
    productId: string,
    dto: UpsertProductFiscalProfileDto,
  ): Promise<ProductFiscalDto> {
    await this.products.get(companyId, productId);
    const defaultVatTaxCodeId = await this.assertDefaultVat(
      companyId,
      dto.defaultVatTaxCodeId,
    );
    const existing = await this.prisma.prdFiscalProfile.findFirst({
      where: { companyId, productId, deletedAt: null },
    });
    if (existing && dto.version !== undefined && existing.version !== dto.version) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.VERSION_CONFLICT,
        'Fiscal profile version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (!existing && dto.version !== undefined && dto.version !== 0) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.VERSION_CONFLICT,
        'Fiscal profile version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.prdFiscalProfile.update({
            where: { id: existing.id },
            data: {
              defaultVatTaxCodeId,
              hsCode: trimOrNull(dto.hsCode),
              fiscalCategory: trimOrNull(dto.fiscalCategory),
              notes: trimOrNull(dto.notes),
              version: { increment: 1 },
            },
          })
        : await tx.prdFiscalProfile.create({
            data: {
              companyId,
              productId,
              defaultVatTaxCodeId,
              hsCode: trimOrNull(dto.hsCode),
              fiscalCategory: trimOrNull(dto.fiscalCategory),
              notes: trimOrNull(dto.notes),
            },
          });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_fiscal_profile',
        aggregateId: row.id,
        eventType: PRODUCTS_EVENT_TYPES.FISCAL_UPDATED,
        payloadJson: {
          productId,
          kind: 'profile',
          defaultVatTaxCodeId,
        },
      });
    });

    return this.get(companyId, productId);
  }

  async upsertOverride(
    companyId: string,
    productId: string,
    dto: UpsertProductFiscalOverrideDto,
  ): Promise<ProductFiscalDto> {
    await this.products.get(companyId, productId);
    if (dto.mode === 'AUTO') {
      return this.removeOverride(companyId, productId, dto.taxCodeId);
    }

    const justification = dto.justification?.trim() ?? '';
    if (justification.length === 0) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.FISCAL_JUSTIFICATION,
        'Justification is required for ALWAYS, NEVER and CONFIRM overrides.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let source: TaxDecisionSource =
      (dto.source as TaxDecisionSource | undefined) ??
      (dto.mode === 'NEVER'
        ? TaxDecisionSource.EXEMPTION
        : TaxDecisionSource.CLIENT_OVERRIDE);

    if (dto.mode === 'NEVER') {
      if (
        !PRD_FISCAL_NEVER_SOURCES.includes(
          source as (typeof PRD_FISCAL_NEVER_SOURCES)[number],
        )
      ) {
        throw new ProductsException(
          PRODUCTS_ERROR_CODES.FISCAL_INVALID_MODE,
          'NEVER requires source EXEMPTION, MANUAL_OVERRIDE or CLIENT_OVERRIDE.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (dto.mode === 'ALWAYS' && source === TaxDecisionSource.SYSTEM_RULE) {
      source = TaxDecisionSource.CLIENT_OVERRIDE;
    }

    const taxCode = await this.prisma.taxCode.findFirst({
      where: { id: dto.taxCodeId, companyId, deletedAt: null },
    });
    if (!taxCode) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.TAX_CODE_NOT_FOUND,
        'Tax code not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.prdFiscalRuleOverride.findFirst({
      where: { companyId, productId, taxCodeId: dto.taxCodeId },
    });
    if (
      existing &&
      existing.deletedAt == null &&
      dto.version !== undefined &&
      existing.version !== dto.version
    ) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.VERSION_CONFLICT,
        'Fiscal override version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const data = {
        mode: dto.mode as PrdFiscalOverrideMode,
        source,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        justification,
        reference: trimOrNull(dto.reference),
        documentId: dto.documentId ?? null,
        comment: trimOrNull(dto.comment),
        deletedAt: null,
      };
      const row = existing
        ? await tx.prdFiscalRuleOverride.update({
            where: { id: existing.id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.prdFiscalRuleOverride.create({
            data: {
              companyId,
              productId,
              taxCodeId: dto.taxCodeId,
              ...data,
            },
          });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_fiscal_rule_override',
        aggregateId: row.id,
        eventType: PRODUCTS_EVENT_TYPES.FISCAL_UPDATED,
        payloadJson: {
          productId,
          kind: 'override',
          taxCodeId: dto.taxCodeId,
          taxCode: taxCode.code,
          mode: dto.mode,
          source,
        },
      });
    });

    return this.get(companyId, productId);
  }

  async removeOverride(
    companyId: string,
    productId: string,
    taxCodeId: string,
  ): Promise<ProductFiscalDto> {
    await this.products.get(companyId, productId);
    const existing = await this.prisma.prdFiscalRuleOverride.findFirst({
      where: { companyId, productId, taxCodeId, deletedAt: null },
    });
    if (!existing) {
      return this.get(companyId, productId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.prdFiscalRuleOverride.update({
        where: { id: existing.id },
        data: {
          mode: PrdFiscalOverrideMode.AUTO,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_fiscal_rule_override',
        aggregateId: existing.id,
        eventType: PRODUCTS_EVENT_TYPES.FISCAL_UPDATED,
        payloadJson: {
          productId,
          kind: 'override',
          taxCodeId,
          mode: 'AUTO',
        },
      });
    });

    return this.get(companyId, productId);
  }

  private async assertDefaultVat(
    companyId: string,
    taxCodeId: string | null | undefined,
  ): Promise<string | null> {
    if (taxCodeId === undefined || taxCodeId === null || taxCodeId === '') {
      return null;
    }
    const code = await this.prisma.taxCode.findFirst({
      where: { id: taxCodeId, companyId, deletedAt: null },
    });
    if (!code) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.TAX_CODE_NOT_FOUND,
        'Tax code not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (code.kind !== TaxKind.VAT) {
      throw new ProductsException(
        PRODUCTS_ERROR_CODES.TAX_CODE_NOT_VAT,
        'Default tax code must be VAT.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return code.id;
  }
}

function emptyProfile(): ProductFiscalProfileDto {
  return {
    id: null,
    defaultVatTaxCodeId: null,
    defaultVatCode: null,
    hsCode: null,
    fiscalCategory: null,
    notes: null,
    version: 0,
  };
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function isoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
