import { Injectable } from '@nestjs/common';
import { FinApBillStatus, FinPaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SuppliersService, type SupplierDto } from './suppliers.service';

export type SupplierActionRequired = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  code: string;
  label: string;
  href?: string;
};

export type SupplierSummaryDto = {
  supplier: SupplierDto;
  counts: {
    contacts: number;
    draftBills: number;
    postedBills: number;
    payments: number;
  };
  ap: {
    openTotal: string;
    paidTotal: string;
    currency: string;
  };
  actionRequired: SupplierActionRequired[];
  recent: {
    bills: Array<{
      id: string;
      number: string;
      status: string;
      amountTotal: string;
      billDate: string;
      createdAt: string;
    }>;
    payments: Array<{
      id: string;
      number: string;
      status: string;
      amount: string;
      paymentDate: string | null;
      createdAt: string;
      apBillId: string | null;
    }>;
  };
};

export type SupplierTimelineItem = {
  id: string;
  kind: 'ap_bill' | 'ap_payment';
  at: string;
  title: string;
  subtitle: string | null;
  status: string;
  href: string;
  amount: string | null;
};

export type SupplierTimelineDto = {
  items: SupplierTimelineItem[];
  nextCursor: string | null;
};

function dec(v: Prisma.Decimal | number | string | null | undefined): string {
  if (v == null) return '0';
  return typeof v === 'string' ? v : v.toString();
}

@Injectable()
export class Supplier360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
  ) {}

  async summary(
    companyId: string,
    supplierId: string,
  ): Promise<SupplierSummaryDto> {
    const supplier = await this.suppliers.get(companyId, supplierId);

    const billWhere = {
      companyId,
      supplierId,
      deletedAt: null,
    } as const;

    const [
      contacts,
      draftBills,
      postedBills,
      paymentCount,
      openAgg,
      paidAgg,
      recentBillRows,
      paymentRows,
    ] = await Promise.all([
      this.prisma.supContact.count({
        where: { companyId, supplierId, deletedAt: null },
      }),
      this.prisma.finApBill.count({
        where: { ...billWhere, status: FinApBillStatus.DRAFT },
      }),
      this.prisma.finApBill.count({
        where: { ...billWhere, status: FinApBillStatus.POSTED },
      }),
      this.prisma.finApPayment.count({
        where: {
          companyId,
          deletedAt: null,
          apBill: { supplierId, deletedAt: null },
        },
      }),
      this.prisma.finApBill.aggregate({
        where: { ...billWhere, status: FinApBillStatus.POSTED },
        _sum: { amountTotal: true },
      }),
      this.prisma.finApPayment.aggregate({
        where: {
          companyId,
          deletedAt: null,
          status: FinPaymentStatus.POSTED,
          apBill: { supplierId, deletedAt: null },
        },
        _sum: { amount: true },
      }),
      this.prisma.finApBill.findMany({
        where: billWhere,
        orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          billDate: true,
          createdAt: true,
        },
      }),
      this.prisma.finApPayment.findMany({
        where: {
          companyId,
          deletedAt: null,
          apBill: { supplierId, deletedAt: null },
        },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          number: true,
          status: true,
          amount: true,
          paymentDate: true,
          createdAt: true,
          apBillId: true,
        },
      }),
    ]);

    const actionRequired: SupplierActionRequired[] = [];
    if (supplier.qualityHold || supplier.status === 'ON_HOLD') {
      actionRequired.push({
        id: 'hold',
        severity: 'high',
        code: 'QUALITY_HOLD',
        label: 'Hold qualité actif — vérifier avant nouvel achat',
        href: `/suppliers/${supplierId}`,
      });
    }
    if (supplier.status === 'BLOCKED') {
      actionRequired.push({
        id: 'blocked',
        severity: 'critical',
        code: 'BLOCKED',
        label: 'Fournisseur bloqué',
        href: `/suppliers/${supplierId}`,
      });
    }
    if (draftBills > 0) {
      actionRequired.push({
        id: 'draft-bills',
        severity: 'medium',
        code: 'DRAFT_BILLS',
        label: `${draftBills} facture(s) AP brouillon`,
        href: `/finance/ap-bills?supplierId=${supplierId}`,
      });
    }

    return {
      supplier,
      counts: {
        contacts,
        draftBills,
        postedBills,
        payments: paymentCount,
      },
      ap: {
        openTotal: dec(openAgg._sum.amountTotal),
        paidTotal: dec(paidAgg._sum.amount),
        currency: 'TND',
      },
      actionRequired,
      recent: {
        bills: recentBillRows.map((b) => ({
          id: b.id,
          number: b.number,
          status: b.status,
          amountTotal: dec(b.amountTotal),
          billDate: b.billDate.toISOString().slice(0, 10),
          createdAt: b.createdAt.toISOString(),
        })),
        payments: paymentRows.map((p) => ({
          id: p.id,
          number: p.number,
          status: p.status,
          amount: dec(p.amount),
          paymentDate: p.paymentDate
            ? p.paymentDate.toISOString().slice(0, 10)
            : null,
          createdAt: p.createdAt.toISOString(),
          apBillId: p.apBillId,
        })),
      },
    };
  }

  async timeline(
    companyId: string,
    supplierId: string,
    opts: { limit?: number } = {},
  ): Promise<SupplierTimelineDto> {
    await this.suppliers.get(companyId, supplierId);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 80);

    const [bills, payments] = await Promise.all([
      this.prisma.finApBill.findMany({
        where: { companyId, supplierId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          vendorName: true,
          createdAt: true,
          postedAt: true,
        },
      }),
      this.prisma.finApPayment.findMany({
        where: {
          companyId,
          deletedAt: null,
          apBill: { supplierId, deletedAt: null },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          status: true,
          amount: true,
          vendorName: true,
          createdAt: true,
          paymentDate: true,
        },
      }),
    ]);

    const items: SupplierTimelineItem[] = [
      ...bills.map((b) => ({
        id: `bill:${b.id}`,
        kind: 'ap_bill' as const,
        at: (b.postedAt ?? b.createdAt).toISOString(),
        title: `Facture AP ${b.number}`,
        subtitle: b.vendorName,
        status: b.status,
        href: `/finance/ap-bills/${b.id}`,
        amount: dec(b.amountTotal),
      })),
      ...payments.map((p) => ({
        id: `pay:${p.id}`,
        kind: 'ap_payment' as const,
        at: p.createdAt.toISOString(),
        title: `Paiement AP ${p.number}`,
        subtitle: p.vendorName,
        status: p.status,
        href: `/finance/ap-bills`,
        amount: dec(p.amount),
      })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, limit);

    return { items, nextCursor: null };
  }
}
