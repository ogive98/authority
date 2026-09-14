import { Injectable } from '@nestjs/common';
import {
  DlvShipmentStatus,
  FinInvoiceStatus,
  FinPaymentStatus,
  IamLifecycleStatus,
  SalOrderStatus,
} from '@prisma/client';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService, type CustomerDto } from './customers.service';

export type CustomerActionRequired = {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  code: string;
  label: string;
  href?: string;
};

export type CustomerSummaryDto = {
  customer: CustomerDto;
  finance: Awaited<ReturnType<FinanceService['customerFinancialOverview']>>;
  counts: {
    openOrders: number;
    draftOrders: number;
    openInvoices: number;
    recentPayments: number;
    openDeliveries: number;
    portalMembers: number;
    contacts: number;
    addresses: number;
  };
  actionRequired: CustomerActionRequired[];
  recent: {
    orders: Array<{
      id: string;
      number: string;
      status: string;
      amountTotal: string;
      createdAt: string;
    }>;
    invoices: Array<{
      id: string;
      number: string;
      status: string;
      amountTotal: string;
      issuedAt: string | null;
      createdAt: string;
    }>;
    payments: Array<{
      id: string;
      number: string;
      status: string;
      amount: string;
      paymentDate: string | null;
      createdAt: string;
    }>;
    deliveries: Array<{
      id: string;
      number: string;
      status: string;
      createdAt: string;
    }>;
  };
};

export type CustomerTimelineItem = {
  id: string;
  kind: 'order' | 'invoice' | 'payment' | 'delivery' | 'claim';
  at: string;
  title: string;
  subtitle: string | null;
  status: string;
  href: string;
  amount: string | null;
};

export type CustomerTimelineDto = {
  items: CustomerTimelineItem[];
  nextCursor: string | null;
};

export type CustomerDocumentItem = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  visibility: string;
  linkType: string;
  linkId: string | null;
  createdAt: string;
};

export type CustomerDocumentsDto = {
  items: CustomerDocumentItem[];
  nextCursor: string | null;
};

export type CustomerCommunicationContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
  receiveInvoices: boolean;
  receiveDeliveryNotes: boolean;
  receiveDunning: boolean;
  portalAccess: boolean;
  active: boolean;
};

export type CustomerCommunicationDunning = {
  id: string;
  number: string;
  channel: string;
  status: string;
  sendStatus: string;
  recipient: string;
  subject: string;
  amountOpen: string;
  currency: string;
  milestoneDay: number;
  createdAt: string;
  sentAt: string | null;
  href: string;
};

export type CustomerCommunicationDeclaration = {
  id: string;
  number: string;
  status: string;
  amount: string;
  currency: string;
  method: string;
  paymentDate: string;
  createdAt: string;
  href: string;
};

export type CustomerCommunicationsDto = {
  channels: {
    salubritaEmail: boolean;
    salubritaWhatsapp: boolean;
    salubritaPortal: boolean;
    contactsWithEmail: number;
    contactsWithWhatsapp: number;
  };
  contacts: CustomerCommunicationContact[];
  dunning: CustomerCommunicationDunning[];
  paymentDeclarations: CustomerCommunicationDeclaration[];
};

@Injectable()
export class Customer360Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly finance: FinanceService,
  ) {}

  async summary(
    companyId: string,
    customerId: string,
  ): Promise<CustomerSummaryDto> {
    const customer = await this.customers.get(companyId, customerId);
    const finance = await this.finance.customerFinancialOverview(
      companyId,
      customerId,
    );

    const [
      openOrders,
      draftOrders,
      openInvoices,
      recentPayments,
      openDeliveries,
      portalMembers,
      recentOrders,
      recentInvoiceRows,
      recentPaymentRows,
      recentDeliveryRows,
    ] = await Promise.all([
      this.prisma.salOrder.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: SalOrderStatus.CONFIRMED,
        },
      }),
      this.prisma.salOrder.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: SalOrderStatus.DRAFT,
        },
      }),
      this.prisma.finInvoice.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: FinInvoiceStatus.ISSUED,
        },
      }),
      this.prisma.finPayment.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: FinPaymentStatus.POSTED,
        },
      }),
      this.prisma.dlvShipment.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: {
            in: [
              DlvShipmentStatus.READY,
              DlvShipmentStatus.ASSIGNED,
              DlvShipmentStatus.OUT,
            ],
          },
        },
      }),
      this.prisma.ptlMembership.count({
        where: {
          companyId,
          customerId,
          status: IamLifecycleStatus.ACTIVE,
        },
      }),
      this.prisma.salOrder.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          createdAt: true,
        },
      }),
      this.prisma.finInvoice.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          issuedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.finPayment.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          amount: true,
          paymentDate: true,
          createdAt: true,
        },
      }),
      this.prisma.dlvShipment.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const actionRequired = this.buildActions(customer, finance, {
      draftOrders,
      openDeliveries,
      portalMembers,
    });

    return {
      customer,
      finance,
      counts: {
        openOrders,
        draftOrders,
        openInvoices,
        recentPayments,
        openDeliveries,
        portalMembers,
        contacts: customer.contacts?.length ?? 0,
        addresses: customer.addresses?.length ?? 0,
      },
      actionRequired,
      recent: {
        orders: recentOrders.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          amountTotal: o.amountTotal.toFixed(3),
          createdAt: o.createdAt.toISOString(),
        })),
        invoices: recentInvoiceRows.map((i) => ({
          id: i.id,
          number: i.number,
          status: i.status,
          amountTotal: i.amountTotal.toFixed(3),
          issuedAt: i.issuedAt ? i.issuedAt.toISOString() : null,
          createdAt: i.createdAt.toISOString(),
        })),
        payments: recentPaymentRows.map((p) => ({
          id: p.id,
          number: p.number,
          status: p.status,
          amount: p.amount.toFixed(3),
          paymentDate: p.paymentDate
            ? p.paymentDate.toISOString().slice(0, 10)
            : null,
          createdAt: p.createdAt.toISOString(),
        })),
        deliveries: recentDeliveryRows.map((d) => ({
          id: d.id,
          number: d.number,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
        })),
      },
    };
  }

  async timeline(
    companyId: string,
    customerId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<CustomerTimelineDto> {
    await this.customers.get(companyId, customerId);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);

    const [orders, invoices, payments, deliveries, claims] = await Promise.all([
      this.prisma.salOrder.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          createdAt: true,
        },
      }),
      this.prisma.finInvoice.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          status: true,
          amountTotal: true,
          createdAt: true,
          issuedAt: true,
        },
      }),
      this.prisma.finPayment.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          status: true,
          amount: true,
          createdAt: true,
          paymentDate: true,
        },
      }),
      this.prisma.dlvShipment.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.ptlClaim.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          createdAt: true,
        },
      }),
    ]);

    const items: CustomerTimelineItem[] = [
      ...orders.map((o) => ({
        id: `order:${o.id}`,
        kind: 'order' as const,
        at: o.createdAt.toISOString(),
        title: `Commande ${o.number}`,
        subtitle: null,
        status: o.status,
        href: `/sales/${o.id}`,
        amount: o.amountTotal.toFixed(3),
      })),
      ...invoices.map((i) => ({
        id: `invoice:${i.id}`,
        kind: 'invoice' as const,
        at: (i.issuedAt ?? i.createdAt).toISOString(),
        title: `Facture ${i.number}`,
        subtitle: null,
        status: i.status,
        href: `/finance/invoices/${i.id}`,
        amount: i.amountTotal.toFixed(3),
      })),
      ...payments.map((p) => ({
        id: `payment:${p.id}`,
        kind: 'payment' as const,
        at: p.paymentDate.toISOString(),
        title: `Encaissement ${p.number}`,
        subtitle: null,
        status: p.status,
        href: `/finance/payments/${p.id}`,
        amount: p.amount.toFixed(3),
      })),
      ...deliveries.map((d) => ({
        id: `delivery:${d.id}`,
        kind: 'delivery' as const,
        at: d.createdAt.toISOString(),
        title: `Livraison ${d.number}`,
        subtitle: null,
        status: d.status,
        href: `/delivery?q=${encodeURIComponent(d.number)}`,
        amount: null,
      })),
      ...claims.map((c) => ({
        id: `claim:${c.id}`,
        kind: 'claim' as const,
        at: c.createdAt.toISOString(),
        title: c.subject?.trim() || `Réclamation ${c.type}`,
        subtitle: c.type,
        status: c.status,
        href: `/portal/claims/${c.id}`,
        amount: null,
      })),
    ];

    items.sort((a, b) => {
      const t = b.at.localeCompare(a.at);
      return t !== 0 ? t : b.id.localeCompare(a.id);
    });

    let filtered = items;
    if (opts.cursor) {
      const idx = items.findIndex((i) => i.id === opts.cursor);
      filtered = idx >= 0 ? items.slice(idx + 1) : items;
    }

    const page = filtered.slice(0, limit);
    const nextCursor =
      filtered.length > limit ? page[page.length - 1]?.id ?? null : null;

    return { items: page, nextCursor };
  }

  /** D244 — lazy documents tab (company-scoped by denormalized customerId). */
  async documents(
    companyId: string,
    customerId: string,
    opts: { limit?: number; cursor?: string } = {},
  ): Promise<CustomerDocumentsDto> {
    await this.customers.get(companyId, customerId);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);
    const rows = await this.prisma.docDocument.findMany({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        number: true,
        title: true,
        mime: true,
        size: true,
        visibility: true,
        linkType: true,
        linkId: true,
        createdAt: true,
      },
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? page[page.length - 1]?.id ?? null : null;
    return {
      items: page.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        mime: r.mime,
        size: r.size.toString(),
        visibility: r.visibility,
        linkType: r.linkType,
        linkId: r.linkId,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  /** D244 — lazy communication tab (contacts + dunning + portal declarations). */
  async communications(
    companyId: string,
    customerId: string,
    opts: { limit?: number } = {},
  ): Promise<CustomerCommunicationsDto> {
    const customer = await this.customers.get(companyId, customerId);
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);

    const [contacts, dunning, declarations] = await Promise.all([
      this.prisma.cusContact.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.finDunningDraft.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      }),
      this.prisma.ptlPaymentDeclaration.findMany({
        where: { companyId, customerId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      }),
    ]);

    return {
      channels: {
        salubritaEmail: customer.salubritaEmail,
        salubritaWhatsapp: customer.salubritaWhatsapp,
        salubritaPortal: customer.salubritaPortal,
        contactsWithEmail: contacts.filter((c) => !!c.email?.trim()).length,
        contactsWithWhatsapp: contacts.filter((c) => !!c.whatsapp?.trim())
          .length,
      },
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email,
        phone: c.phone,
        whatsapp: c.whatsapp,
        isPrimary: c.isPrimary,
        receiveInvoices: c.receiveInvoices,
        receiveDeliveryNotes: c.receiveDeliveryNotes,
        receiveDunning: c.receiveDunning,
        portalAccess: c.portalAccess,
        active: c.active,
      })),
      dunning: dunning.map((d) => ({
        id: d.id,
        number: d.number,
        channel: d.channel,
        status: d.status,
        sendStatus: d.sendStatus,
        recipient: d.recipient,
        subject: d.subject,
        amountOpen: d.amountOpen.toFixed(3),
        currency: d.currency,
        milestoneDay: d.milestoneDay,
        createdAt: d.createdAt.toISOString(),
        sentAt: d.sentAt ? d.sentAt.toISOString() : null,
        href: `/finance?customerId=${encodeURIComponent(customerId)}`,
      })),
      paymentDeclarations: declarations.map((p) => ({
        id: p.id,
        number: p.number,
        status: p.status,
        amount: p.amount.toFixed(3),
        currency: p.currency,
        method: p.method,
        paymentDate: p.paymentDate.toISOString().slice(0, 10),
        createdAt: p.createdAt.toISOString(),
        href: `/finance/payment-declarations/${p.id}`,
      })),
    };
  }

  private buildActions(
    customer: CustomerDto,
    finance: Awaited<ReturnType<FinanceService['customerFinancialOverview']>>,
    extra: {
      draftOrders: number;
      openDeliveries: number;
      portalMembers: number;
    },
  ): CustomerActionRequired[] {
    const actions: CustomerActionRequired[] = [];
    if (customer.blocked) {
      actions.push({
        id: 'blocked',
        severity: 'critical',
        code: 'CUSTOMER_BLOCKED',
        label: 'Client bloqué — confirmation commande refusée',
      });
    }
    if (finance.overdueCount > 0) {
      actions.push({
        id: 'overdue',
        severity: 'high',
        code: 'AR_OVERDUE',
        label: `${finance.overdueCount} créance(s) échue(s)`,
        href: `/finance?customerId=${customer.id}`,
      });
    }
    if (
      finance.creditPressure.level === 'breach' ||
      finance.creditPressure.level === 'warn'
    ) {
      actions.push({
        id: 'credit-pressure',
        severity:
          finance.creditPressure.level === 'breach' ? 'critical' : 'high',
        code: 'CREDIT_PRESSURE',
        label: `Pression crédit ${finance.creditPressure.level}`,
        href: `/finance?customerId=${customer.id}`,
      });
    }
    if (extra.draftOrders > 0) {
      actions.push({
        id: 'draft-orders',
        severity: 'medium',
        code: 'DRAFT_ORDERS',
        label: `${extra.draftOrders} commande(s) brouillon`,
        href: `/sales?customerId=${customer.id}`,
      });
    }
    if (extra.openDeliveries > 0) {
      actions.push({
        id: 'open-deliveries',
        severity: 'medium',
        code: 'OPEN_DELIVERIES',
        label: `${extra.openDeliveries} livraison(s) en cours`,
        href: `/delivery`,
      });
    }
    if (
      customer.salubritaPortal &&
      extra.portalMembers === 0
    ) {
      actions.push({
        id: 'no-portal',
        severity: 'low',
        code: 'NO_PORTAL_USER',
        label: 'Portail activé sans utilisateur lié',
      });
    }
    if ((customer.contacts?.length ?? 0) === 0) {
      actions.push({
        id: 'no-contact',
        severity: 'low',
        code: 'NO_CONTACT',
        label: 'Aucun contact renseigné',
      });
    }
    return actions;
  }
}
