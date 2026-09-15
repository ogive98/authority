import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  TaxCalcMethod,
  TaxCode,
  TaxDecisionSource,
  TaxKind,
  TaxRate,
  TaxRuleStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  TAX_DECISION_REASONS,
  TAX_ERROR_CODES,
  TAX_EVENT_TYPES,
} from './tax.constants';
import type {
  CalculateTaxDto,
  CalculateTaxLineDto,
  CreateTaxRateDto,
  FiscalDecision,
  PatchTaxRateDto,
} from './tax.dto';
import { TaxException } from './tax.exception';

export type TaxCodeDto = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  kind: TaxKind;
  calcMethod: TaxCalcMethod;
  status: TaxRuleStatus;
  active: boolean;
  currentRateBps: number | null;
  currentAmountMilli: number | null;
  unit: string | null;
  lawRef: string | null;
};

export type TaxRateDto = {
  id: string;
  companyId: string;
  taxCodeId: string;
  taxCode: string;
  calcMethod: TaxCalcMethod;
  rateBps: number;
  ratePercent: string;
  amountMilli: number | null;
  unit: string | null;
  status: TaxRuleStatus;
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
    opts?: { kind?: TaxKind; activeOnly?: boolean; allKinds?: boolean },
  ): Promise<{ items: TaxCodeDto[] }> {
    const asOf = utcToday();
    const rows = await this.prisma.taxCode.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts?.allKinds ? {} : { kind: opts?.kind ?? TaxKind.VAT }),
        ...(opts?.allKinds || opts?.activeOnly === false
          ? {}
          : { active: true }),
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
        calcMethod: row.calcMethod,
        status: row.status,
        active: row.active,
        currentRateBps: rate?.rateBps ?? null,
        currentAmountMilli: rate?.amountMilli ?? null,
        unit: row.unit ?? rate?.unit ?? null,
        lawRef: rate?.lawRef ?? row.lawRef,
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

  /**
   * Fiscal Rule Engine — returns why each tax applies (or not).
   * Preview does not persist. Call freezeDocumentLines on ISSUED (D263).
   * Does not read FODEC/timbre/RAS Prefs (D090/D092 stay outside the engine).
   */
  async calculate(
    companyId: string,
    dto: CalculateTaxDto,
  ): Promise<{ decisions: FiscalDecision[] }> {
    if (!dto.lines?.length) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_INPUT,
        'lines is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const asOf = dto.asOf ? startOfUtcDay(new Date(dto.asOf)) : utcToday();
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();
    const decisions: FiscalDecision[] = [];
    let lineNo = 0;
    for (const line of dto.lines) {
      lineNo += 1;
      decisions.push(
        await this.evaluateLine(
          companyId,
          line,
          line.lineNo ?? lineNo,
          asOf,
          currency,
          dto.customerId,
        ),
      );
    }
    return { decisions };
  }

  /**
   * D263 — immutable tax_line snapshot + link to document lines.
   * Idempotent: skips lines that already have taxLineId.
   */
  async freezeDocumentLines(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: {
      sourceType: 'fin_invoice' | 'fin_credit_note';
      sourceId: string;
      customerId: string;
      currency?: string;
      lines: Array<{
        id: string;
        lineNo: number;
        taxCodeId: string;
        productId: string | null;
        qty: number | Prisma.Decimal;
        unitPriceHt: number | Prisma.Decimal;
        amountHt: number | Prisma.Decimal;
        description: string;
        taxLineId?: string | null;
      }>;
    },
  ): Promise<number> {
    let frozen = 0;
    const currency = (input.currency?.trim() || 'TND').toUpperCase();
    for (const line of input.lines) {
      if (line.taxLineId) continue;
      const qty = Number(line.qty);
      const unitPriceHt = Number(line.unitPriceHt);
      const amountHt = Number(line.amountHt);
      const { decisions } = await this.calculate(companyId, {
        currency,
        customerId: input.customerId,
        lines: [
          {
            lineNo: line.lineNo,
            taxCodeId: line.taxCodeId,
            productId: line.productId ?? undefined,
            qty,
            unitPriceHt,
            amountHt,
            description: line.description,
          },
        ],
      });
      const decision =
        decisions.find((d) => d.kind === TaxKind.VAT) ?? decisions[0];
      if (!decision?.ruleId || !decision.taxCode || !decision.kind || !decision.calcMethod) {
        continue;
      }
      const row = await tx.taxLine.create({
        data: {
          companyId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          lineNo: line.lineNo,
          taxCodeId: decision.ruleId,
          taxRateId: decision.taxRateId,
          ruleVersion: decision.ruleVersion ?? 0,
          taxCode: decision.taxCode,
          taxName: decision.taxName ?? decision.taxCode,
          kind: decision.kind,
          calcMethod: decision.calcMethod,
          rateBps: decision.rateBps,
          amountMilli: decision.fixedAmountMilli,
          base: decision.base,
          taxableQuantity: decision.quantity,
          unit: decision.unit,
          calculatedAmount: decision.calculatedAmount,
          currency: decision.currency,
          applicable: decision.applicable,
          reason: decision.reason,
          source: decision.source,
          lawRef: decision.lawRef,
          effectiveFrom: new Date(decision.effectiveDate),
          calculatedAt: new Date(),
          frozen: true,
        },
      });
      if (input.sourceType === 'fin_invoice') {
        await tx.finInvoiceLine.update({
          where: { id: line.id },
          data: { taxLineId: row.id },
        });
      } else {
        await tx.finCreditNoteLine.update({
          where: { id: line.id },
          data: { taxLineId: row.id },
        });
      }
      frozen += 1;
    }
    return frozen;
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
          calcMethod: TaxCalcMethod.RATE,
          rateBps: dto.rateBps,
          status: TaxRuleStatus.VALIDATED,
          validFrom: startOfUtcDay(new Date(dto.validFrom)),
          validTo: dto.validTo
            ? startOfUtcDay(new Date(dto.validTo))
            : null,
          lawRef: dto.lawRef?.trim() || null,
          expertValidatedAt: new Date(),
        },
      });
      const payload = {
        taxRateId: created.id,
        taxCodeId: created.taxCodeId,
        code: code.code,
        rateBps: created.rateBps,
        lawRef: created.lawRef,
      };
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_rate',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.RATE_PUBLISHED,
        payloadJson: payload,
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_rate',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.RATE_CHANGED,
        payloadJson: payload,
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.taxRate.update({
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
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_rate',
        aggregateId: row.id,
        eventType: TAX_EVENT_TYPES.RATE_CHANGED,
        payloadJson: {
          taxRateId: row.id,
          taxCodeId: row.taxCodeId,
          code: existing.taxCode.code,
          rateBps: row.rateBps,
          lawRef: row.lawRef,
        },
      });
      return row;
    });

    return serializeRate(updated, existing.taxCode.code);
  }

  private async evaluateLine(
    companyId: string,
    line: CalculateTaxLineDto,
    lineNo: number,
    asOf: Date,
    currency: string,
    customerId?: string,
  ): Promise<FiscalDecision> {
    const qty = round3(line.qty);
    const unitPriceHt = round3(line.unitPriceHt);
    const base = round3(line.amountHt ?? qty * unitPriceHt);
    const empty: FiscalDecision = {
      applicable: false,
      ruleId: null,
      ruleVersion: null,
      taxRateId: null,
      taxCode: null,
      taxName: null,
      kind: null,
      calcMethod: null,
      base,
      quantity: qty,
      unit: line.unit ?? null,
      rateBps: null,
      fixedAmountMilli: null,
      calculatedAmount: 0,
      currency,
      reason: TAX_DECISION_REASONS.NO_TAX_CODE,
      source: TaxDecisionSource.SYSTEM_RULE,
      effectiveDate: isoDate(asOf),
      lawRef: null,
      lineNo,
      productId: line.productId ?? null,
    };

    if (!line.taxCodeId && !line.productId) {
      return empty;
    }

    let taxCodeId = line.taxCodeId ?? null;
    if (!taxCodeId && line.productId) {
      taxCodeId = await this.resolveProductDefaultVat(companyId, line.productId);
    }
    if (!taxCodeId) {
      return empty;
    }

    const code = await this.prisma.taxCode.findFirst({
      where: {
        id: taxCodeId,
        companyId,
        deletedAt: null,
      },
    });
    if (!code) {
      throw new TaxException(
        TAX_ERROR_CODES.CODE_NOT_FOUND,
        'Tax code not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const rate = await this.resolveRateRow(companyId, code.id, asOf);
    const method = rate?.calcMethod ?? code.calcMethod;
    const unit = line.unit ?? rate?.unit ?? code.unit;
    const override = await this.resolveCustomerOverride(
      companyId,
      customerId,
      code.id,
      asOf,
    );
    const productOverride = await this.resolveProductOverride(
      companyId,
      line.productId,
      code.id,
      asOf,
    );

    if (override?.mode === 'NEVER') {
      return {
        ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
        applicable: false,
        calculatedAmount: 0,
        source: override.source,
        reason: `${TAX_DECISION_REASONS.EXEMPTION} — ${code.code} NEVER for this customer (${override.source}${override.justification ? `: ${override.justification}` : ''}).`,
      };
    }

    if (productOverride?.mode === 'NEVER') {
      return {
        ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
        applicable: false,
        calculatedAmount: 0,
        source: productOverride.source,
        reason: `${TAX_DECISION_REASONS.EXEMPTION} — ${code.code} NEVER for this product (${productOverride.source}${productOverride.justification ? `: ${productOverride.justification}` : ''}).`,
      };
    }

    const alwaysOverride =
      override?.mode === 'ALWAYS'
        ? override
        : productOverride?.mode === 'ALWAYS'
          ? productOverride
          : null;

    if (!code.active || code.status === TaxRuleStatus.INACTIVE) {
      return {
        ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
        applicable: false,
        calculatedAmount: 0,
        reason: `${TAX_DECISION_REASONS.INACTIVE} — ${code.code} is inactive.`,
      };
    }

    if (
      code.status === TaxRuleStatus.DRAFT ||
      code.status === TaxRuleStatus.PENDING_EXPERT ||
      code.status === TaxRuleStatus.VALIDATED
    ) {
      return {
        ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
        applicable: false,
        calculatedAmount: 0,
        reason: `${TAX_DECISION_REASONS.PENDING_EXPERT} — ${code.code} status ${code.status} is not ACTIVE.`,
      };
    }

    if (code.status !== TaxRuleStatus.ACTIVE) {
      return {
        ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
        applicable: false,
        calculatedAmount: 0,
        reason: `${TAX_DECISION_REASONS.NOT_ACTIVE} — ${code.code} status ${code.status}.`,
      };
    }

    if (method === TaxCalcMethod.RATE) {
      if (!rate) {
        if (code.kind === TaxKind.VAT) {
          throw new TaxException(
            TAX_ERROR_CODES.RATE_NOT_FOUND,
            'No active tax rate for this code on the given date.',
            HttpStatus.NOT_FOUND,
          );
        }
        return {
          ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
          applicable: false,
          calculatedAmount: 0,
          reason: `${TAX_DECISION_REASONS.RATE_NOT_FOUND} — ${code.code} has no dated rate.`,
        };
      }
      const amount = taxFromHt(base, rate.rateBps);
      return this.stampOverride(
        {
          ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
          applicable: true,
          calculatedAmount: amount,
          reason: `${TAX_DECISION_REASONS.APPLIED_RATE} — ${code.code} ${code.label} RATE ${(rate.rateBps / 100).toFixed(2)}% on HT ${base.toFixed(3)} ${currency} (rate version ${rate.version}${rate.lawRef ? `, ${rate.lawRef}` : ''}).`,
        },
        alwaysOverride,
      );
    }

    if (method === TaxCalcMethod.QTY) {
      if (rate?.amountMilli == null || rate.amountMilli <= 0) {
        return {
          ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
          applicable: false,
          calculatedAmount: 0,
          reason: `${TAX_DECISION_REASONS.AMOUNT_NOT_VALIDATED} — ${code.code} QTY amount is empty until expert validation.`,
        };
      }
      const amount = taxFromQty(qty, rate.amountMilli);
      return this.stampOverride(
        {
          ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
          applicable: true,
          calculatedAmount: amount,
          reason: `${TAX_DECISION_REASONS.APPLIED_QTY} — ${code.code} ${code.label} ${qty.toFixed(3)} ${unit ?? 'unit'} × ${(rate.amountMilli / 1000).toFixed(3)} ${currency} (rate version ${rate.version}${rate.lawRef ? `, ${rate.lawRef}` : ''}).`,
        },
        alwaysOverride,
      );
    }

    if (method === TaxCalcMethod.FIXED) {
      if (rate?.amountMilli == null || rate.amountMilli <= 0) {
        return {
          ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
          applicable: false,
          calculatedAmount: 0,
          reason: `${TAX_DECISION_REASONS.AMOUNT_NOT_VALIDATED} — ${code.code} FIXED amount is empty until expert validation.`,
        };
      }
      const amount = taxFromFixed(rate.amountMilli);
      return this.stampOverride(
        {
          ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
          applicable: true,
          calculatedAmount: amount,
          reason: `${TAX_DECISION_REASONS.APPLIED_FIXED} — ${code.code} ${code.label} fixed ${(rate.amountMilli / 1000).toFixed(3)} ${currency} (rate version ${rate.version}${rate.lawRef ? `, ${rate.lawRef}` : ''}).`,
        },
        alwaysOverride,
      );
    }

    return {
      ...this.baseDecision(code, rate, base, qty, unit, currency, asOf, lineNo, line.productId),
      applicable: false,
      calculatedAmount: 0,
      reason: `${TAX_DECISION_REASONS.NOT_ACTIVE} — unsupported calc method.`,
    };
  }

  private async resolveCustomerOverride(
    companyId: string,
    customerId: string | undefined,
    taxCodeId: string,
    asOf: Date,
  ): Promise<{
    mode: 'AUTO' | 'ALWAYS' | 'NEVER' | 'CONFIRM';
    source: TaxDecisionSource;
    justification: string | null;
  } | null> {
    if (!customerId) return null;
    const row = await this.prisma.cusFiscalRuleOverride.findFirst({
      where: {
        companyId,
        customerId,
        taxCodeId,
        deletedAt: null,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: asOf } }] },
          { OR: [{ validTo: null }, { validTo: { gte: asOf } }] },
        ],
      },
    });
    if (!row || row.mode === 'AUTO') return null;
    return {
      mode: row.mode,
      source: row.source,
      justification: row.justification,
    };
  }

  private async resolveProductOverride(
    companyId: string,
    productId: string | undefined,
    taxCodeId: string,
    asOf: Date,
  ): Promise<{
    mode: 'AUTO' | 'ALWAYS' | 'NEVER' | 'CONFIRM';
    source: TaxDecisionSource;
    justification: string | null;
  } | null> {
    if (!productId) return null;
    const row = await this.prisma.prdFiscalRuleOverride.findFirst({
      where: {
        companyId,
        productId,
        taxCodeId,
        deletedAt: null,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: asOf } }] },
          { OR: [{ validTo: null }, { validTo: { gte: asOf } }] },
        ],
      },
    });
    if (!row || row.mode === 'AUTO') return null;
    return {
      mode: row.mode,
      source: row.source,
      justification: row.justification,
    };
  }

  private async resolveProductDefaultVat(
    companyId: string,
    productId: string,
  ): Promise<string | null> {
    const profile = await this.prisma.prdFiscalProfile.findFirst({
      where: { companyId, productId, deletedAt: null },
      select: { defaultVatTaxCodeId: true },
    });
    return profile?.defaultVatTaxCodeId ?? null;
  }

  private stampOverride(
    decision: FiscalDecision,
    override: {
      mode: 'AUTO' | 'ALWAYS' | 'NEVER' | 'CONFIRM';
      source: TaxDecisionSource;
    } | null,
  ): FiscalDecision {
    if (!override || override.mode !== 'ALWAYS' || !decision.applicable) {
      return decision;
    }
    return {
      ...decision,
      source: override.source,
      reason: `${decision.reason} [ALWAYS override]`,
    };
  }

  private baseDecision(
    code: TaxCode,
    rate: TaxRate | null,
    base: number,
    qty: number,
    unit: string | null | undefined,
    currency: string,
    asOf: Date,
    lineNo: number,
    productId: string | null | undefined,
  ): FiscalDecision {
    return {
      applicable: false,
      ruleId: code.id,
      ruleVersion: rate?.version ?? code.version,
      taxRateId: rate?.id ?? null,
      taxCode: code.code,
      taxName: code.label,
      kind: code.kind,
      calcMethod: rate?.calcMethod ?? code.calcMethod,
      base,
      quantity: qty,
      unit: unit ?? null,
      rateBps: rate?.rateBps ?? null,
      fixedAmountMilli: rate?.amountMilli ?? null,
      calculatedAmount: 0,
      currency,
      reason: '',
      source: TaxDecisionSource.SYSTEM_RULE,
      effectiveDate: isoDate(rate?.validFrom ?? asOf),
      lawRef: rate?.lawRef ?? code.lawRef,
      lineNo,
      productId: productId ?? null,
    };
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

export function taxFromQty(qty: number, amountMilli: number): number {
  return round3((qty * amountMilli) / 1000);
}

export function taxFromFixed(amountMilli: number): number {
  return round3(amountMilli / 1000);
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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function serializeRate(row: TaxRate, taxCode: string): TaxRateDto {
  return {
    id: row.id,
    companyId: row.companyId,
    taxCodeId: row.taxCodeId,
    taxCode,
    calcMethod: row.calcMethod,
    rateBps: row.rateBps,
    ratePercent: (row.rateBps / 100).toFixed(2),
    amountMilli: row.amountMilli,
    unit: row.unit,
    status: row.status,
    validFrom: row.validFrom.toISOString().slice(0, 10),
    validTo: row.validTo ? row.validTo.toISOString().slice(0, 10) : null,
    lawRef: row.lawRef,
    expertValidatedAt: row.expertValidatedAt?.toISOString() ?? null,
  };
}
