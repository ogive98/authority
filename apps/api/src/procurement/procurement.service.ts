import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ProcMessageChannel,
  ProcPoLineStatus,
  ProcPoStatus,
  ProcReceiptKind,
  ProcReceiptStatus,
  ProcSuggestionReason,
  ProcSuggestionStatus,
  SupSupplierStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { ApBillService } from '../finance/ap-bill.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROCUREMENT_DOC_TYPES,
  PROCUREMENT_ERROR_CODES,
  PROCUREMENT_EVENT_TYPES,
  PROCUREMENT_MESSAGE_CHANNELS,
} from './procurement.constants';
import {
  ConvertSuggestionDto,
  CreatePoDto,
  CreateReceiptDto,
  CreateSuggestionDto,
  SendPoDto,
  UpdatePoDto,
  UpdateReceiptDto,
  UpsertStockPolicyDto,
} from './procurement.dto';
import { ProcurementException } from './procurement.exception';

export type SuggestionDto = {
  id: string;
  number: string;
  productId: string;
  siteId: string | null;
  qty: string;
  reason: string;
  status: ProcSuggestionStatus;
  poId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type StockPolicyDto = {
  id: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  siteId: string;
  minQty: string;
  safetyQty: string;
  version: number;
  updatedAt: string;
};

export type PoLineDto = {
  id: string;
  poId: string;
  lineNo: number;
  productId: string;
  qtyOrdered: string;
  qtyReceived: string;
  unitPrice: string;
  lineTotal: string;
  moq: string | null;
  pack: string | null;
  status: ProcPoLineStatus;
  version: number;
};

export type PoDto = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  siteId: string | null;
  warehouseId: string | null;
  status: ProcPoStatus;
  expectedDate: string | null;
  currency: string;
  notes: string | null;
  amountTotal: string;
  submittedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines?: PoLineDto[];
  receipts?: ReceiptDto[];
  messages?: PoMessageDto[];
};

export type PoMessageDto = {
  id: string;
  poId: string;
  channel: ProcMessageChannel;
  toAddress: string;
  templateKey: string;
  bodyPreview: string | null;
  status: string;
  createdAt: string;
};

export type ReceiptLineDto = {
  id: string;
  receiptId: string;
  lineNo: number;
  poLineId: string;
  productId: string;
  qty: string;
  lotCode: string | null;
  dlc: string | null;
  unitPrice: string;
};

export type ReceiptDto = {
  id: string;
  number: string;
  poId: string;
  warehouseId: string;
  kind: ProcReceiptKind;
  status: ProcReceiptStatus;
  qcStatus: string | null;
  apBillId: string | null;
  postedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines?: ReceiptLineDto[];
};

const PO_OPEN_STATUSES: ProcPoStatus[] = [
  ProcPoStatus.SUBMITTED,
  ProcPoStatus.APPROVED,
  ProcPoStatus.SENT,
  ProcPoStatus.CONFIRMED,
  ProcPoStatus.PARTIAL,
];

const RECEIVABLE_PO_STATUSES: ProcPoStatus[] = [
  ProcPoStatus.SENT,
  ProcPoStatus.CONFIRMED,
  ProcPoStatus.PARTIAL,
];

const PO_MESSAGE_TEMPLATE =
  'Bonjour, veuillez trouver notre bon de commande {{po_number}} ' +
  '(livraison souhaitée: {{eta}}).\n{{lines}}\nMerci de confirmer.';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly inventory: InventoryService,
    private readonly apBills: ApBillService,
  ) {}

  // ---------------------------------------------------------------- suggestions

  async listSuggestions(
    companyId: string,
    opts: { status?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: SuggestionDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.ProcSuggestionWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts.status &&
      Object.values(ProcSuggestionStatus).includes(
        opts.status as ProcSuggestionStatus,
      )
        ? { status: opts.status as ProcSuggestionStatus }
        : {}),
    };
    const rows = await this.prisma.procSuggestion.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map(serializeSuggestion), nextCursor };
  }

  async createSuggestion(
    companyId: string,
    dto: CreateSuggestionDto,
  ): Promise<SuggestionDto> {
    await this.assertProduct(companyId, dto.productId);
    const number = await this.nextNumber(companyId, PROCUREMENT_DOC_TYPES.SUGGESTION);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.procSuggestion.create({
        data: {
          companyId,
          number,
          productId: dto.productId,
          siteId: dto.siteId ?? null,
          qty: new Prisma.Decimal(dto.qty),
          reason: dto.reason as ProcSuggestionReason,
          status: ProcSuggestionStatus.OPEN,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'proc_suggestion',
        aggregateId: created.id,
        eventType: PROCUREMENT_EVENT_TYPES.SUGGESTION_CREATED,
        payloadJson: {
          suggestionId: created.id,
          number: created.number,
          productId: created.productId,
          qty: created.qty.toString(),
          reason: created.reason,
        },
      });
      return created;
    });
    return serializeSuggestion(row);
  }

  async decideSuggestion(
    companyId: string,
    id: string,
    version: number,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<SuggestionDto> {
    const existing = await this.findSuggestion(companyId, id);
    assertVersion(existing.version, version);
    if (existing.status !== ProcSuggestionStatus.OPEN) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        `Only OPEN suggestions can be ${decision.toLowerCase()}.`,
        HttpStatus.CONFLICT,
      );
    }
    const row = await this.prisma.procSuggestion.update({
      where: { id },
      data: { status: decision as ProcSuggestionStatus, version: { increment: 1 } },
    });
    return serializeSuggestion(row);
  }

  async convertSuggestion(
    companyId: string,
    id: string,
    dto: ConvertSuggestionDto,
  ): Promise<PoDto> {
    const existing = await this.findSuggestion(companyId, id);
    assertVersion(existing.version, dto.version);
    if (
      existing.status !== ProcSuggestionStatus.OPEN &&
      existing.status !== ProcSuggestionStatus.APPROVED
    ) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        'Only OPEN or APPROVED suggestions can be converted.',
        HttpStatus.CONFLICT,
      );
    }
    const qty = dto.qty ?? Number(existing.qty.toString());
    const po = await this.createPoInternal(
      companyId,
      {
        supplierId: dto.supplierId,
        siteId: dto.siteId ?? existing.siteId ?? undefined,
        warehouseId: dto.warehouseId,
        expectedDate: dto.expectedDate,
        lines: [
          { productId: existing.productId, qtyOrdered: qty, unitPrice: dto.unitPrice },
        ],
      },
      { suggestionId: id },
    );
    return po;
  }

  /** Scan stock policies and create MIN suggestions for shortfalls (V0 manual trigger). */
  async generateSuggestionsFromPolicies(
    companyId: string,
  ): Promise<{ scanned: number; created: number }> {
    const policies = await this.prisma.procStockPolicy.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { productId: 'asc' },
    });
    let created = 0;
    for (const policy of policies) {
      const product = await this.prisma.prdProduct.findFirst({
        where: { id: policy.productId, companyId, deletedAt: null },
      });
      if (!product) continue;
      const openSuggestion = await this.prisma.procSuggestion.findFirst({
        where: {
          companyId,
          productId: policy.productId,
          siteId: policy.siteId,
          status: ProcSuggestionStatus.OPEN,
          deletedAt: null,
        },
      });
      if (openSuggestion) continue;

      const onHand = await this.prisma.invBalance.aggregate({
        where: { companyId, productId: policy.productId },
        _sum: { onHand: true },
      });
      const ordered = await this.prisma.procPoLine.aggregate({
        where: {
          companyId,
          productId: policy.productId,
          po: { status: { in: PO_OPEN_STATUSES }, deletedAt: null },
        },
        _sum: { qtyOrdered: true, qtyReceived: true },
      });
      const onHandQty = Number(onHand._sum.onHand?.toString() ?? 0);
      const inFlight =
        Number(ordered._sum.qtyOrdered?.toString() ?? 0) -
        Number(ordered._sum.qtyReceived?.toString() ?? 0);
      const minQty = Number(policy.minQty.toString());
      const shortfall = minQty - (onHandQty + inFlight);
      if (shortfall <= 0) continue;

      const safetyQty = Number(policy.safetyQty.toString());
      const qty = Math.max(shortfall, safetyQty);
      const number = await this.nextNumber(companyId, PROCUREMENT_DOC_TYPES.SUGGESTION);
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.procSuggestion.create({
          data: {
            companyId,
            number,
            productId: policy.productId,
            siteId: policy.siteId,
            qty: new Prisma.Decimal(qty),
            reason: 'MIN' as ProcSuggestionReason,
            status: ProcSuggestionStatus.OPEN,
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'proc_suggestion',
          aggregateId: row.id,
          eventType: PROCUREMENT_EVENT_TYPES.SUGGESTION_CREATED,
          payloadJson: {
            suggestionId: row.id,
            number: row.number,
            productId: row.productId,
            qty: row.qty.toString(),
            reason: row.reason,
            source: 'stock_policy',
          },
        });
      });
      created += 1;
    }
    return { scanned: policies.length, created };
  }

  // ------------------------------------------------------------------- policies

  async listPolicies(companyId: string): Promise<{ items: StockPolicyDto[] }> {
    const rows = await this.prisma.procStockPolicy.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ siteId: 'asc' }, { productId: 'asc' }],
      take: 500,
    });
    const products = await this.prisma.prdProduct.findMany({
      where: {
        id: { in: rows.map((r) => r.productId) },
        companyId,
      },
      select: { id: true, sku: true, name: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        productSku: byId.get(r.productId)?.sku ?? null,
        productName: byId.get(r.productId)?.name ?? null,
        siteId: r.siteId,
        minQty: r.minQty.toFixed(3),
        safetyQty: r.safetyQty.toFixed(3),
        version: r.version,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async upsertPolicy(
    companyId: string,
    dto: UpsertStockPolicyDto,
  ): Promise<StockPolicyDto> {
    await this.assertProduct(companyId, dto.productId);
    const existing = await this.prisma.procStockPolicy.findFirst({
      where: {
        companyId,
        productId: dto.productId,
        siteId: dto.siteId,
        deletedAt: null,
      },
    });
    const row = existing
      ? await this.prisma.procStockPolicy.update({
          where: { id: existing.id },
          data: {
            minQty: new Prisma.Decimal(dto.minQty),
            safetyQty: new Prisma.Decimal(dto.safetyQty ?? 0),
            version: { increment: 1 },
          },
        })
      : await this.prisma.procStockPolicy.create({
          data: {
            companyId,
            productId: dto.productId,
            siteId: dto.siteId,
            minQty: new Prisma.Decimal(dto.minQty),
            safetyQty: new Prisma.Decimal(dto.safetyQty ?? 0),
          },
        });
    return {
      id: row.id,
      productId: row.productId,
      productSku: null,
      productName: null,
      siteId: row.siteId,
      minQty: row.minQty.toFixed(3),
      safetyQty: row.safetyQty.toFixed(3),
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async removePolicy(companyId: string, id: string): Promise<{ removed: true }> {
    const existing = await this.prisma.procStockPolicy.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.POLICY_NOT_FOUND,
        'Stock policy not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.procStockPolicy.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    return { removed: true };
  }

  // ------------------------------------------------------------------------- PO

  async listPos(
    companyId: string,
    opts: { status?: string; q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: PoDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();
    const rows = await this.prisma.procPo.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts.status &&
        Object.values(ProcPoStatus).includes(opts.status as ProcPoStatus)
          ? { status: opts.status as ProcPoStatus }
          : {}),
        ...(q ? { number: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const suppliers = await this.loadSupplierNames(
      companyId,
      page.map((r) => r.supplierId),
    );
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return {
      items: page.map((r) => serializePo(r, suppliers)),
      nextCursor,
    };
  }

  async getPo(companyId: string, id: string): Promise<PoDto> {
    const row = await this.prisma.procPo.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.NOT_FOUND,
        'Purchase order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const [receipts, messages] = await Promise.all([
      this.prisma.procReceipt.findMany({
        where: { poId: id, companyId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.procMessageLog.findMany({
        where: { poId: id, companyId },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const suppliers = await this.loadSupplierNames(companyId, [row.supplierId]);
    return serializePo({ ...row, receipts, messages }, suppliers);
  }

  async createPo(
    companyId: string,
    dto: CreatePoDto,
  ): Promise<PoDto> {
    return this.createPoInternal(companyId, dto);
  }

  private async createPoInternal(
    companyId: string,
    dto: CreatePoDto,
    opts?: { suggestionId?: string },
  ): Promise<PoDto> {
    if (!dto.lines?.length) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.EMPTY_LINES,
        'PO requires at least one line.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const supplier = await this.assertSupplierOrderable(companyId, dto.supplierId);
    for (const line of dto.lines) {
      await this.assertProduct(companyId, line.productId);
      if (line.qtyOrdered <= 0) {
        throw new ProcurementException(
          PROCUREMENT_ERROR_CODES.INVALID_QTY,
          'qtyOrdered must be > 0.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    const amountTotal = dto.lines.reduce(
      (sum, l) => sum + l.qtyOrdered * l.unitPrice,
      0,
    );
    const number = await this.nextNumber(companyId, PROCUREMENT_DOC_TYPES.PO);
    const createdId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.procPo.create({
        data: {
          companyId,
          number,
          supplierId: supplier.id,
          siteId: dto.siteId ?? null,
          warehouseId: dto.warehouseId ?? null,
          status: ProcPoStatus.DRAFT,
          expectedDate: dto.expectedDate
            ? new Date(`${dto.expectedDate.slice(0, 10)}T00:00:00.000Z`)
            : null,
          currency: (dto.currency?.trim() || 'TND').toUpperCase(),
          notes: dto.notes?.trim() || null,
          amountTotal: new Prisma.Decimal(round3(amountTotal)),
          lines: {
            create: dto.lines.map((l, idx) => ({
              companyId,
              lineNo: idx + 1,
              productId: l.productId,
              qtyOrdered: new Prisma.Decimal(l.qtyOrdered),
              unitPrice: new Prisma.Decimal(l.unitPrice),
              lineTotal: new Prisma.Decimal(round3(l.qtyOrdered * l.unitPrice)),
              moq: l.moq !== undefined ? new Prisma.Decimal(l.moq) : null,
              pack: l.pack !== undefined ? new Prisma.Decimal(l.pack) : null,
            })),
          },
        },
      });
      if (opts?.suggestionId) {
        await tx.procSuggestion.update({
          where: { id: opts.suggestionId },
          data: {
            status: ProcSuggestionStatus.CONVERTED,
            poId: created.id,
            version: { increment: 1 },
          },
        });
      }
      return created.id;
    });
    const created = await this.prisma.procPo.findFirstOrThrow({
      where: { id: createdId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    const suppliers = await this.loadSupplierNames(companyId, [supplier.id]);
    return serializePo(created, suppliers);
  }

  async updatePo(
    companyId: string,
    id: string,
    dto: UpdatePoDto,
  ): Promise<PoDto> {
    const existing = await this.findPo(companyId, id);
    assertVersion(existing.version, dto.version);
    if (existing.status !== ProcPoStatus.DRAFT) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        'Only DRAFT POs can be edited.',
        HttpStatus.CONFLICT,
      );
    }
    if (dto.lines !== undefined) {
      if (!dto.lines.length) {
        throw new ProcurementException(
          PROCUREMENT_ERROR_CODES.EMPTY_LINES,
          'PO requires at least one line.',
          HttpStatus.BAD_REQUEST,
        );
      }
      for (const line of dto.lines) {
        await this.assertProduct(companyId, line.productId);
      }
    }
    const amountTotal =
      dto.lines?.reduce((sum, l) => sum + l.qtyOrdered * l.unitPrice, 0) ??
      Number(existing.amountTotal.toString());

    await this.prisma.$transaction(async (tx) => {
      if (dto.lines !== undefined) {
        await tx.procPoLine.deleteMany({ where: { poId: id } });
        await tx.procPoLine.createMany({
          data: dto.lines.map((l, idx) => ({
            companyId,
            poId: id,
            lineNo: idx + 1,
            productId: l.productId,
            qtyOrdered: new Prisma.Decimal(l.qtyOrdered),
            unitPrice: new Prisma.Decimal(l.unitPrice),
            lineTotal: new Prisma.Decimal(round3(l.qtyOrdered * l.unitPrice)),
            moq: l.moq !== undefined ? new Prisma.Decimal(l.moq) : null,
            pack: l.pack !== undefined ? new Prisma.Decimal(l.pack) : null,
          })),
        });
      }
      await tx.procPo.update({
        where: { id },
        data: {
          ...(dto.expectedDate !== undefined
            ? {
                expectedDate: dto.expectedDate
                  ? new Date(`${dto.expectedDate.slice(0, 10)}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          ...(dto.currency !== undefined
            ? { currency: dto.currency.trim().toUpperCase() }
            : {}),
          amountTotal: new Prisma.Decimal(round3(amountTotal)),
          version: { increment: 1 },
        },
      });
    });
    return this.getPo(companyId, id);
  }

  async transitionPo(
    companyId: string,
    id: string,
    version: number,
    action: 'submit' | 'approve' | 'confirm' | 'cancel',
  ): Promise<PoDto> {
    const existing = await this.findPo(companyId, id);
    assertVersion(existing.version, version);

    const flow: Record<
      typeof action,
      { from: ProcPoStatus[]; to: ProcPoStatus; at: string; event?: string }
    > = {
      submit: { from: [ProcPoStatus.DRAFT], to: ProcPoStatus.SUBMITTED, at: 'submittedAt' },
      approve: { from: [ProcPoStatus.SUBMITTED], to: ProcPoStatus.APPROVED, at: 'approvedAt' },
      confirm: {
        from: [ProcPoStatus.SENT],
        to: ProcPoStatus.CONFIRMED,
        at: 'confirmedAt',
        event: PROCUREMENT_EVENT_TYPES.PO_CONFIRMED,
      },
      cancel: {
        from: [ProcPoStatus.DRAFT, ProcPoStatus.SUBMITTED, ProcPoStatus.APPROVED],
        to: ProcPoStatus.CANCELLED,
        at: 'cancelledAt',
      },
    };
    const step = flow[action];
    if (!step.from.includes(existing.status)) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        `Cannot ${action} a PO in status ${existing.status}.`,
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.procPo.update({
        where: { id },
        data: {
          status: step.to,
          [step.at]: new Date(),
          version: { increment: 1 },
        },
      });
      if (step.event) {
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'proc_po',
          aggregateId: id,
          eventType: step.event,
          payloadJson: {
            poId: id,
            number: existing.number,
            supplierId: existing.supplierId,
            status: step.to,
          },
        });
      }
    });
    return this.getPo(companyId, id);
  }

  async sendPo(
    companyId: string,
    id: string,
    dto: SendPoDto,
  ): Promise<PoDto> {
    const existing = await this.findPo(companyId, id);
    assertVersion(existing.version, dto.version);
    if (existing.status !== ProcPoStatus.APPROVED) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        `Cannot send a PO in status ${existing.status}.`,
        HttpStatus.CONFLICT,
      );
    }
    const channel = dto.channel as ProcMessageChannel;
    if (!(PROCUREMENT_MESSAGE_CHANNELS as readonly string[]).includes(dto.channel)) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        'Invalid channel.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const lines = await this.prisma.procPoLine.findMany({
      where: { poId: id },
      orderBy: { lineNo: 'asc' },
    });
    const bodyPreview = renderPoMessage(
      dto.templateKey?.trim() || 'po_order_v1',
      existing,
      lines,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.procPo.update({
        where: { id },
        data: {
          status: ProcPoStatus.SENT,
          sentAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.procMessageLog.create({
        data: {
          companyId,
          poId: id,
          channel,
          toAddress: dto.toAddress.trim(),
          templateKey: dto.templateKey?.trim() || 'po_order_v1',
          bodyPreview: bodyPreview.slice(0, 500),
          status: 'QUEUED',
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'proc_po',
        aggregateId: id,
        eventType: PROCUREMENT_EVENT_TYPES.PO_SENT,
        payloadJson: {
          poId: id,
          number: existing.number,
          supplierId: existing.supplierId,
          channel: dto.channel,
          toAddress: dto.toAddress.trim(),
        },
      });
    });
    return this.getPo(companyId, id);
  }

  // ------------------------------------------------------------------ receipts

  async listReceipts(
    companyId: string,
    opts: { poId?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: ReceiptDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = await this.prisma.procReceipt.findMany({
      where: { companyId, deletedAt: null, ...(opts.poId ? { poId: opts.poId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map((r) => serializeReceipt(r)), nextCursor };
  }

  async getReceipt(companyId: string, id: string): Promise<ReceiptDto> {
    const row = await this.prisma.procReceipt.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.NOT_FOUND,
        'Receipt not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeReceipt(row);
  }

  async createReceipt(
    companyId: string,
    poId: string,
    dto: CreateReceiptDto,
  ): Promise<ReceiptDto> {
    const po = await this.findPo(companyId, poId);
    assertVersion(po.version, dto.version);
    if (!RECEIVABLE_PO_STATUSES.includes(po.status)) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.INVALID_STATUS,
        `Cannot receive a PO in status ${po.status}.`,
        HttpStatus.CONFLICT,
      );
    }
    if (!dto.lines?.length) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.EMPTY_LINES,
        'Receipt requires at least one line.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const kind = (dto.kind ?? 'RECEIPT') as ProcReceiptKind;
    const poLines = await this.prisma.procPoLine.findMany({
      where: { poId },
      orderBy: { lineNo: 'asc' },
    });
    const lines = dto.lines.map((l, idx) => {
      const poLine = poLines.find((pl) => pl.id === l.poLineId);
      if (!poLine) {
        throw new ProcurementException(
          PROCUREMENT_ERROR_CODES.PO_LINE_NOT_FOUND,
          `PO line not found: ${l.poLineId}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (kind === ProcReceiptKind.RECEIPT) {
        const received = Number(poLine.qtyReceived.toString());
        if (received + l.qty > Number(poLine.qtyOrdered.toString())) {
          throw new ProcurementException(
            PROCUREMENT_ERROR_CODES.QTY_EXCEEDS_ORDERED,
            `Qty exceeds remaining ordered qty for PO line ${poLine.lineNo}.`,
            HttpStatus.CONFLICT,
            { lineNo: poLine.lineNo, qtyOrdered: poLine.qtyOrdered.toString(), qtyReceived: poLine.qtyReceived.toString() },
          );
        }
      }
      return {
        lineNo: idx + 1,
        poLineId: poLine.id,
        companyId,
        productId: poLine.productId,
        qty: new Prisma.Decimal(l.qty),
        lotCode: l.lotCode?.trim() || null,
        dlc: l.dlc ? new Date(`${l.dlc.slice(0, 10)}T00:00:00.000Z`) : null,
        unitPrice: new Prisma.Decimal(
          l.unitPrice ?? Number(poLine.unitPrice.toString()),
        ),
      };
    });
    const number = await this.nextNumber(companyId, PROCUREMENT_DOC_TYPES.RECEIPT);
    const row = await this.prisma.procReceipt.create({
      data: {
        companyId,
        number,
        poId,
        warehouseId: dto.warehouseId,
        kind,
        status: ProcReceiptStatus.DRAFT,
        lines: { create: lines },
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    return serializeReceipt(row);
  }

  async updateReceipt(
    companyId: string,
    id: string,
    dto: UpdateReceiptDto,
  ): Promise<ReceiptDto> {
    const existing = await this.findReceipt(companyId, id);
    assertVersion(existing.version, dto.version);
    if (existing.status !== ProcReceiptStatus.DRAFT) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.RECEIPT_NOT_DRAFT,
        'Only DRAFT receipts can be edited.',
        HttpStatus.CONFLICT,
      );
    }
    const row = await this.prisma.procReceipt.update({
      where: { id },
      data: { qcStatus: dto.qcStatus?.trim() || null, version: { increment: 1 } },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    return serializeReceipt(row);
  }

  async postReceipt(
    companyId: string,
    id: string,
    version: number,
  ): Promise<ReceiptDto> {
    const existing = await this.prisma.procReceipt.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!existing) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.NOT_FOUND,
        'Receipt not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    assertVersion(existing.version, version);
    if (existing.status !== ProcReceiptStatus.DRAFT) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.RECEIPT_NOT_DRAFT,
        'Only DRAFT receipts can be posted.',
        HttpStatus.CONFLICT,
      );
    }
    const po = await this.findPo(companyId, existing.poId);
    const poLines = await this.prisma.procPoLine.findMany({ where: { poId: po.id } });

    // Stock movement first (each adjust is its own transaction, like returns RMA).
    if (existing.kind === ProcReceiptKind.RECEIPT) {
      for (const line of existing.lines) {
        await this.inventory.adjust(companyId, {
          warehouseId: existing.warehouseId,
          productId: line.productId,
          qtyDelta: Number(line.qty.toString()),
          reason: `Réception ${existing.number} / PO ${po.number}`,
          ...(line.lotCode ? { lotCode: line.lotCode } : {}),
          ...(line.dlc
            ? { dlc: line.dlc.toISOString().slice(0, 10) }
            : {}),
        });
      }
    } else {
      for (const line of existing.lines) {
        await this.inventory.adjust(companyId, {
          warehouseId: existing.warehouseId,
          productId: line.productId,
          qtyDelta: -Number(line.qty.toString()),
          reason: `Retour fournisseur ${existing.number} / PO ${po.number}`,
          ...(line.lotCode ? { lotCode: line.lotCode } : {}),
        });
      }
    }

    // Supplier debt: best-effort AP bill on receipt (mirrors RMA credit-note).
    let apBillId: string | null = existing.apBillId;
    if (existing.kind === ProcReceiptKind.RECEIPT && !apBillId) {
      const amountTotal = existing.lines.reduce(
        (sum, l) => sum + Number(l.qty.toString()) * Number(l.unitPrice.toString()),
        0,
      );
      if (amountTotal > 0 && po.supplierId) {
        try {
          const bill = await this.apBills.create(companyId, {
            supplierId: po.supplierId,
            billDate: new Date().toISOString().slice(0, 10),
            amountTotal: round3(amountTotal),
            notes: `Réception ${existing.number} — PO ${po.number}`,
          });
          await this.apBills.post(companyId, bill.id);
          apBillId = bill.id;
        } catch (err) {
          this.logger.warn(
            `Auto AP bill skipped for receipt ${existing.number}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.procReceipt.updateMany({
        where: { id, companyId, status: ProcReceiptStatus.DRAFT, deletedAt: null },
        data: {
          status: ProcReceiptStatus.POSTED,
          postedAt: new Date(),
          apBillId,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new ProcurementException(
          PROCUREMENT_ERROR_CODES.RECEIPT_NOT_DRAFT,
          'Only DRAFT receipts can be posted.',
          HttpStatus.CONFLICT,
        );
      }

      for (const line of existing.lines) {
        const poLine = poLines.find((pl) => pl.id === line.poLineId);
        if (!poLine) continue;
        const newReceived =
          Number(poLine.qtyReceived.toString()) + Number(line.qty.toString());
        await tx.procPoLine.update({
          where: { id: poLine.id },
          data: {
            qtyReceived: new Prisma.Decimal(newReceived),
            status:
              newReceived >= Number(poLine.qtyOrdered.toString())
                ? ProcPoLineStatus.CLOSED
                : ProcPoLineStatus.OPEN,
            version: { increment: 1 },
          },
        });
      }

      const refreshed = await tx.procPoLine.findMany({ where: { poId: po.id } });
      const allClosed = refreshed.every(
        (l) => l.status === ProcPoLineStatus.CLOSED,
      );
      const nextStatus = allClosed ? ProcPoStatus.RECEIVED : ProcPoStatus.PARTIAL;
      if (
        RECEIVABLE_PO_STATUSES.includes(po.status)
      ) {
        await tx.procPo.update({
          where: { id: po.id },
          data: { status: nextStatus, version: { increment: 1 } },
        });
      }

      const eventType =
        existing.kind === ProcReceiptKind.RECEIPT
          ? PROCUREMENT_EVENT_TYPES.RECEIPT_POSTED
          : PROCUREMENT_EVENT_TYPES.PO_RETURNED;
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'proc_receipt',
        aggregateId: id,
        eventType,
        payloadJson: {
          receiptId: id,
          number: existing.number,
          poId: po.id,
          poNumber: po.number,
          kind: existing.kind,
          apBillId,
          status: ProcReceiptStatus.POSTED,
        },
      });

      return tx.procReceipt.findFirstOrThrow({
        where: { id },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
    });
    return serializeReceipt(row);
  }

  // ------------------------------------------------------------------- helpers

  private async findSuggestion(companyId: string, id: string) {
    const row = await this.prisma.procSuggestion.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.NOT_FOUND,
        'Suggestion not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async findPo(companyId: string, id: string) {
    const row = await this.prisma.procPo.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.NOT_FOUND,
        'Purchase order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async findReceipt(companyId: string, id: string) {
    const row = await this.prisma.procReceipt.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.NOT_FOUND,
        'Receipt not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async assertSupplierOrderable(companyId: string, supplierId: string) {
    const supplier = await this.prisma.supSupplier.findFirst({
      where: { id: supplierId, companyId, deletedAt: null },
    });
    if (!supplier) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.SUPPLIER_NOT_FOUND,
        'Supplier not found.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (supplier.status !== SupSupplierStatus.ACTIVE) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.SUPPLIER_BLOCKED,
        `Supplier is ${supplier.status}; PO creation is blocked.`,
        HttpStatus.CONFLICT,
        { supplierStatus: supplier.status },
      );
    }
    return supplier;
  }

  private async assertProduct(companyId: string, productId: string) {
    const product = await this.prisma.prdProduct.findFirst({
      where: { id: productId, companyId, deletedAt: null },
    });
    if (!product) {
      throw new ProcurementException(
        PROCUREMENT_ERROR_CODES.PRODUCT_NOT_FOUND,
        'Product not found.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return product;
  }

  private async loadSupplierNames(companyId: string, supplierIds: string[]) {
    const unique = [...new Set(supplierIds)].filter(Boolean);
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.supSupplier.findMany({
      where: { id: { in: unique }, companyId, deletedAt: null },
      include: { party: { select: { legalName: true } } },
    });
    return new Map(rows.map((r) => [r.id, r.party.legalName]));
  }

  private async nextNumber(companyId: string, docType: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefixText = `${docType}-${year}-`;
    if (docType === PROCUREMENT_DOC_TYPES.SUGGESTION) {
      const total = await this.prisma.procSuggestion.count({
        where: { companyId, number: { startsWith: prefixText } },
      });
      return `${prefixText}${String(total + 1).padStart(4, '0')}`;
    }
    if (docType === PROCUREMENT_DOC_TYPES.PO) {
      const total = await this.prisma.procPo.count({
        where: { companyId, number: { startsWith: prefixText } },
      });
      return `${prefixText}${String(total + 1).padStart(4, '0')}`;
    }
    const total = await this.prisma.procReceipt.count({
      where: { companyId, number: { startsWith: prefixText } },
    });
    return `${prefixText}${String(total + 1).padStart(4, '0')}`;
  }
}

function assertVersion(current: number, provided: number): void {
  if (current !== provided) {
    throw new ProcurementException(
      PROCUREMENT_ERROR_CODES.VERSION_CONFLICT,
      'Version conflict.',
      HttpStatus.CONFLICT,
      { currentVersion: current },
    );
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function renderPoMessage(
  templateKey: string,
  po: { number: string; expectedDate: Date | null },
  lines: { lineNo: number; productId: string; qtyOrdered: Prisma.Decimal; unitPrice: Prisma.Decimal }[],
): string {
  void templateKey;
  const linesText = lines
    .map(
      (l) =>
        `- L${l.lineNo} ${l.productId.slice(0, 8)}: ${l.qtyOrdered.toString()} x ${l.unitPrice.toString()}`,
    )
    .join('\n');
  return PO_MESSAGE_TEMPLATE
    .replaceAll('{{po_number}}', po.number)
    .replaceAll(
      '{{eta}}',
      po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : 'à confirmer',
    )
    .replaceAll('{{lines}}', linesText);
}

function serializeSuggestion(row: {
  id: string;
  number: string;
  productId: string;
  siteId: string | null;
  qty: Prisma.Decimal;
  reason: string;
  status: ProcSuggestionStatus;
  poId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): SuggestionDto {
  return {
    id: row.id,
    number: row.number,
    productId: row.productId,
    siteId: row.siteId,
    qty: row.qty.toFixed(3),
    reason: row.reason,
    status: row.status,
    poId: row.poId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type PoRow = {
  id: string;
  number: string;
  supplierId: string;
  siteId: string | null;
  warehouseId: string | null;
  status: ProcPoStatus;
  expectedDate: Date | null;
  currency: string;
  notes: string | null;
  amountTotal: Prisma.Decimal;
  submittedAt: Date | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lines?: Prisma.ProcPoLineGetPayload<object>[];
  receipts?: Prisma.ProcReceiptGetPayload<object>[];
  messages?: Prisma.ProcMessageLogGetPayload<object>[];
};

function serializePo(
  row: PoRow,
  supplierNames: Map<string, string>,
): PoDto {
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplierId,
    supplierName: supplierNames.get(row.supplierId) ?? null,
    siteId: row.siteId,
    warehouseId: row.warehouseId,
    status: row.status,
    expectedDate: row.expectedDate ? row.expectedDate.toISOString().slice(0, 10) : null,
    currency: row.currency,
    notes: row.notes,
    amountTotal: row.amountTotal.toFixed(3),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.lines
      ? { lines: row.lines.map((l) => serializePoLine(l)) }
      : {}),
    ...(row.receipts ? { receipts: row.receipts.map((r) => serializeReceipt(r)) } : {}),
    ...(row.messages
      ? {
          messages: row.messages.map((m) => ({
            id: m.id,
            poId: m.poId,
            channel: m.channel,
            toAddress: m.toAddress,
            templateKey: m.templateKey,
            bodyPreview: m.bodyPreview,
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          })),
        }
      : {}),
  };
}

function serializePoLine(row: {
  id: string;
  poId: string;
  lineNo: number;
  productId: string;
  qtyOrdered: Prisma.Decimal;
  qtyReceived: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  moq: Prisma.Decimal | null;
  pack: Prisma.Decimal | null;
  status: ProcPoLineStatus;
  version: number;
}): PoLineDto {
  return {
    id: row.id,
    poId: row.poId,
    lineNo: row.lineNo,
    productId: row.productId,
    qtyOrdered: row.qtyOrdered.toFixed(3),
    qtyReceived: row.qtyReceived.toFixed(3),
    unitPrice: row.unitPrice.toFixed(3),
    lineTotal: row.lineTotal.toFixed(3),
    moq: row.moq != null ? row.moq.toFixed(3) : null,
    pack: row.pack != null ? row.pack.toFixed(3) : null,
    status: row.status,
    version: row.version,
  };
}

function serializeReceipt(
  row: Prisma.ProcReceiptGetPayload<object> & {
    lines?: Prisma.ProcReceiptLineGetPayload<object>[];
  },
): ReceiptDto {
  return {
    id: row.id,
    number: row.number,
    poId: row.poId,
    warehouseId: row.warehouseId,
    kind: row.kind,
    status: row.status,
    qcStatus: row.qcStatus,
    apBillId: row.apBillId,
    postedAt: row.postedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.lines
      ? {
          lines: row.lines.map((l) => ({
            id: l.id,
            receiptId: l.receiptId,
            lineNo: l.lineNo,
            poLineId: l.poLineId,
            productId: l.productId,
            qty: l.qty.toFixed(3),
            lotCode: l.lotCode,
            dlc: l.dlc ? l.dlc.toISOString().slice(0, 10) : null,
            unitPrice: l.unitPrice.toFixed(3),
          })),
        }
      : {}),
  };
}
