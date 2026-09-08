import { HttpStatus, Injectable } from '@nestjs/common';
import { TaxCode, TaxKind, TaxRate } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { TAX_ERROR_CODES, TAX_EVENT_TYPES } from './tax.constants';
import type { CreateTaxRateDto, PatchTaxRateDto } from './tax.dto';
import { TaxException } from './tax.exception';

export type TaxCodeDto = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  kind: TaxKind;
  active: boolean;
  currentRateBps: number | null;
  lawRef: string | null;
};

export type TaxRateDto = {
  id: string;
  companyId: string;
  taxCodeId: string;
  taxCode: string;
  rateBps: number;
  ratePercent: string;
  validFrom: string;
  validTo: string | null;
  lawRef: string | null;
  expertValidatedAt: string | null;
};

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listCodes(
    companyId: string,
    opts?: { kind?: TaxKind; activeOnly?: boolean },
  ): Promise<{ items: TaxCodeDto[] }> {
    const asOf = utcToday();
    const rows = await this.prisma.taxCode.findMany({
      where: {
        companyId,
        deletedAt: null,
        kind: opts?.kind ?? TaxKind.VAT,
        ...(opts?.activeOnly === false ? {} : { active: true }),
      },
      orderBy: { code: 'asc' },
    });

    const items: TaxCodeDto[] = [];
    for (const row of rows) {
      const rate = await this.resolveRateRow(companyId, row.id, asOf);
      items.push({
        id: row.id,
        companyId: row.companyId,
        code: row.code,
        label: row.label,
        kind: row.kind,
        active: row.active,
        currentRateBps: rate?.rateBps ?? null,
        lawRef: rate?.lawRef ?? null,
      });
    }
    return { items };
  }

  async listRates(
    companyId: string,
    opts?: { asOf?: string; taxCodeId?: string },
  ): Promise<{ items: TaxRateDto[] }> {
    const asOf = opts?.asOf ? startOfUtcDay(new Date(opts.asOf)) : utcToday();
    const codes = await this.prisma.taxCode.findMany({
      where: {
        companyId,
        deletedAt: null,
        kind: TaxKind.VAT,
        ...(opts?.taxCodeId ? { id: opts.taxCodeId } : {}),
      },
    });
    const codeMap = new Map(codes.map((c) => [c.id, c]));

    const rows = await this.prisma.taxRate.findMany({
      where: {
        companyId,
        deletedAt: null,
        validFrom: { lte: asOf },
        OR: [{ validTo: null }, { validTo: { gte: asOf } }],
        ...(opts?.taxCodeId ? { taxCodeId: opts.taxCodeId } : {}),
        taxCodeId: { in: codes.map((c) => c.id) },
      },
      orderBy: [{ taxCodeId: 'asc' }, { validFrom: 'desc' }],
    });

    // One active rate per code (latest validFrom)
    const seen = new Set<string>();
    const items: TaxRateDto[] = [];
    for (const row of rows) {
      if (seen.has(row.taxCodeId)) continue;
      seen.add(row.taxCodeId);
      const code = codeMap.get(row.taxCodeId);
      items.push(serializeRate(row, code?.code ?? '?'));
    }
    return { items };
  }

  /**
   * Resolve VAT rate in basis points for a tax code as of a date.
   * Used by Finance invoice line computation — never hardcode rates in Finance.
   */
  async resolveRateBps(
    companyId: string,
    taxCodeId: string,
    asOf: Date = utcToday(),
  ): Promise<{ rateBps: number; taxCode: TaxCode; rate: TaxRate }> {
    const code = await this.prisma.taxCode.findFirst({
      where: {
        id: taxCodeId,
        companyId,
        deletedAt: null,
        active: true,
        kind: TaxKind.VAT,
      },
    });
    if (!code) {
      throw new TaxException(
        TAX_ERROR_CODES.CODE_NOT_FOUND,
        'Tax code not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const rate = await this.resolveRateRow(companyId, taxCodeId, asOf);
    if (!rate) {
      throw new TaxException(
        TAX_ERROR_CODES.RATE_NOT_FOUND,
        'No active tax rate for this code on the given date.',
        HttpStatus.NOT_FOUND,
      );
    }
    return { rateBps: rate.rateBps, taxCode: code, rate };
  }

  async findCodeByCode(
    companyId: string,
    code: string,
  ): Promise<TaxCode | null> {
    return this.prisma.taxCode.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        active: true,
        kind: TaxKind.VAT,
      },
    });
  }

  async createRate(
    companyId: string,
    dto: CreateTaxRateDto,
  ): Promise<TaxRateDto> {
    const code = await this.prisma.taxCode.findFirst({
      where: {
        id: dto.taxCodeId,
        companyId,
        deletedAt: null,
        kind: TaxKind.VAT,
      },
    });
    if (!code) {
      throw new TaxException(
        TAX_ERROR_CODES.CODE_NOT_FOUND,
        'Tax code not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (dto.rateBps < 0 || dto.rateBps > 10000) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_RATE,
        'rateBps must be between 0 and 10000.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taxRate.create({
        data: {
          companyId,
          taxCodeId: dto.taxCodeId,
          rateBps: dto.rateBps,
          validFrom: startOfUtcDay(new Date(dto.validFrom)),
          validTo: dto.validTo
            ? startOfUtcDay(new Date(dto.validTo))
            : null,
          lawRef: dto.lawRef?.trim() || null,
          expertValidatedAt: new Date(),
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_rate',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.RATE_PUBLISHED,
        payloadJson: {
          taxRateId: created.id,
          taxCodeId: created.taxCodeId,
          code: code.code,
          rateBps: created.rateBps,
          lawRef: created.lawRef,
        },
      });
      return created;
    });

    return serializeRate(row, code.code);
  }

  async patchRate(
    companyId: string,
    id: string,
    dto: PatchTaxRateDto,
  ): Promise<TaxRateDto> {
    const existing = await this.prisma.taxRate.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { taxCode: true },
    });
    if (!existing) {
      throw new TaxException(
        TAX_ERROR_CODES.RATE_NOT_FOUND,
        'Tax rate not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: {
        ...(dto.validTo !== undefined
          ? {
              validTo:
                dto.validTo === null
                  ? null
                  : startOfUtcDay(new Date(dto.validTo)),
            }
          : {}),
        ...(dto.lawRef !== undefined
          ? { lawRef: dto.lawRef?.trim() || null }
          : {}),
        version: { increment: 1 },
      },
    });

    return serializeRate(updated, existing.taxCode.code);
  }

  private async resolveRateRow(
    companyId: string,
    taxCodeId: string,
    asOf: Date,
  ): Promise<TaxRate | null> {
    return this.prisma.taxRate.findFirst({
      where: {
        companyId,
        taxCodeId,
        deletedAt: null,
        validFrom: { lte: asOf },
        OR: [{ validTo: null }, { validTo: { gte: asOf } }],
      },
      orderBy: { validFrom: 'desc' },
    });
  }
}

export function taxFromHt(amountHt: number, rateBps: number): number {
  return round3((amountHt * rateBps) / 10000);
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function serializeRate(row: TaxRate, taxCode: string): TaxRateDto {
  return {
    id: row.id,
    companyId: row.companyId,
    taxCodeId: row.taxCodeId,
    taxCode,
    rateBps: row.rateBps,
    ratePercent: (row.rateBps / 100).toFixed(2),
    validFrom: row.validFrom.toISOString().slice(0, 10),
    validTo: row.validTo ? row.validTo.toISOString().slice(0, 10) : null,
    lawRef: row.lawRef,
    expertValidatedAt: row.expertValidatedAt?.toISOString() ?? null,
  };
}
