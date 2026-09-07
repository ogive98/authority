import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinInvoice,
  FinInvoiceStatus,
  FinOpenItemSide,
  FinOpenItemStatus,
  Prisma,
  SalOrderStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { CreateInvoiceDto } from './finance.dto';
import { FinanceException } from './finance.exception';

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
  currency: string;
  amountTotal: string;
  dueDate: string | null;
  issuedAt: string | null;
  label: string | null;
  notes: string | null;
  openItemId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
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
    await this.assertCustomer(companyId, dto.customerId);
    const amount = round3(dto.amountTotal);
    if (amount <= 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'amountTotal must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.salesOrderId) {
      await this.assertSalesOrder(companyId, dto.customerId, dto.salesOrderId);
    }

    const number = await this.nextNumber(companyId);
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();
    const issue = dto.issue === true;

    const row = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.finInvoice.create({
        data: {
          companyId,
          number,
          customerId: dto.customerId,
          status: issue ? FinInvoiceStatus.ISSUED : FinInvoiceStatus.DRAFT,
          salesOrderId: dto.salesOrderId ?? null,
          shipmentId: dto.shipmentId ?? null,
          currency,
          amountTotal: amount,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          issuedAt: issue ? new Date() : null,
          label: dto.label?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });

      if (issue) {
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
            amountTotal: invoice.amountTotal.toString(),
          },
        });
      }

      return tx.finInvoice.findFirstOrThrow({
        where: { id: invoice.id },
        include: {
          openItems: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
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
          include: {
            openItems: {
              where: { deletedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        });
      }

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
          amountTotal: issued.amountTotal.toString(),
        },
      });

      return tx.finInvoice.findFirstOrThrow({
        where: { id },
        include: {
          openItems: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      });
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Ensures an ISSUED invoice + AR open item for a delivered sales order.
   * Idempotent on salesOrderId (reuses existing open item / invoice).
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
    },
  ): Promise<{ outcome: 'created' | 'existing'; invoice: InvoiceDto }> {
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
    if (invoice.salesOrderId) {
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

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<
    FinInvoice & { openItems: { id: string }[] }
  > {
    const row = await this.prisma.finInvoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        openItems: {
          where: { deletedAt: null },
          select: { id: true },
          take: 1,
        },
      },
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

  private async assertCustomer(companyId: string, customerId: string) {
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
          in: [
            SalOrderStatus.CONFIRMED,
            SalOrderStatus.DRAFT,
          ],
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
    rows: Array<FinInvoice & { openItems: { id: string }[] }>,
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
    row: FinInvoice & { openItems: { id: string }[] },
  ): Promise<InvoiceDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function serializeInvoice(
  row: FinInvoice & { openItems: { id: string }[] },
  customerCode: string | null,
  customerName: string | null,
): InvoiceDto {
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
    currency: row.currency,
    amountTotal: row.amountTotal.toFixed(3),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    label: row.label,
    notes: row.notes,
    openItemId: row.openItems[0]?.id ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
