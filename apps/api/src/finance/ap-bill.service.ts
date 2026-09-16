import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinApBillStatus,
  Prisma,
  TaxDecisionSource,
  TaxKind,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaxService } from '../tax/tax.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { CreateApBillDto, CreateApBillLineDto } from './finance.dto';
import { FinanceException } from './finance.exception';

export type ApBillPaymentSummary = {
  id: string;
  number: string;
  amount: string;
  currency: string;
  method: string;
  paymentDate: string;
  matched: boolean;
};

export type ApBillLineDto = {
  id: string;
  lineNo: number;
  description: string;
  amountHt: string;
  amountTax: string;
  amountTtc: string;
  taxCodeId: string;
  taxCode: string | null;
  taxLineId: string | null;
};

export type ApBillDto = {
  id: string;
  companyId: string;
  number: string;
  vendorName: string;
  supplierId: string | null;
  status: FinApBillStatus;
  billDate: string;
  dueDate: string | null;
  amountTotal: string;
  amountHt: string;
  amountTax: string;
  currency: string;
  label: string | null;
  reference: string | null;
  notes: string | null;
  version: number;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: ApBillLineDto[];
  /** Present on get (D237). */
  payments?: ApBillPaymentSummary[];
  amountPaid?: string;
};

type BuiltLine = {
  lineNo: number;
  description: string;
  amountHt: number;
  amountTax: number;
  amountTtc: number;
  taxCodeId: string;
};

@Injectable()
export class ApBillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly tax: TaxService,
  ) {}

  async list(
    companyId: string,
    opts?: { q?: string; status?: string; limit?: number },
  ): Promise<{ items: ApBillDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();
    const rows = await this.prisma.finApBill.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status &&
        Object.values(FinApBillStatus).includes(status as FinApBillStatus)
          ? { status: status as FinApBillStatus }
          : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { vendorName: { contains: q, mode: 'insensitive' } },
                { label: { contains: q, mode: 'insensitive' } },
                { reference: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map((row) => serializeApBill(row)) };
  }

  async get(companyId: string, id: string): Promise<ApBillDto> {
    const row = await this.prisma.finApBill.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        payments: {
          where: { deletedAt: null },
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          include: { bankMatches: { select: { id: true } } },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
          include: { taxCode: { select: { code: true } } },
        },
      },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
        'AP bill not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeApBill(row, true);
  }

  async create(companyId: string, dto: CreateApBillDto): Promise<ApBillDto> {
    const builtLines = dto.lines?.length
      ? await this.buildTaxLines(companyId, dto.lines)
      : [];
    const amountHt = builtLines.reduce((s, l) => s + l.amountHt, 0);
    const amountTax = builtLines.reduce((s, l) => s + l.amountTax, 0);
    const amountTotal = builtLines.length
      ? round3Num(builtLines.reduce((s, l) => s + l.amountTtc, 0))
      : round3Num(dto.amountTotal ?? 0);
    assertPositiveAmount(amountTotal);

    let supplierId: string | null = dto.supplierId?.trim() || null;
    let vendorName = dto.vendorName?.trim() ?? '';

    if (supplierId) {
      const supplier = await this.prisma.supSupplier.findFirst({
        where: { id: supplierId, companyId, deletedAt: null },
        include: { party: true },
      });
      if (!supplier) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_POLICY,
          'Supplier not found.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!vendorName) vendorName = supplier.party.legalName;
    }

    if (!vendorName) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_POLICY,
        'vendorName is required (or link a supplier).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const number = await this.nextNumber(companyId);
    const billDate = new Date(`${dto.billDate.slice(0, 10)}T00:00:00.000Z`);
    const dueDate = dto.dueDate
      ? new Date(`${dto.dueDate.slice(0, 10)}T00:00:00.000Z`)
      : null;
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();

    const row = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.finApBill.create({
        data: {
          companyId,
          number,
          vendorName,
          supplierId,
          status: FinApBillStatus.DRAFT,
          billDate,
          dueDate,
          amountTotal,
          amountHt,
          amountTax,
          currency,
          label: dto.label?.trim() || null,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
          lines: builtLines.length
            ? {
                create: builtLines.map((l) => ({
                  companyId,
                  lineNo: l.lineNo,
                  description: l.description,
                  amountHt: l.amountHt,
                  amountTax: l.amountTax,
                  amountTtc: l.amountTtc,
                  taxCodeId: l.taxCodeId,
                })),
              }
            : undefined,
        },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: { taxCode: { select: { code: true } } },
          },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_BILL_CREATED,
        aggregateType: 'fin_ap_bill',
        aggregateId: bill.id,
        payloadJson: {
          billId: bill.id,
          number: bill.number,
          vendorName: bill.vendorName,
          supplierId: bill.supplierId,
          amountTotal: bill.amountTotal.toString(),
          amountHt: bill.amountHt.toString(),
          amountTax: bill.amountTax.toString(),
        },
      });
      return bill;
    });

    return serializeApBill(row);
  }

  async post(companyId: string, id: string): Promise<ApBillDto> {
    const existing = await this.prisma.finApBill.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
        'AP bill not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status !== FinApBillStatus.DRAFT) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Only DRAFT AP bills can be posted.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (existing.lines.length > 0) {
        await this.tax.freezeDocumentLines(tx, companyId, {
          sourceType: 'fin_ap_bill',
          sourceId: existing.id,
          currency: existing.currency,
          lines: existing.lines.map((l) => ({
            id: l.id,
            lineNo: l.lineNo,
            taxCodeId: l.taxCodeId,
            productId: null,
            qty: 1,
            unitPriceHt: Number(l.amountHt),
            amountHt: Number(l.amountHt),
            description: l.description,
            taxLineId: l.taxLineId,
          })),
        });
      }
      const bill = await tx.finApBill.update({
        where: { id: existing.id },
        data: {
          status: FinApBillStatus.POSTED,
          postedAt: new Date(),
          version: { increment: 1 },
        },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: { taxCode: { select: { code: true } } },
          },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_BILL_POSTED,
        aggregateType: 'fin_ap_bill',
        aggregateId: bill.id,
        payloadJson: {
          billId: bill.id,
          number: bill.number,
          vendorName: bill.vendorName,
          amountTotal: bill.amountTotal.toString(),
          amountHt: bill.amountHt.toString(),
          amountTax: bill.amountTax.toString(),
          billDate: bill.billDate.toISOString().slice(0, 10),
        },
      });
      return bill;
    });

    return serializeApBill(row);
  }

  async cancel(companyId: string, id: string): Promise<ApBillDto> {
    const existing = await this.prisma.finApBill.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
        'AP bill not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status === FinApBillStatus.CANCELLED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'AP bill already cancelled.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.finApBill.update({
        where: { id: existing.id },
        data: {
          status: FinApBillStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_BILL_CANCELLED,
        aggregateType: 'fin_ap_bill',
        aggregateId: bill.id,
        payloadJson: {
          billId: bill.id,
          number: bill.number,
          priorStatus: existing.status,
        },
      });
      return bill;
    });

    return serializeApBill(row);
  }

  private async buildTaxLines(
    companyId: string,
    lines: CreateApBillLineDto[],
  ): Promise<BuiltLine[]> {
    const out: BuiltLine[] = [];
    let lineNo = 0;
    for (const line of lines) {
      lineNo += 1;
      const amountHt = round3Num(line.amountHt);
      if (!(amountHt > 0)) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_AMOUNT,
          'Line amountHt must be > 0.',
          HttpStatus.BAD_REQUEST,
        );
      }
      let taxCodeId = line.taxCodeId?.trim() || undefined;
      if (!taxCodeId) {
        taxCodeId = (await this.tax.resolveStubVat19(companyId)) ?? undefined;
      }
      if (!taxCodeId) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_AMOUNT,
          'VAT code required (or stub TVA19).',
          HttpStatus.BAD_REQUEST,
        );
      }
      const { decisions } = await this.tax.calculate(companyId, {
        currency: 'TND',
        operationType: 'AP_BILL',
        lines: [
          {
            lineNo,
            taxCodeId,
            qty: 1,
            unitPriceHt: amountHt,
            amountHt,
            description: line.description?.trim() || 'AP',
          },
        ],
      });
      const vat = decisions.find((d) => d.kind === TaxKind.VAT);
      if (!vat) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_AMOUNT,
          'VAT tax code is not applicable for this AP line.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!vat.applicable && vat.source !== TaxDecisionSource.EXEMPTION) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_AMOUNT,
          'VAT tax code is not applicable for this AP line.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const amountTax = vat.applicable ? vat.calculatedAmount : 0;
      const resolved = vat.ruleId ?? taxCodeId;
      out.push({
        lineNo,
        description: line.description?.trim() || 'AP',
        amountHt,
        amountTax,
        amountTtc: round3Num(amountHt + amountTax),
        taxCodeId: resolved,
      });
    }
    return out;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `APB-${year}-`;
    const last = await this.prisma.finApBill.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = last?.number
      ? Number(last.number.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, '0')}`;
  }
}

function assertPositiveAmount(amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new FinanceException(
      FINANCE_ERROR_CODES.INVALID_AMOUNT,
      'amountTotal must be > 0.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function round3Num(n: number): number {
  return Number(n.toFixed(3));
}

function serializeApBill(
  row: {
    id: string;
    companyId: string;
    number: string;
    vendorName: string;
    supplierId?: string | null;
    status: FinApBillStatus;
    billDate: Date;
    dueDate: Date | null;
    amountTotal: Prisma.Decimal;
    amountHt?: Prisma.Decimal | number | null;
    amountTax?: Prisma.Decimal | number | null;
    currency: string;
    label: string | null;
    reference: string | null;
    notes: string | null;
    version: number;
    postedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lines?: Array<{
      id: string;
      lineNo: number;
      description: string;
      amountHt: Prisma.Decimal;
      amountTax: Prisma.Decimal;
      amountTtc: Prisma.Decimal;
      taxCodeId: string;
      taxLineId: string | null;
      taxCode?: { code: string } | null;
    }>;
    payments?: {
      id: string;
      number: string;
      amount: Prisma.Decimal;
      currency: string;
      method: string;
      paymentDate: Date;
      bankMatches: { id: string }[];
    }[];
  },
  withPayments = false,
): ApBillDto {
  const ht = Number(row.amountHt ?? 0);
  const tax = Number(row.amountTax ?? 0);
  const base: ApBillDto = {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    vendorName: row.vendorName,
    supplierId: row.supplierId ?? null,
    status: row.status,
    billDate: row.billDate.toISOString().slice(0, 10),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    amountTotal: row.amountTotal.toFixed(3),
    amountHt: ht.toFixed(3),
    amountTax: tax.toFixed(3),
    currency: row.currency,
    label: row.label,
    reference: row.reference,
    notes: row.notes,
    version: row.version,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines?.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      description: l.description,
      amountHt: Number(l.amountHt).toFixed(3),
      amountTax: Number(l.amountTax).toFixed(3),
      amountTtc: Number(l.amountTtc).toFixed(3),
      taxCodeId: l.taxCodeId,
      taxCode: l.taxCode?.code ?? null,
      taxLineId: l.taxLineId,
    })),
  };
  if (!withPayments) return base;
  const payments = (row.payments ?? []).map((p) => ({
    id: p.id,
    number: p.number,
    amount: p.amount.toFixed(3),
    currency: p.currency,
    method: p.method,
    paymentDate: p.paymentDate.toISOString().slice(0, 10),
    matched: p.bankMatches.length > 0,
  }));
  const paid = (row.payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount.toFixed(3)),
    0,
  );
  return {
    ...base,
    payments,
    amountPaid: paid.toFixed(3),
  };
}
