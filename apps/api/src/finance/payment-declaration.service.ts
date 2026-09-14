import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinPaymentMethod,
  Prisma,
  PtlPaymentDeclarationStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { FinanceException } from './finance.exception';

export type AdvPaymentDeclarationDto = {
  id: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
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
  createdByUserId: string;
};

@Injectable()
export class PaymentDeclarationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: {
      q?: string;
      status?: string;
      customerId?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: AdvPaymentDeclarationDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const status = opts.status?.trim().toUpperCase();
    const q = opts.q?.trim();
    const where: Prisma.PtlPaymentDeclarationWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(status &&
      Object.values(PtlPaymentDeclarationStatus).includes(
        status as PtlPaymentDeclarationStatus,
      )
        ? { status: status as PtlPaymentDeclarationStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { reference: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };
    const rows = await this.prisma.ptlPaymentDeclaration.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const enriched = await this.enrich(companyId, page);
    const nextCursor =
      rows.length > limit ? page[page.length - 1]?.id ?? null : null;
    return { items: enriched, nextCursor };
  }

  async get(
    companyId: string,
    id: string,
  ): Promise<AdvPaymentDeclarationDto> {
    const row = await this.prisma.ptlPaymentDeclaration.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.NOT_FOUND,
        'Payment declaration not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const [dto] = await this.enrich(companyId, [row]);
    return dto;
  }

  async acknowledge(
    companyId: string,
    id: string,
    reviewerUserId: string,
    opts: { reviewNote?: string; version: number } = { version: 0 },
  ): Promise<AdvPaymentDeclarationDto> {
    return this.review(
      companyId,
      id,
      reviewerUserId,
      PtlPaymentDeclarationStatus.ACKNOWLEDGED,
      opts,
    );
  }

  async reject(
    companyId: string,
    id: string,
    reviewerUserId: string,
    opts: { reviewNote?: string; version: number } = { version: 0 },
  ): Promise<AdvPaymentDeclarationDto> {
    return this.review(
      companyId,
      id,
      reviewerUserId,
      PtlPaymentDeclarationStatus.REJECTED,
      opts,
    );
  }

  private async review(
    companyId: string,
    id: string,
    reviewerUserId: string,
    nextStatus:
      | typeof PtlPaymentDeclarationStatus.ACKNOWLEDGED
      | typeof PtlPaymentDeclarationStatus.REJECTED,
    opts: { reviewNote?: string; version: number },
  ): Promise<AdvPaymentDeclarationDto> {
    const existing = await this.prisma.ptlPaymentDeclaration.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.NOT_FOUND,
        'Payment declaration not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.version !== opts.version) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.status !== PtlPaymentDeclarationStatus.SUBMITTED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Only SUBMITTED declarations can be reviewed.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ptlPaymentDeclaration.updateMany({
        where: {
          id,
          companyId,
          version: opts.version,
          status: PtlPaymentDeclarationStatus.SUBMITTED,
          deletedAt: null,
        },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedByUserId: reviewerUserId,
          reviewNote: opts.reviewNote?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Version conflict.',
          HttpStatus.CONFLICT,
        );
      }
      const row = await tx.ptlPaymentDeclaration.findUniqueOrThrow({
        where: { id },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ptl_payment_declaration',
        aggregateId: row.id,
        eventType:
          nextStatus === PtlPaymentDeclarationStatus.ACKNOWLEDGED
            ? 'finance.payment_declaration.acknowledged.v1'
            : 'finance.payment_declaration.rejected.v1',
        payloadJson: {
          declarationId: row.id,
          number: row.number,
          customerId: row.customerId,
          status: row.status,
        },
      });
      return row;
    });

    const [dto] = await this.enrich(companyId, [updated]);
    return dto;
  }

  private async enrich(
    companyId: string,
    rows: Array<{
      id: string;
      customerId: string;
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
      createdByUserId: string;
    }>,
  ): Promise<AdvPaymentDeclarationDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const customers = await this.prisma.cusCustomer.findMany({
      where: { companyId, id: { in: customerIds } },
      include: { party: { select: { legalName: true } } },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));
    return rows.map((r) => {
      const c = byId.get(r.customerId);
      return {
        id: r.id,
        number: r.number,
        customerId: r.customerId,
        customerCode: c?.code ?? null,
        customerName: c?.party.legalName ?? null,
        amount: r.amount.toFixed(3),
        currency: r.currency,
        method: r.method,
        paymentDate: r.paymentDate.toISOString().slice(0, 10),
        reference: r.reference,
        notes: r.notes,
        openItemId: r.openItemId,
        status: r.status,
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reviewNote: r.reviewNote,
        createdByUserId: r.createdByUserId,
      };
    });
  }
}
