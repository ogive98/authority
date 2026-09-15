import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinInvoice,
  FinInvoiceStatus,
  FinOpenItemSide,
  FinOpenItemStatus,
  FinPromiseStatus,
  Prisma,
  SalOrderStatus,
} from '@prisma/client';
import { TaxDecisionSource, TaxKind } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { TaxService, round3, taxFromHt } from '../tax/tax.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { CreateInvoiceDto, CreateInvoiceLineDto } from './finance.dto';
import { FinanceException } from './finance.exception';

export type InvoiceLineDto = {
  id: string;
  lineNo: number;
  lineType: 'PRODUCT' | 'TAX';
  description: string;
  qty: string;
  unitPriceHt: string;
  taxCodeId: string;
  taxCode: string | null;
  productId: string | null;
  amountHt: string;
  amountTax: string;
  amountTtc: string;
};

export type InvoiceDto = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  status: FinInvoiceStatus;
  salesOrderId: string | null;
  shipmentId: string | null;
  fulfillmentDoc: 'DELIVERY_NOTE' | 'INVOICE';
  currency: string;
  amountHt: string;
  amountTax: string;
  amountFodec: string;
  amountTimbre: string;
  amountTotal: string;
  dueDate: string | null;
  issuedAt: string | null;
  label: string | null;
  notes: string | null;
  openItemId: string | null;
  lines: InvoiceLineDto[];
  /** True when FODEC/timbre came from VALIDATED expertise (not invented). */
  expertiseApplied: {
    fodec: boolean;
    timbre: boolean;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
};

type InvoiceWithExtras = FinInvoice & {
  openItems: { id: string }[];
  lines: Array<{
    id: string;
    lineNo: number;
    lineType?: 'PRODUCT' | 'TAX';
    description: string;
    qty: Prisma.Decimal;
    unitPriceHt: Prisma.Decimal;
    taxCodeId: string;
    productId?: string | null;
    amountHt: Prisma.Decimal;
    amountTax: Prisma.Decimal;
    amountTtc: Prisma.Decimal;
    taxCode?: { code: string } | null;
  }>;
};

@Injectable()
export class InvoiceService {
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
      customerId?: string;
      limit?: number;
      cursor?: string;
      /** When true and no explicit status, hide DRAFT (portal customer read). */
      excludeDraft?: boolean;
    },
  ): Promise<{ items: InvoiceDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();
    const statusFilter =
      status &&
      Object.values(FinInvoiceStatus).includes(status as FinInvoiceStatus)
        ? (status as FinInvoiceStatus)
        : null;

    const where: Prisma.FinInvoiceWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(statusFilter
        ? { status: statusFilter }
        : opts?.excludeDraft
          ? { status: { not: FinInvoiceStatus.DRAFT } }
          : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { label: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.finInvoice.findMany({
      where,
      include: {
        openItems: {
          where: { deletedAt: null },
          select: { id: true },
          take: 1,
        },
        lines: {
          orderBy: { lineNo: 'asc' },
          include: { taxCode: { select: { code: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  async get(companyId: string, id: string): Promise<InvoiceDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(companyId: string, dto: CreateInvoiceDto): Promise<InvoiceDto> {
    const customer = await this.assertCustomer(companyId, dto.customerId);
    if (dto.salesOrderId) {
      await this.assertSalesOrder(companyId, dto.customerId, dto.salesOrderId);
    }

    const computed = await this.computeLines(companyId, dto);
    const withExpertise = await this.applyExpertiseSurcharges(
      companyId,
      computed,
    );
    const number = await this.nextNumber(companyId);
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();
    const issue = dto.issue === true;
    const fulfillmentDoc =
      dto.fulfillmentDoc ?? customer.fulfillmentDoc ?? 'DELIVERY_NOTE';

    const row = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.finInvoice.create({
        data: {
          companyId,
          number,
          customerId: dto.customerId,
          status: issue ? FinInvoiceStatus.ISSUED : FinInvoiceStatus.DRAFT,
          salesOrderId: dto.salesOrderId ?? null,
          shipmentId: dto.shipmentId ?? null,
          fulfillmentDoc,
          currency,
          amountHt: withExpertise.amountHt,
          amountTax: withExpertise.amountTax,
          amountFodec: withExpertise.amountFodec,
          amountTimbre: withExpertise.amountTimbre,
          amountTotal: withExpertise.amountTtc,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          issuedAt: issue ? new Date() : null,
          label: dto.label?.trim() || null,
          notes: dto.notes?.trim() || null,
          lines: {
            create: withExpertise.lines.map((l) => ({
              companyId,
              lineNo: l.lineNo,
              description: l.description,
              qty: l.qty,
              unitPriceHt: l.unitPriceHt,
              taxCodeId: l.taxCodeId,
              productId: l.productId,
              amountHt: l.amountHt,
              amountTax: l.amountTax,
              amountTtc: l.amountTtc,
            })),
          },
        },
      });

      if (issue) {
        const createdLines = await tx.finInvoiceLine.findMany({
          where: { invoiceId: invoice.id, companyId },
          orderBy: { lineNo: 'asc' },
        });
        await this.tax.freezeDocumentLines(tx, companyId, {
          sourceType: 'fin_invoice',
          sourceId: invoice.id,
          customerId: dto.customerId,
          currency,
          lines: createdLines,
        });
        await this.createOrLinkOpenItem(tx, companyId, invoice);
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_invoice',
          aggregateId: invoice.id,
          eventType: FINANCE_EVENT_TYPES.INVOICE_ISSUED,
          payloadJson: {
            invoiceId: invoice.id,
            number: invoice.number,
            customerId: invoice.customerId,
            amountHt: invoice.amountHt.toString(),
            amountTax: invoice.amountTax.toString(),
            amountTotal: invoice.amountTotal.toString(),
          },
        });
      }

      return tx.finInvoice.findFirstOrThrow({
        where: { id: invoice.id },
        include: invoiceInclude,
      });
    });

    return this.enrichOne(companyId, row);
  }

  async issue(companyId: string, id: string): Promise<InvoiceDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finInvoice.findFirst({
        where: { id, companyId, deletedAt: null },
      });
      if (!existing) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVOICE_NOT_FOUND,
          'Invoice not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status === FinInvoiceStatus.CANCELLED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Cancelled invoice cannot be issued.',
          HttpStatus.CONFLICT,
        );
      }
      if (existing.status === FinInvoiceStatus.ISSUED) {
        return tx.finInvoice.findFirstOrThrow({
          where: { id },
          include: invoiceInclude,
        });
      }

      const draftLines = await tx.finInvoiceLine.findMany({
        where: { invoiceId: id, companyId },
        orderBy: { lineNo: 'asc' },
      });
      await this.tax.freezeDocumentLines(tx, companyId, {
        sourceType: 'fin_invoice',
        sourceId: id,
        customerId: existing.customerId,
        currency: existing.currency,
        lines: draftLines,
      });

      await tx.finInvoice.update({
        where: { id },
        data: {
          status: FinInvoiceStatus.ISSUED,
          issuedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const issued = await tx.finInvoice.findFirstOrThrow({ where: { id } });
      await this.createOrLinkOpenItem(tx, companyId, issued);
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_invoice',
        aggregateId: id,
        eventType: FINANCE_EVENT_TYPES.INVOICE_ISSUED,
        payloadJson: {
          invoiceId: id,
          number: issued.number,
          customerId: issued.customerId,
          amountHt: issued.amountHt.toString(),
          amountTax: issued.amountTax.toString(),
          amountTotal: issued.amountTotal.toString(),
        },
      });

      return tx.finInvoice.findFirstOrThrow({
        where: { id },
        include: invoiceInclude,
      });
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Cancel invoice (D183). DRAFT/ISSUED → CANCELLED.
   * ISSUED with fully-open AR closes the open item and emits cancelled → Thunder deaccounts.
   * Allocated / PARTIAL AR blocks cancel.
   */
  async cancel(companyId: string, id: string): Promise<InvoiceDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finInvoice.findFirst({
        where: { id, companyId, deletedAt: null },
      });
      if (!existing) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVOICE_NOT_FOUND,
          'Invoice not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status === FinInvoiceStatus.CANCELLED) {
        return tx.finInvoice.findFirstOrThrow({
          where: { id },
          include: invoiceInclude,
        });
      }

      if (
        existing.status !== FinInvoiceStatus.DRAFT &&
        existing.status !== FinInvoiceStatus.ISSUED
      ) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Invoice cannot be cancelled in this status.',
          HttpStatus.CONFLICT,
        );
      }

      const wasIssued = existing.status === FinInvoiceStatus.ISSUED;

      if (wasIssued) {
        const openItem = await tx.finOpenItem.findFirst({
          where: { companyId, invoiceId: id, deletedAt: null },
        });
        if (openItem) {
          const openAmt = Number(openItem.amountOpen);
          const totalAmt = Number(openItem.amountTotal);
          if (
            openItem.status === FinOpenItemStatus.PARTIAL ||
            openItem.status === FinOpenItemStatus.CLOSED ||
            openAmt + 1e-9 < totalAmt
          ) {
            throw new FinanceException(
              FINANCE_ERROR_CODES.INVALID_STATUS,
              'Cannot cancel invoice with allocations or closed AR — reverse payments first.',
              HttpStatus.CONFLICT,
            );
          }
          if (openItem.status === FinOpenItemStatus.OPEN) {
            await tx.finOpenItem.update({
              where: { id: openItem.id },
              data: {
                status: FinOpenItemStatus.CLOSED,
                amountOpen: 0,
                version: { increment: 1 },
              },
            });
            await tx.finPromiseToPay.updateMany({
              where: {
                companyId,
                openItemId: openItem.id,
                status: FinPromiseStatus.OPEN,
                deletedAt: null,
              },
              data: { status: FinPromiseStatus.CANCELLED },
            });
          }
        }
      }

      await tx.finInvoice.update({
        where: { id },
        data: {
          status: FinInvoiceStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      if (wasIssued) {
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_invoice',
          aggregateId: id,
          eventType: FINANCE_EVENT_TYPES.INVOICE_CANCELLED,
          payloadJson: {
            invoiceId: id,
            number: existing.number,
            customerId: existing.customerId,
            amountHt: existing.amountHt.toString(),
            amountTax: existing.amountTax.toString(),
            amountTotal: existing.amountTotal.toString(),
          },
        });
      }

      return tx.finInvoice.findFirstOrThrow({
        where: { id },
        include: invoiceInclude,
      });
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Ensures an ISSUED invoice + AR open item for a delivered sales order.
   * With `shipmentId`: idempotent per shipment (multi-BL / D176).
   * Without: idempotent per salesOrderId (legacy).
   */
  async ensureIssuedForSalesOrder(
    companyId: string,
    input: {
      customerId: string;
      salesOrderId: string;
      amountTotal: number;
      orderNumber?: string | null;
      currency?: string | null;
      shipmentId?: string | null;
      shipmentNumber?: string | null;
    },
  ): Promise<{ outcome: 'created' | 'existing'; invoice: InvoiceDto }> {
    if (input.shipmentId) {
      const byShipment = await this.prisma.finInvoice.findFirst({
        where: {
          companyId,
          shipmentId: input.shipmentId,
          deletedAt: null,
          status: { not: FinInvoiceStatus.CANCELLED },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (byShipment) {
        if (byShipment.status === FinInvoiceStatus.DRAFT) {
          return {
            outcome: 'existing',
            invoice: await this.issue(companyId, byShipment.id),
          };
        }
        return {
          outcome: 'existing',
          invoice: await this.get(companyId, byShipment.id),
        };
      }

      const label =
        input.orderNumber && input.shipmentNumber
          ? `Facture ${input.orderNumber} · ${input.shipmentNumber}`
          : input.orderNumber
            ? `Facture ${input.orderNumber}`
            : 'Facture livraison';
      const invoice = await this.create(companyId, {
        customerId: input.customerId,
        salesOrderId: input.salesOrderId,
        shipmentId: input.shipmentId,
        amountTotal: input.amountTotal,
        currency: input.currency ?? 'TND',
        label,
        notes: 'Auto-issued on delivery complete (amount as recorded).',
        issue: true,
      });
      return { outcome: 'created', invoice };
    }

    const existingOpen = await this.prisma.finOpenItem.findFirst({
      where: {
        companyId,
        salesOrderId: input.salesOrderId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
      },
    });
    if (existingOpen?.invoiceId) {
      return {
        outcome: 'existing',
        invoice: await this.get(companyId, existingOpen.invoiceId),
      };
    }

    const existingInv = await this.prisma.finInvoice.findFirst({
      where: {
        companyId,
        salesOrderId: input.salesOrderId,
        deletedAt: null,
        status: { not: FinInvoiceStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingInv) {
      if (existingInv.status === FinInvoiceStatus.DRAFT) {
        return {
          outcome: 'existing',
          invoice: await this.issue(companyId, existingInv.id),
        };
      }
      if (existingOpen && !existingOpen.invoiceId) {
        await this.prisma.finOpenItem.update({
          where: { id: existingOpen.id },
          data: { invoiceId: existingInv.id, version: { increment: 1 } },
        });
      }
      return {
        outcome: 'existing',
        invoice: await this.get(companyId, existingInv.id),
      };
    }

    const invoice = await this.create(companyId, {
      customerId: input.customerId,
      salesOrderId: input.salesOrderId,
      shipmentId: input.shipmentId ?? undefined,
      amountTotal: input.amountTotal,
      currency: input.currency ?? 'TND',
      label: input.orderNumber
        ? `Facture ${input.orderNumber}`
        : 'Facture livraison',
      notes: 'Auto-issued on delivery complete (amount as recorded).',
      issue: true,
    });
    return { outcome: 'created', invoice };
  }

  private async createOrLinkOpenItem(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoice: FinInvoice,
  ): Promise<void> {
    // Shipment-scoped invoices (D176) each get their own AR — do not reuse by salesOrderId.
    if (invoice.salesOrderId && !invoice.shipmentId) {
      const existing = await tx.finOpenItem.findFirst({
        where: {
          companyId,
          salesOrderId: invoice.salesOrderId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
        },
      });
      if (existing) {
        if (!existing.invoiceId) {
          await tx.finOpenItem.update({
            where: { id: existing.id },
            data: {
              invoiceId: invoice.id,
              version: { increment: 1 },
            },
          });
        }
        return;
      }
    }

    const linked = await tx.finOpenItem.findFirst({
      where: {
        companyId,
        invoiceId: invoice.id,
        deletedAt: null,
      },
    });
    if (linked) return;

    const year = new Date().getFullYear();
    const prefix = `FIN-${year}-`;
    const count = await tx.finOpenItem.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    const number = `${prefix}${String(count + 1).padStart(4, '0')}`;
    const amount = Number(invoice.amountTotal);

    const item = await tx.finOpenItem.create({
      data: {
        companyId,
        number,
        customerId: invoice.customerId,
        side: FinOpenItemSide.AR,
        status: FinOpenItemStatus.OPEN,
        salesOrderId: invoice.salesOrderId,
        invoiceId: invoice.id,
        currency: invoice.currency,
        amountTotal: amount,
        amountOpen: amount,
        dueDate: invoice.dueDate,
        label: invoice.label ?? `Facture ${invoice.number}`,
        notes: invoice.notes,
      },
    });

    await this.outbox.enqueue(tx, {
      companyId,
      aggregateType: 'fin_open_item',
      aggregateId: item.id,
      eventType: FINANCE_EVENT_TYPES.OPEN_ITEM_CREATED,
      payloadJson: {
        openItemId: item.id,
        number: item.number,
        customerId: item.customerId,
        invoiceId: invoice.id,
        amountTotal: item.amountTotal.toString(),
      },
    });
  }

  private async computeLines(
    companyId: string,
    dto: CreateInvoiceDto,
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
      productId: string | null;
      amountHt: number;
      amountTax: number;
      amountTtc: number;
    }>;
  }> {
    if (dto.lines && dto.lines.length > 0) {
      const lines = [];
      let amountHt = 0;
      let amountTax = 0;
      let lineNo = 1;
      for (const line of dto.lines) {
        const computed = await this.computeOneLine(
          companyId,
          line,
          lineNo,
          dto.customerId,
        );
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

    const ttc = round3(dto.amountTotal ?? 0);
    if (ttc <= 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'Provide lines or a positive amountTotal.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Legacy / AR-on-delivery: single EXO line so TTC stays as-recorded.
    const exo = await this.tax.findCodeByCode(companyId, 'EXO');
    if (!exo) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'Tax catalog missing EXO code — seed Tunisia VAT catalog.',
        HttpStatus.CONFLICT,
      );
    }
    return {
      amountHt: ttc,
      amountTax: 0,
      amountTtc: ttc,
      lines: [
        {
          lineNo: 1,
          description: dto.label?.trim() || 'Montant enregistré (hors ventilation TVA)',
          qty: 1,
          unitPriceHt: ttc,
          taxCodeId: exo.id,
          productId: null,
          amountHt: ttc,
          amountTax: 0,
          amountTtc: ttc,
        },
      ],
    };
  }

  /**
   * Apply FODEC / timbre only when Préférences expertise is VALIDATED
   * with structured rateBps / amountMilli — never invent rates.
   * Base FODEC = HT (hors TVA). Timbre = millimes / 1000 → TND.
   */
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
        productId?: string | null;
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
    line: CreateInvoiceLineDto,
    lineNo: number,
    customerId: string,
  ) {
    if (line.productId) {
      const product = await this.prisma.prdProduct.findFirst({
        where: { id: line.productId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!product) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_AMOUNT,
          'Product not found for this line.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const qty = round3(line.qty);
    const unitPriceHt = round3(line.unitPriceHt);
    const amountHt = round3(qty * unitPriceHt);

    let taxCodeId = line.taxCodeId?.trim() || undefined;
    if (!taxCodeId && line.productId) {
      // Tax engine resolves product default (+ D271 stub TVA19)
      taxCodeId = undefined;
    } else if (!taxCodeId) {
      taxCodeId = (await this.tax.resolveStubVat19(companyId)) ?? undefined;
    }
    if (!taxCodeId && !line.productId) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'VAT code required (or pick a product with default / stub TVA19).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { decisions } = await this.tax.calculate(companyId, {
      currency: 'TND',
      operationType: 'AR_INVOICE',
      customerId,
      lines: [
        {
          lineNo,
          taxCodeId,
          productId: line.productId,
          qty,
          unitPriceHt,
          amountHt,
          description: line.description,
        },
      ],
    });
    const vat = decisions.find((d) => d.kind === TaxKind.VAT);
    if (!vat) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'VAT tax code is not applicable for this line.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!vat.applicable && vat.source !== TaxDecisionSource.EXEMPTION) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'VAT tax code is not applicable for this line.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const amountTax = vat.applicable ? vat.calculatedAmount : 0;
    const amountTtc = round3(amountHt + amountTax);
    const resolvedTaxCodeId = vat.ruleId ?? taxCodeId;
    if (!resolvedTaxCodeId) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'Could not resolve VAT tax code for this line.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return {
      lineNo,
      description: line.description.trim(),
      qty,
      unitPriceHt,
      taxCodeId: resolvedTaxCodeId,
      productId: line.productId ?? null,
      amountHt,
      amountTax,
      amountTtc,
    };
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<InvoiceWithExtras> {
    const row = await this.prisma.finInvoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: invoiceInclude,
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVOICE_NOT_FOUND,
        'Invoice not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async assertCustomer(
    companyId: string,
    customerId: string,
  ): Promise<{ fulfillmentDoc: 'DELIVERY_NOTE' | 'INVOICE' }> {
    const customer = await this.prisma.cusCustomer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    if (!customer) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.CUSTOMER_NOT_FOUND,
        'Customer not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return customer;
  }

  private async assertSalesOrder(
    companyId: string,
    customerId: string,
    salesOrderId: string,
  ) {
    const order = await this.prisma.salOrder.findFirst({
      where: {
        id: salesOrderId,
        companyId,
        customerId,
        deletedAt: null,
        status: {
          in: [SalOrderStatus.CONFIRMED, SalOrderStatus.DRAFT],
        },
      },
    });
    if (!order) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.ORDER_NOT_FOUND,
        'Sales order not found for customer.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const count = await this.prisma.finInvoice.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: InvoiceWithExtras[],
  ): Promise<InvoiceDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const customers = await this.prisma.cusCustomer.findMany({
      where: { companyId, id: { in: customerIds }, deletedAt: null },
      include: { party: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));
    return rows.map((row) => {
      const c = map.get(row.customerId);
      return serializeInvoice(
        row,
        c?.code ?? null,
        c?.party.legalName ?? null,
      );
    });
  }

  private async enrichOne(
    companyId: string,
    row: InvoiceWithExtras,
  ): Promise<InvoiceDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }
}

const invoiceInclude = {
  openItems: {
    where: { deletedAt: null },
    select: { id: true },
    take: 1,
  },
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: { taxCode: { select: { code: true } } },
  },
};

function serializeInvoice(
  row: InvoiceWithExtras,
  customerCode: string | null,
  customerName: string | null,
): InvoiceDto {
  const amountFodec = Number(row.amountFodec ?? 0);
  const amountTimbre = Number(row.amountTimbre ?? 0);
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    customerId: row.customerId,
    customerCode,
    customerName,
    status: row.status,
    salesOrderId: row.salesOrderId,
    shipmentId: row.shipmentId,
    fulfillmentDoc: row.fulfillmentDoc,
    currency: row.currency,
    amountHt: Number(row.amountHt).toFixed(3),
    amountTax: Number(row.amountTax).toFixed(3),
    amountFodec: amountFodec.toFixed(3),
    amountTimbre: amountTimbre.toFixed(3),
    amountTotal: Number(row.amountTotal).toFixed(3),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    label: row.label,
    notes: row.notes,
    openItemId: row.openItems[0]?.id ?? null,
    lines: (row.lines ?? []).map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      lineType: l.lineType ?? 'PRODUCT',
      description: l.description,
      qty: Number(l.qty).toFixed(3),
      unitPriceHt: Number(l.unitPriceHt).toFixed(3),
      taxCodeId: l.taxCodeId,
      taxCode: l.taxCode?.code ?? null,
      productId: l.productId ?? null,
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
