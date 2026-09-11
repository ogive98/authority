import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinCreditNote,
  FinCreditNoteStatus,
  FinInvoiceStatus,
  FinOpenItemStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { TaxService, round3, taxFromHt } from '../tax/tax.service';
import { nextOpenStatus } from './allocation-engine.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type {
  CreateCreditNoteDto,
  CreateCreditNoteLineDto,
} from './finance.dto';
import { FinanceException } from './finance.exception';

export type CreditNoteLineDto = {
  id: string;
  lineNo: number;
  description: string;
  qty: string;
  unitPriceHt: string;
  taxCodeId: string;
  taxCode: string | null;
  amountHt: string;
  amountTax: string;
  amountTtc: string;
};

export type CreditNoteDto = {
  id: string;
  companyId: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  status: FinCreditNoteStatus;
  currency: string;
  amountHt: string;
  amountTax: string;
  amountFodec: string;
  amountTimbre: string;
  amountTotal: string;
  amountAppliedToAr: string;
  amountUnapplied: string;
  reason: string | null;
  notes: string | null;
  issuedAt: string | null;
  lines: CreditNoteLineDto[];
  expertiseApplied: {
    fodec: boolean;
    timbre: boolean;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
};

type CreditNoteWithExtras = FinCreditNote & {
  invoice?: { number: string } | null;
  lines: Array<{
    id: string;
    lineNo: number;
    description: string;
    qty: Prisma.Decimal;
    unitPriceHt: Prisma.Decimal;
    taxCodeId: string;
    amountHt: Prisma.Decimal;
    amountTax: Prisma.Decimal;
    amountTtc: Prisma.Decimal;
    taxCode?: { code: string } | null;
  }>;
};

@Injectable()
export class CreditNoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly tax: TaxService,
    private readonly expertise: ExpertiseResolverService,
  ) {}

  async list(
    companyId: string,
    opts?: {
      q?: string;
      status?: string;
      invoiceId?: string;
      customerId?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: CreditNoteDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();
    const statusFilter =
      status &&
      Object.values(FinCreditNoteStatus).includes(
        status as FinCreditNoteStatus,
      )
        ? (status as FinCreditNoteStatus)
        : null;

    const where: Prisma.FinCreditNoteWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.invoiceId ? { invoiceId: opts.invoiceId } : {}),
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { reason: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.finCreditNote.findMany({
      where,
      include: creditNoteInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  async get(companyId: string, id: string): Promise<CreditNoteDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(
    companyId: string,
    dto: CreateCreditNoteDto,
  ): Promise<CreditNoteDto> {
    const invoice = await this.assertIssuedInvoice(
      companyId,
      dto.sourceInvoiceId,
    );

    const computed = await this.resolveLines(companyId, invoice, dto);
    const withExpertise = await this.applyExpertiseSurcharges(
      companyId,
      computed,
    );
    await this.assertCap(
      companyId,
      invoice.id,
      Number(invoice.amountTotal),
      withExpertise.amountTtc,
    );

    const number = await this.nextNumber(companyId);
    const currency = (dto.currency?.trim() || invoice.currency || 'TND').toUpperCase();
    const issue = dto.issue === true;

    const row = await this.prisma.$transaction(async (tx) => {
      const creditNote = await tx.finCreditNote.create({
        data: {
          companyId,
          number,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          status: issue
            ? FinCreditNoteStatus.ISSUED
            : FinCreditNoteStatus.DRAFT,
          currency,
          amountHt: withExpertise.amountHt,
          amountTax: withExpertise.amountTax,
          amountFodec: withExpertise.amountFodec,
          amountTimbre: withExpertise.amountTimbre,
          amountTotal: withExpertise.amountTtc,
          amountAppliedToAr: 0,
          amountUnapplied: 0,
          reason: dto.reason?.trim() || null,
          notes: dto.notes?.trim() || null,
          issuedAt: issue ? new Date() : null,
          lines: {
            create: withExpertise.lines.map((l) => ({
              companyId,
              lineNo: l.lineNo,
              description: l.description,
              qty: l.qty,
              unitPriceHt: l.unitPriceHt,
              taxCodeId: l.taxCodeId,
              amountHt: l.amountHt,
              amountTax: l.amountTax,
              amountTtc: l.amountTtc,
            })),
          },
        },
      });

      if (issue) {
        await this.applyOnIssue(tx, companyId, creditNote);
      }

      return tx.finCreditNote.findFirstOrThrow({
        where: { id: creditNote.id },
        include: creditNoteInclude,
      });
    });

    return this.enrichOne(companyId, row);
  }

  async issue(companyId: string, id: string): Promise<CreditNoteDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finCreditNote.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { invoice: true },
      });
      if (!existing) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.CREDIT_NOTE_NOT_FOUND,
          'Credit note not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status === FinCreditNoteStatus.CANCELLED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Cancelled credit note cannot be issued.',
          HttpStatus.CONFLICT,
        );
      }
      if (existing.status === FinCreditNoteStatus.ISSUED) {
        return tx.finCreditNote.findFirstOrThrow({
          where: { id },
          include: creditNoteInclude,
        });
      }

      if (existing.invoice.status !== FinInvoiceStatus.ISSUED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Source invoice must be ISSUED.',
          HttpStatus.CONFLICT,
        );
      }

      await this.assertCap(
        companyId,
        existing.invoiceId,
        Number(existing.invoice.amountTotal),
        Number(existing.amountTotal),
        id,
        tx,
      );

      await tx.finCreditNote.update({
        where: { id },
        data: {
          status: FinCreditNoteStatus.ISSUED,
          issuedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const issued = await tx.finCreditNote.findFirstOrThrow({ where: { id } });
      await this.applyOnIssue(tx, companyId, issued);

      return tx.finCreditNote.findFirstOrThrow({
        where: { id },
        include: creditNoteInclude,
      });
    });

    return this.enrichOne(companyId, row);
  }

  /** V0 — cancel DRAFT only. */
  async cancel(companyId: string, id: string): Promise<CreditNoteDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finCreditNote.findFirst({
        where: { id, companyId, deletedAt: null },
      });
      if (!existing) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.CREDIT_NOTE_NOT_FOUND,
          'Credit note not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status === FinCreditNoteStatus.CANCELLED) {
        return tx.finCreditNote.findFirstOrThrow({
          where: { id },
          include: creditNoteInclude,
        });
      }
      if (existing.status !== FinCreditNoteStatus.DRAFT) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Only draft credit notes can be cancelled in V0.',
          HttpStatus.CONFLICT,
        );
      }

      await tx.finCreditNote.update({
        where: { id },
        data: {
          status: FinCreditNoteStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      return tx.finCreditNote.findFirstOrThrow({
        where: { id },
        include: creditNoteInclude,
      });
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Cap: sum(ISSUED CN TTC for invoice) + thisCnTtc ≤ invoice.amountTotal.
   * Exported for unit tests.
   */
  static assertAmountCap(
    invoiceTotal: number,
    issuedSum: number,
    thisCnTtc: number,
  ): void {
    const inv = round3(invoiceTotal);
    const sum = round3(issuedSum + thisCnTtc);
    if (sum > inv + 1e-9) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.CREDIT_NOTE_OVER_CAP,
        `Credit notes TTC (${sum.toFixed(3)}) exceed invoice TTC (${inv.toFixed(3)}).`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async applyOnIssue(
    tx: Prisma.TransactionClient,
    companyId: string,
    creditNote: FinCreditNote,
  ): Promise<void> {
    const cnTtc = round3(Number(creditNote.amountTotal));
    const openItem = await tx.finOpenItem.findFirst({
      where: {
        companyId,
        invoiceId: creditNote.invoiceId,
        deletedAt: null,
      },
    });

    let applied = 0;
    if (openItem) {
      const openAmt = round3(Number(openItem.amountOpen));
      applied = round3(Math.min(cnTtc, Math.max(0, openAmt)));
      if (applied > 0) {
        const nextOpen = round3(Math.max(0, openAmt - applied));
        await tx.finOpenItem.update({
          where: { id: openItem.id },
          data: {
            amountOpen: nextOpen,
            status: nextOpenStatus(nextOpen),
            version: { increment: 1 },
          },
        });
      }
    }

    const unapplied = round3(Math.max(0, cnTtc - applied));
    await tx.finCreditNote.update({
      where: { id: creditNote.id },
      data: {
        amountAppliedToAr: applied,
        amountUnapplied: unapplied,
      },
    });

    await this.outbox.enqueue(tx, {
      companyId,
      aggregateType: 'fin_credit_note',
      aggregateId: creditNote.id,
      eventType: FINANCE_EVENT_TYPES.CREDIT_NOTE_ISSUED,
      payloadJson: {
        creditNoteId: creditNote.id,
        invoiceId: creditNote.invoiceId,
        number: creditNote.number,
        customerId: creditNote.customerId,
        amountHt: creditNote.amountHt.toString(),
        amountTax: creditNote.amountTax.toString(),
        amountTotal: creditNote.amountTotal.toString(),
        amountAppliedToAr: applied.toFixed(3),
        amountUnapplied: unapplied.toFixed(3),
      },
    });
  }

  private async resolveLines(
    companyId: string,
    invoice: {
      id: string;
      amountTotal: Prisma.Decimal;
      lines?: Array<{
        description: string;
        qty: Prisma.Decimal;
        unitPriceHt: Prisma.Decimal;
        taxCodeId: string;
      }>;
    },
    dto: CreateCreditNoteDto,
  ) {
    if (dto.copyFull === true) {
      const invLines =
        invoice.lines ??
        (
          await this.prisma.finInvoiceLine.findMany({
            where: { invoiceId: invoice.id, companyId },
            orderBy: { lineNo: 'asc' },
          })
        );
      if (invLines.length === 0) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_AMOUNT,
          'Invoice has no lines to copy.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const lines: CreateCreditNoteLineDto[] = invLines.map((l) => ({
        description: l.description,
        qty: Number(l.qty),
        unitPriceHt: Number(l.unitPriceHt),
        taxCodeId: l.taxCodeId,
      }));
      return this.computeLines(companyId, lines);
    }

    if (dto.lines && dto.lines.length > 0) {
      return this.computeLines(companyId, dto.lines);
    }

    throw new FinanceException(
      FINANCE_ERROR_CODES.INVALID_AMOUNT,
      'Provide lines or copyFull:true.',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async computeLines(
    companyId: string,
    inputLines: CreateCreditNoteLineDto[],
  ): Promise<{
    amountHt: number;
    amountTax: number;
    amountTtc: number;
    lines: Array<{
      lineNo: number;
      description: string;
      qty: number;
      unitPriceHt: number;
      taxCodeId: string;
      amountHt: number;
      amountTax: number;
      amountTtc: number;
    }>;
  }> {
    const lines = [];
    let amountHt = 0;
    let amountTax = 0;
    let lineNo = 1;
    for (const line of inputLines) {
      const computed = await this.computeOneLine(companyId, line, lineNo);
      lines.push(computed);
      amountHt = round3(amountHt + computed.amountHt);
      amountTax = round3(amountTax + computed.amountTax);
      lineNo += 1;
    }
    return {
      amountHt,
      amountTax,
      amountTtc: round3(amountHt + amountTax),
      lines,
    };
  }

  private async applyExpertiseSurcharges(
    companyId: string,
    base: {
      amountHt: number;
      amountTax: number;
      amountTtc: number;
      lines: Array<{
        lineNo: number;
        description: string;
        qty: number;
        unitPriceHt: number;
        taxCodeId: string;
        amountHt: number;
        amountTax: number;
        amountTtc: number;
      }>;
    },
  ): Promise<{
    amountHt: number;
    amountTax: number;
    amountFodec: number;
    amountTimbre: number;
    amountTtc: number;
    lines: typeof base.lines;
  }> {
    const [fodec, timbre] = await Promise.all([
      this.expertise.getFodec(companyId),
      this.expertise.getTimbre(companyId),
    ]);

    let amountFodec = 0;
    if (fodec?.rateBps != null && fodec.rateBps > 0 && base.amountHt > 0) {
      amountFodec = taxFromHt(base.amountHt, fodec.rateBps);
    }

    let amountTimbre = 0;
    if (timbre?.amountMilli != null && timbre.amountMilli > 0) {
      amountTimbre = round3(timbre.amountMilli / 1000);
    } else if (
      timbre?.rateBps != null &&
      timbre.rateBps > 0 &&
      base.amountHt > 0
    ) {
      amountTimbre = taxFromHt(base.amountHt, timbre.rateBps);
    }

    return {
      amountHt: base.amountHt,
      amountTax: base.amountTax,
      amountFodec,
      amountTimbre,
      amountTtc: round3(
        base.amountHt + base.amountTax + amountFodec + amountTimbre,
      ),
      lines: base.lines,
    };
  }

  private async computeOneLine(
    companyId: string,
    line: CreateCreditNoteLineDto,
    lineNo: number,
  ) {
    const qty = round3(line.qty);
    const unitPriceHt = round3(line.unitPriceHt);
    const amountHt = round3(qty * unitPriceHt);
    const { rateBps } = await this.tax.resolveRateBps(
      companyId,
      line.taxCodeId,
    );
    const amountTax = taxFromHt(amountHt, rateBps);
    const amountTtc = round3(amountHt + amountTax);
    return {
      lineNo,
      description: line.description.trim(),
      qty,
      unitPriceHt,
      taxCodeId: line.taxCodeId,
      amountHt,
      amountTax,
      amountTtc,
    };
  }

  private async assertCap(
    companyId: string,
    invoiceId: string,
    invoiceTotal: number,
    thisCnTtc: number,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const issued = await db.finCreditNote.findMany({
      where: {
        companyId,
        invoiceId,
        deletedAt: null,
        status: FinCreditNoteStatus.ISSUED,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { amountTotal: true },
    });
    const issuedSum = issued.reduce(
      (acc, row) => round3(acc + Number(row.amountTotal)),
      0,
    );
    CreditNoteService.assertAmountCap(invoiceTotal, issuedSum, thisCnTtc);
  }

  private async assertIssuedInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.finInvoice.findFirst({
      where: { id: invoiceId, companyId, deletedAt: null },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!invoice) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVOICE_NOT_FOUND,
        'Source invoice not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (invoice.status !== FinInvoiceStatus.ISSUED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Credit notes require an ISSUED invoice.',
        HttpStatus.CONFLICT,
      );
    }
    return invoice;
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<CreditNoteWithExtras> {
    const row = await this.prisma.finCreditNote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: creditNoteInclude,
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.CREDIT_NOTE_NOT_FOUND,
        'Credit note not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AV-${year}-`;
    const count = await this.prisma.finCreditNote.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: CreditNoteWithExtras[],
  ): Promise<CreditNoteDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const customers = await this.prisma.cusCustomer.findMany({
      where: { companyId, id: { in: customerIds }, deletedAt: null },
      include: { party: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));
    return rows.map((row) => {
      const c = map.get(row.customerId);
      return serializeCreditNote(
        row,
        c?.code ?? null,
        c?.party.legalName ?? null,
      );
    });
  }

  private async enrichOne(
    companyId: string,
    row: CreditNoteWithExtras,
  ): Promise<CreditNoteDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }
}

const creditNoteInclude = {
  invoice: { select: { number: true } },
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: { taxCode: { select: { code: true } } },
  },
};

function serializeCreditNote(
  row: CreditNoteWithExtras,
  customerCode: string | null,
  customerName: string | null,
): CreditNoteDto {
  const amountFodec = Number(row.amountFodec ?? 0);
  const amountTimbre = Number(row.amountTimbre ?? 0);
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice?.number ?? null,
    customerId: row.customerId,
    customerCode,
    customerName,
    status: row.status,
    currency: row.currency,
    amountHt: Number(row.amountHt).toFixed(3),
    amountTax: Number(row.amountTax).toFixed(3),
    amountFodec: amountFodec.toFixed(3),
    amountTimbre: amountTimbre.toFixed(3),
    amountTotal: Number(row.amountTotal).toFixed(3),
    amountAppliedToAr: Number(row.amountAppliedToAr).toFixed(3),
    amountUnapplied: Number(row.amountUnapplied).toFixed(3),
    reason: row.reason,
    notes: row.notes,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    lines: (row.lines ?? []).map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      description: l.description,
      qty: Number(l.qty).toFixed(3),
      unitPriceHt: Number(l.unitPriceHt).toFixed(3),
      taxCodeId: l.taxCodeId,
      taxCode: l.taxCode?.code ?? null,
      amountHt: Number(l.amountHt).toFixed(3),
      amountTax: Number(l.amountTax).toFixed(3),
      amountTtc: Number(l.amountTtc).toFixed(3),
    })),
    expertiseApplied: {
      fodec: amountFodec > 0,
      timbre: amountTimbre > 0,
    },
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
