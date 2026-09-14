import { HttpStatus, Injectable } from '@nestjs/common';
import { WaInboundMessage, WaInboundStatus } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService, type SalesOrderDto } from './sales.service';
import {
  WA_INBOX_ERROR_CODES,
  WA_INBOX_EVENT_TYPES,
  WA_INBOX_STATUSES,
} from './wa-inbox.constants';
import {
  CreateWaInboxDraftDto,
  DismissWaInboxDto,
  MatchWaInboxDto,
} from './wa-inbox.dto';
import { WaInboxException } from './wa-inbox.exception';

export type WaInboxItemDto = {
  id: string;
  companyId: string;
  wamid: string;
  fromPhone: string;
  profileName: string | null;
  bodyText: string | null;
  messageType: string;
  contactId: string | null;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  status: WaInboundStatus;
  orderId: string | null;
  orderNumber: string | null;
  receivedAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class WaInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly sales: SalesService,
  ) {}

  async list(
    companyId: string,
    opts: { status?: string; limit?: number } = {},
  ): Promise<{ items: WaInboxItemDto[] }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const status = parseStatus(opts.status);
    const rows = await this.prisma.waInboundMessage.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return { items: await this.enrich(companyId, rows) };
  }

  async get(companyId: string, id: string): Promise<WaInboxItemDto> {
    const row = await this.findActive(companyId, id);
    const [item] = await this.enrich(companyId, [row]);
    return item!;
  }

  async match(
    companyId: string,
    id: string,
    dto: MatchWaInboxDto,
  ): Promise<WaInboxItemDto> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.VERSION_CONFLICT,
        'Version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: row.version },
      );
    }
    if (
      row.status === WaInboundStatus.DRAFT_CREATED ||
      row.status === WaInboundStatus.DISMISSED
    ) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.INVALID_STATUS,
        'Cannot match a dismissed or draft-linked message.',
        HttpStatus.CONFLICT,
      );
    }

    const customer = await this.prisma.cusCustomer.findFirst({
      where: { id: dto.customerId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.CUSTOMER_NOT_FOUND,
        'Customer not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    let contactId = dto.contactId ?? null;
    if (contactId) {
      const contact = await this.prisma.cusContact.findFirst({
        where: {
          id: contactId,
          companyId,
          customerId: dto.customerId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!contact) {
        throw new WaInboxException(
          WA_INBOX_ERROR_CODES.CUSTOMER_NOT_FOUND,
          'Contact not found for customer.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.waInboundMessage.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          contactId,
          status: WaInboundStatus.MATCHED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'wa_inbound_message',
        aggregateId: id,
        eventType: WA_INBOX_EVENT_TYPES.MATCHED,
        payloadJson: {
          messageId: id,
          customerId: dto.customerId,
          contactId,
        },
      });
    });

    return this.get(companyId, id);
  }

  async dismiss(
    companyId: string,
    id: string,
    dto: DismissWaInboxDto,
  ): Promise<WaInboxItemDto> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.VERSION_CONFLICT,
        'Version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: row.version },
      );
    }
    if (row.status === WaInboundStatus.DRAFT_CREATED) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.INVALID_STATUS,
        'Cannot dismiss a message already linked to a draft.',
        HttpStatus.CONFLICT,
      );
    }
    if (row.status === WaInboundStatus.DISMISSED) {
      return this.get(companyId, id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.waInboundMessage.update({
        where: { id },
        data: {
          status: WaInboundStatus.DISMISSED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'wa_inbound_message',
        aggregateId: id,
        eventType: WA_INBOX_EVENT_TYPES.DISMISSED,
        payloadJson: { messageId: id },
      });
    });

    return this.get(companyId, id);
  }

  async createDraft(
    companyId: string,
    id: string,
    dto: CreateWaInboxDraftDto,
  ): Promise<{ message: WaInboxItemDto; order: SalesOrderDto }> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.VERSION_CONFLICT,
        'Version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: row.version },
      );
    }
    if (
      row.status === WaInboundStatus.DISMISSED ||
      row.status === WaInboundStatus.DRAFT_CREATED
    ) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.INVALID_STATUS,
        'Message is not eligible for draft creation.',
        HttpStatus.CONFLICT,
      );
    }
    if (!row.customerId) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.CUSTOMER_REQUIRED,
        'Match a customer before creating a draft order.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const waNote = [
      `WA ${row.fromPhone}`,
      row.bodyText ? `« ${row.bodyText.slice(0, 280)} »` : null,
      `wamid=${row.wamid}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const notes = [dto.notes?.trim(), waNote].filter(Boolean).join('\n');

    const order = await this.sales.create(companyId, {
      customerId: row.customerId,
      warehouseId: dto.warehouseId,
      lines: dto.lines,
      notes,
      confirmAfter: false,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.waInboundMessage.update({
        where: { id },
        data: {
          status: WaInboundStatus.DRAFT_CREATED,
          orderId: order.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'wa_inbound_message',
        aggregateId: id,
        eventType: WA_INBOX_EVENT_TYPES.DRAFT_CREATED,
        payloadJson: {
          messageId: id,
          orderId: order.id,
          orderNumber: order.number,
        },
      });
    });

    return { message: await this.get(companyId, id), order };
  }

  /**
   * Assisted product hints from message text (D252).
   * Never creates lines / orders — ADV must accept chips then confirm draft separately.
   */
  async suggestLines(
    companyId: string,
    id: string,
  ): Promise<{
    messageId: string;
    bodyText: string | null;
    suggestedQty: number | null;
    items: Array<{
      productId: string;
      sku: string;
      name: string;
      matchedToken: string;
      score: number;
    }>;
  }> {
    const row = await this.findActive(companyId, id);
    const text = (row.bodyText ?? '').trim();
    if (!text) {
      return {
        messageId: id,
        bodyText: row.bodyText,
        suggestedQty: null,
        items: [],
      };
    }

    const suggestedQty = extractSuggestedQty(text);
    const tokens = tokenizeForProductMatch(text);
    if (tokens.length === 0) {
      return {
        messageId: id,
        bodyText: row.bodyText,
        suggestedQty,
        items: [],
      };
    }

    const products = await this.prisma.prdProduct.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'DRAFT'] },
        OR: tokens.flatMap((t) => [
          { sku: { contains: t, mode: 'insensitive' as const } },
          { name: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      select: { id: true, sku: true, name: true },
      take: 40,
    });

    const scored: Array<{
      productId: string;
      sku: string;
      name: string;
      matchedToken: string;
      score: number;
    }> = [];

    for (const p of products) {
      const skuL = p.sku.toLowerCase();
      const nameL = p.name.toLowerCase();
      let bestToken = '';
      let score = 0;
      for (const t of tokens) {
        const tl = t.toLowerCase();
        if (skuL === tl) {
          score = Math.max(score, 100);
          bestToken = t;
        } else if (skuL.includes(tl)) {
          score = Math.max(score, 80);
          bestToken = t;
        } else if (nameL.includes(tl)) {
          score = Math.max(score, 50 + Math.min(tl.length, 20));
          bestToken = t;
        }
      }
      if (score > 0 && bestToken) {
        scored.push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          matchedToken: bestToken,
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score || a.sku.localeCompare(b.sku));
    const seen = new Set<string>();
    const items = scored.filter((s) => {
      if (seen.has(s.productId)) return false;
      seen.add(s.productId);
      return true;
    }).slice(0, 8);

    return {
      messageId: id,
      bodyText: row.bodyText,
      suggestedQty,
      items,
    };
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<WaInboundMessage> {
    const row = await this.prisma.waInboundMessage.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new WaInboxException(
        WA_INBOX_ERROR_CODES.NOT_FOUND,
        'WA inbox message not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async enrich(
    companyId: string,
    rows: WaInboundMessage[],
  ): Promise<WaInboxItemDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [
      ...new Set(rows.map((r) => r.customerId).filter(Boolean) as string[]),
    ];
    const orderIds = [
      ...new Set(rows.map((r) => r.orderId).filter(Boolean) as string[]),
    ];
    const [customers, orders] = await Promise.all([
      customerIds.length
        ? this.prisma.cusCustomer.findMany({
            where: { companyId, id: { in: customerIds } },
            include: { party: true },
          })
        : Promise.resolve([]),
      orderIds.length
        ? this.prisma.salOrder.findMany({
            where: { companyId, id: { in: orderIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([]),
    ]);
    const custById = new Map(
      customers.map((c) => [
        c.id,
        { code: c.code, name: c.party.legalName },
      ]),
    );
    const orderById = new Map(orders.map((o) => [o.id, o.number]));

    return rows.map((row) => {
      const cust = row.customerId ? custById.get(row.customerId) : undefined;
      return {
        id: row.id,
        companyId: row.companyId,
        wamid: row.wamid,
        fromPhone: row.fromPhone,
        profileName: row.profileName,
        bodyText: row.bodyText,
        messageType: row.messageType,
        contactId: row.contactId,
        customerId: row.customerId,
        customerCode: cust?.code ?? null,
        customerName: cust?.name ?? null,
        status: row.status,
        orderId: row.orderId,
        orderNumber: row.orderId ? (orderById.get(row.orderId) ?? null) : null,
        receivedAt: row.receivedAt.toISOString(),
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
}

function parseStatus(raw: string | undefined): WaInboundStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim().toUpperCase();
  if (!(WA_INBOX_STATUSES as readonly string[]).includes(v)) return undefined;
  return v as WaInboundStatus;
}

const STOP = new Set([
  'de',
  'du',
  'des',
  'le',
  'la',
  'les',
  'un',
  'une',
  'et',
  'ou',
  'pour',
  'avec',
  'svp',
  'stp',
  'bonjour',
  'salut',
  'merci',
  'demain',
  'aujourd',
  'hui',
  'kg',
  'pcs',
  'pc',
  'u',
  'unite',
  'unités',
  'unites',
]);

function tokenizeForProductMatch(text: string): string[] {
  const raw = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-zA-Z0-9À-ÿ+-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t.toLowerCase()));
  return [...new Set(raw)].slice(0, 12);
}

/** First plausible qty in message — ADV may override. */
function extractSuggestedQty(text: string): number | null {
  const m = text.match(
    /(?:^|[^\d])(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:kg|pcs?|u|unités?|unites?)?\b/i,
  );
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return null;
  return n;
}
