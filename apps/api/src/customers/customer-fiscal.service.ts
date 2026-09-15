import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CusFiscalOverrideMode,
  TaxDecisionSource,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CUSTOMERS_ERROR_CODES,
  CUSTOMERS_EVENT_TYPES,
  FISCAL_NEVER_SOURCES,
} from './customers.constants';
import type {
  UpsertCustomerFiscalOverrideDto,
  UpsertCustomerFiscalProfileDto,
} from './customers.dto';
import { CustomersException } from './customers.exception';
import { CustomersService } from './customers.service';

export type CustomerFiscalCodeDto = {
  id: string;
  code: string;
  label: string;
  kind: string;
  status: string;
  active: boolean;
};

export type CustomerFiscalProfileDto = {
  id: string | null;
  fiscalRegime: string | null;
  vatLiable: boolean | null;
  fiscalStatus: string | null;
  fiscalCategory: string | null;
  withholdingArEnabled: boolean;
  notes: string | null;
  version: number;
};

export type CustomerFiscalOverrideDto = {
  id: string;
  taxCodeId: string;
  taxCode: string;
  taxLabel: string;
  kind: string;
  ruleStatus: string;
  mode: CusFiscalOverrideMode;
  source: TaxDecisionSource;
  validFrom: string | null;
  validTo: string | null;
  justification: string | null;
  reference: string | null;
  documentId: string | null;
  comment: string | null;
  version: number;
};

export type CustomerFiscalDto = {
  customerId: string;
  taxId: string | null;
  profile: CustomerFiscalProfileDto;
  overrides: CustomerFiscalOverrideDto[];
  availableCodes: CustomerFiscalCodeDto[];
};

@Injectable()
export class CustomerFiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly outbox: OutboxService,
  ) {}

  async get(companyId: string, customerId: string): Promise<CustomerFiscalDto> {
    const customer = await this.customers.get(companyId, customerId);
    const [profile, overrides, codes] = await Promise.all([
      this.prisma.cusFiscalProfile.findFirst({
        where: { companyId, customerId, deletedAt: null },
      }),
      this.prisma.cusFiscalRuleOverride.findMany({
        where: { companyId, customerId, deletedAt: null },
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
      customerId,
      taxId: customer.taxId,
      profile: profile
        ? {
            id: profile.id,
            fiscalRegime: profile.fiscalRegime,
            vatLiable: profile.vatLiable,
            fiscalStatus: profile.fiscalStatus,
            fiscalCategory: profile.fiscalCategory,
            withholdingArEnabled: profile.withholdingArEnabled,
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
    customerId: string,
    dto: UpsertCustomerFiscalProfileDto,
  ): Promise<CustomerFiscalDto> {
    await this.customers.get(companyId, customerId);
    const existing = await this.prisma.cusFiscalProfile.findFirst({
      where: { companyId, customerId, deletedAt: null },
    });
    if (existing && dto.version !== undefined && existing.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Fiscal profile version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (!existing && dto.version !== undefined && dto.version !== 0) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Fiscal profile version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.cusFiscalProfile.update({
            where: { id: existing.id },
            data: {
              fiscalRegime: trimOrNull(dto.fiscalRegime),
              vatLiable: dto.vatLiable ?? null,
              fiscalStatus: trimOrNull(dto.fiscalStatus),
              fiscalCategory: trimOrNull(dto.fiscalCategory),
              withholdingArEnabled: dto.withholdingArEnabled ?? false,
              notes: trimOrNull(dto.notes),
              version: { increment: 1 },
            },
          })
        : await tx.cusFiscalProfile.create({
            data: {
              companyId,
              customerId,
              fiscalRegime: trimOrNull(dto.fiscalRegime),
              vatLiable: dto.vatLiable ?? null,
              fiscalStatus: trimOrNull(dto.fiscalStatus),
              fiscalCategory: trimOrNull(dto.fiscalCategory),
              withholdingArEnabled: dto.withholdingArEnabled ?? false,
              notes: trimOrNull(dto.notes),
            },
          });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'cus_fiscal_profile',
        aggregateId: row.id,
        eventType: CUSTOMERS_EVENT_TYPES.FISCAL_UPDATED,
        payloadJson: {
          customerId,
          kind: 'profile',
          withholdingArEnabled: row.withholdingArEnabled,
        },
      });
    });

    return this.get(companyId, customerId);
  }

  async upsertOverride(
    companyId: string,
    customerId: string,
    dto: UpsertCustomerFiscalOverrideDto,
  ): Promise<CustomerFiscalDto> {
    await this.customers.get(companyId, customerId);
    if (dto.mode === 'AUTO') {
      return this.removeOverride(companyId, customerId, dto.taxCodeId);
    }

    const justification = dto.justification?.trim() ?? '';
    if (justification.length === 0) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.FISCAL_JUSTIFICATION,
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
      if (!FISCAL_NEVER_SOURCES.includes(source as (typeof FISCAL_NEVER_SOURCES)[number])) {
        throw new CustomersException(
          CUSTOMERS_ERROR_CODES.FISCAL_INVALID_MODE,
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
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.TAX_CODE_NOT_FOUND,
        'Tax code not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.cusFiscalRuleOverride.findFirst({
      where: { companyId, customerId, taxCodeId: dto.taxCodeId },
    });
    if (
      existing &&
      existing.deletedAt == null &&
      dto.version !== undefined &&
      existing.version !== dto.version
    ) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Fiscal override version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const data = {
        mode: dto.mode as CusFiscalOverrideMode,
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
        ? await tx.cusFiscalRuleOverride.update({
            where: { id: existing.id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.cusFiscalRuleOverride.create({
            data: {
              companyId,
              customerId,
              taxCodeId: dto.taxCodeId,
              ...data,
            },
          });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'cus_fiscal_rule_override',
        aggregateId: row.id,
        eventType: CUSTOMERS_EVENT_TYPES.FISCAL_UPDATED,
        payloadJson: {
          customerId,
          kind: 'override',
          taxCodeId: dto.taxCodeId,
          taxCode: taxCode.code,
          mode: dto.mode,
          source,
        },
      });
    });

    return this.get(companyId, customerId);
  }

  async removeOverride(
    companyId: string,
    customerId: string,
    taxCodeId: string,
  ): Promise<CustomerFiscalDto> {
    await this.customers.get(companyId, customerId);
    const existing = await this.prisma.cusFiscalRuleOverride.findFirst({
      where: { companyId, customerId, taxCodeId, deletedAt: null },
    });
    if (!existing) {
      return this.get(companyId, customerId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cusFiscalRuleOverride.update({
        where: { id: existing.id },
        data: {
          mode: CusFiscalOverrideMode.AUTO,
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'cus_fiscal_rule_override',
        aggregateId: existing.id,
        eventType: CUSTOMERS_EVENT_TYPES.FISCAL_UPDATED,
        payloadJson: {
          customerId,
          kind: 'override',
          taxCodeId,
          mode: 'AUTO',
        },
      });
    });

    return this.get(companyId, customerId);
  }
}

function emptyProfile(): CustomerFiscalProfileDto {
  return {
    id: null,
    fiscalRegime: null,
    vatLiable: null,
    fiscalStatus: null,
    fiscalCategory: null,
    withholdingArEnabled: false,
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
