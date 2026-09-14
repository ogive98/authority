import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinPaymentMethod,
  Prisma,
  PtlPaymentDeclarationStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import { CustomerPortalException } from './customer-portal.exception';

export type PortalPaymentDeclarationDto = {
  id: string;
  number: string;
  amount: string;
  currency: string;
  method: FinPaymentMethod;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  openItemId: string | null;
  status: PtlPaymentDeclarationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type CreatePortalPaymentDeclarationInput = {
  amount: number;
  method: FinPaymentMethod;
  paymentDate: string;
  reference?: string;
  notes?: string;
  openItemId?: string;
};

@Injectable()
export class CustomerPortalPaymentDeclarationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    customerId: string,
    opts: { status?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: PortalPaymentDeclarationDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const status = opts.status?.trim().toUpperCase();
    const where: Prisma.PtlPaymentDeclarationWhereInput = {
      companyId,
      customerId,
      deletedAt: null,
      ...(status &&
      Object.values(PtlPaymentDeclarationStatus).includes(
        status as PtlPaymentDeclarationStatus,
      )
        ? { status: status as PtlPaymentDeclarationStatus }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };
    const rows = await this.prisma.ptlPaymentDeclaration.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? page[page.length - 1]?.id ?? null : null;
    return { items: page.map(serialize), nextCursor };
  }

  async get(
    companyId: string,
    customerId: string,
    id: string,
  ): Promise<PortalPaymentDeclarationDto> {
    const row = await this.findOwned(companyId, customerId, id);
    return serialize(row);
  }

  async create(
    companyId: string,
    customerId: string,
    userId: string,
    input: CreatePortalPaymentDeclarationInput,
  ): Promise<PortalPaymentDeclarationDto> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
        'amount must be a positive number.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!Object.values(FinPaymentMethod).includes(input.method)) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
        'Invalid payment method.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const paymentDate = new Date(input.paymentDate);
    if (Number.isNaN(paymentDate.getTime())) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
        'Invalid paymentDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (input.openItemId) {
      const openItem = await this.prisma.finOpenItem.findFirst({
        where: {
          id: input.openItemId,
          companyId,
          customerId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
        },
      });
      if (!openItem) {
        throw new CustomerPortalException(
          CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
          'Open item not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const number = await this.nextNumber(companyId);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ptlPaymentDeclaration.create({
        data: {
          companyId,
          customerId,
          number,
          amount: new Prisma.Decimal(input.amount.toFixed(3)),
          currency: 'TND',
          method: input.method,
          paymentDate,
          reference: input.reference?.trim() || null,
          notes: input.notes?.trim() || null,
          openItemId: input.openItemId ?? null,
          createdByUserId: userId,
          status: PtlPaymentDeclarationStatus.SUBMITTED,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ptl_payment_declaration',
        aggregateId: row.id,
        eventType: 'portals.payment_declaration.submitted.v1',
        payloadJson: {
          declarationId: row.id,
          number: row.number,
          customerId,
          amount: row.amount.toFixed(3),
          method: row.method,
          status: row.status,
        },
      });
      return row;
    });
    return serialize(created);
  }

  async cancel(
    companyId: string,
    customerId: string,
    id: string,
  ): Promise<PortalPaymentDeclarationDto> {
    const existing = await this.findOwned(companyId, customerId, id);
    if (existing.status !== PtlPaymentDeclarationStatus.SUBMITTED) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
        'Only SUBMITTED declarations can be cancelled.',
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.ptlPaymentDeclaration.update({
        where: { id: existing.id },
        data: {
          status: PtlPaymentDeclarationStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ptl_payment_declaration',
        aggregateId: row.id,
        eventType: 'portals.payment_declaration.cancelled.v1',
        payloadJson: {
          declarationId: row.id,
          number: row.number,
          customerId,
          status: row.status,
        },
      });
      return row;
    });
    return serialize(updated);
  }

  private async findOwned(
    companyId: string,
    customerId: string,
    id: string,
  ) {
    const row = await this.prisma.ptlPaymentDeclaration.findFirst({
      where: { id, companyId, customerId, deletedAt: null },
    });
    if (!row) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
        'Payment declaration not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `PPD-${year}-`;
    const last = await this.prisma.ptlPaymentDeclaration.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = last
      ? Number(last.number.slice(prefix.length)) + 1 || 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}

function serialize(row: {
  id: string;
  number: string;
  amount: Prisma.Decimal;
  currency: string;
  method: FinPaymentMethod;
  paymentDate: Date;
  reference: string | null;
  notes: string | null;
  openItemId: string | null;
  status: PtlPaymentDeclarationStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
}): PortalPaymentDeclarationDto {
  return {
    id: row.id,
    number: row.number,
    amount: row.amount.toFixed(3),
    currency: row.currency,
    method: row.method,
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    reference: row.reference,
    notes: row.notes,
    openItemId: row.openItemId,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewNote: row.reviewNote,
  };
}
