import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PtlClaim,
  PtlClaimStatus,
  PtlClaimType,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import type { PortalCreateClaimDto } from './customer-portal.dto';
import { CustomerPortalException } from './customer-portal.exception';

export type PortalClaimDto = {
  id: string;
  number: string;
  type: PtlClaimType;
  status: PtlClaimStatus;
  subject: string;
  description: string;
  orderId: string | null;
  orderNumber: string | null;
  shipmentId: string | null;
  shipmentNumber: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

const OPEN_STATUSES: PtlClaimStatus[] = [
  PtlClaimStatus.OPEN,
  PtlClaimStatus.UNDER_REVIEW,
  PtlClaimStatus.ACTION_REQUIRED,
];

@Injectable()
export class CustomerPortalClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async countOpen(companyId: string, customerId: string): Promise<number> {
    return this.prisma.ptlClaim.count({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        status: { in: OPEN_STATUSES },
      },
    });
  }

  async list(
    companyId: string,
    customerId: string,
    opts: { q?: string; status?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: PortalClaimDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();
    const status = opts.status?.trim().toUpperCase();

    const where: Prisma.PtlClaimWhereInput = {
      companyId,
      customerId,
      deletedAt: null,
      ...(status &&
      Object.values(PtlClaimStatus).includes(status as PtlClaimStatus)
        ? { status: status as PtlClaimStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { subject: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.ptlClaim.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  async get(
    companyId: string,
    customerId: string,
    id: string,
  ): Promise<PortalClaimDto> {
    const row = await this.prisma.ptlClaim.findFirst({
      where: { id, companyId, customerId, deletedAt: null },
    });
    if (!row) {
      throw this.notFound();
    }
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }

  async create(
    companyId: string,
    customerId: string,
    userId: string,
    dto: PortalCreateClaimDto,
  ): Promise<PortalClaimDto> {
    const subject = dto.subject.trim();
    const description = dto.description.trim();
    if (!subject || !description) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
        'subject and description are required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.orderId) {
      await this.assertOrder(companyId, customerId, dto.orderId);
    }
    if (dto.shipmentId) {
      const ship = await this.assertShipment(
        companyId,
        customerId,
        dto.shipmentId,
      );
      if (dto.orderId && ship.orderId !== dto.orderId) {
        throw new CustomerPortalException(
          CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
          'shipmentId does not belong to the given orderId.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const number = await this.nextNumber(companyId);
    const row = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.ptlClaim.create({
        data: {
          companyId,
          customerId,
          number,
          type: dto.type,
          status: PtlClaimStatus.OPEN,
          subject,
          description,
          orderId: dto.orderId ?? null,
          shipmentId: dto.shipmentId ?? null,
          createdByUserId: userId,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ptl_claim',
        aggregateId: claim.id,
        eventType: 'portals.claim.created.v1',
        payloadJson: {
          claimId: claim.id,
          number: claim.number,
          customerId,
          type: claim.type,
        },
      });

      return claim;
    });

    const [dtoOut] = await this.enrichMany(companyId, [row]);
    return dtoOut!;
  }

  private async assertOrder(
    companyId: string,
    customerId: string,
    orderId: string,
  ): Promise<void> {
    const order = await this.prisma.salOrder.findFirst({
      where: { id: orderId, companyId, customerId, deletedAt: null },
    });
    if (!order) {
      throw this.notFound();
    }
  }

  private async assertShipment(
    companyId: string,
    customerId: string,
    shipmentId: string,
  ): Promise<{ id: string; orderId: string }> {
    const ship = await this.prisma.dlvShipment.findFirst({
      where: { id: shipmentId, companyId, customerId, deletedAt: null },
      select: { id: true, orderId: true },
    });
    if (!ship) {
      throw this.notFound();
    }
    return ship;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CLM-${year}-`;
    const count = await this.prisma.ptlClaim.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: PtlClaim[],
  ): Promise<PortalClaimDto[]> {
    if (rows.length === 0) return [];
    const orderIds = [
      ...new Set(rows.map((r) => r.orderId).filter(Boolean) as string[]),
    ];
    const shipIds = [
      ...new Set(rows.map((r) => r.shipmentId).filter(Boolean) as string[]),
    ];
    const [orders, ships] = await Promise.all([
      orderIds.length
        ? this.prisma.salOrder.findMany({
            where: { companyId, id: { in: orderIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([] as { id: string; number: string }[]),
      shipIds.length
        ? this.prisma.dlvShipment.findMany({
            where: { companyId, id: { in: shipIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([] as { id: string; number: string }[]),
    ]);
    const orderMap = new Map(orders.map((o) => [o.id, o.number]));
    const shipMap = new Map(ships.map((s) => [s.id, s.number]));

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      type: row.type,
      status: row.status,
      subject: row.subject,
      description: row.description,
      orderId: row.orderId,
      orderNumber: row.orderId ? (orderMap.get(row.orderId) ?? null) : null,
      shipmentId: row.shipmentId,
      shipmentNumber: row.shipmentId
        ? (shipMap.get(row.shipmentId) ?? null)
        : null,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private notFound(): CustomerPortalException {
    return new CustomerPortalException(
      CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      'Claim not found.',
      HttpStatus.NOT_FOUND,
    );
  }
}
