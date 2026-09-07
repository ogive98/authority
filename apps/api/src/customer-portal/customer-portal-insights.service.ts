import { Injectable } from '@nestjs/common';
import {
  DlvShipmentStatus,
  FinOpenItemSide,
  FinOpenItemStatus,
  SalOrderStatus,
} from '@prisma/client';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerPortalClaimsService } from './customer-portal-claims.service';

export type PortalInsightSeverity = 'info' | 'warn' | 'critical';

export type PortalInsightType =
  | 'CREDIT_PRESSURE'
  | 'OVERDUE_OPEN_ITEM'
  | 'REORDER_DUE'
  | 'OPEN_CLAIMS'
  | 'DELIVERY_FAILED';

export type PortalInsightDto = {
  id: string;
  type: PortalInsightType;
  severity: PortalInsightSeverity;
  title: string;
  message: string;
  /** Portal-relative path, e.g. /portal/finance */
  href: string;
  evidence: Record<string, unknown>;
};

const DEFAULT_REORDER_DAYS = 14;
const CREDIT_WARN_RATIO = 0.8;

/**
 * Portal P7 — deterministic non-LLM insights (reorder / credit / ops alerts).
 * Membership-scoped only; no inventing TVA/CNSS rates.
 */
@Injectable()
export class CustomerPortalInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly claimsService: CustomerPortalClaimsService,
  ) {}

  async listInsights(
    companyId: string,
    customerId: string,
  ): Promise<PortalInsightDto[]> {
    const reorderDays = readPositiveInt(
      process.env.PORTAL_REORDER_DAYS,
      DEFAULT_REORDER_DAYS,
    );

    const [
      credit,
      overdueCount,
      openOrders,
      lastConfirmed,
      openClaims,
      failedDeliveries,
    ] = await Promise.all([
      this.financeService.creditSnapshot(companyId, customerId),
      this.prisma.finOpenItem.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
          status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
          dueDate: { lt: startOfUtcDay(new Date()) },
        },
      }),
      this.prisma.salOrder.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: { in: [SalOrderStatus.DRAFT, SalOrderStatus.CONFIRMED] },
        },
      }),
      this.prisma.salOrder.findFirst({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: SalOrderStatus.CONFIRMED,
        },
        orderBy: { confirmedAt: 'desc' },
        select: { id: true, number: true, confirmedAt: true },
      }),
      this.claimsService.countOpen(companyId, customerId),
      this.prisma.dlvShipment.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          status: DlvShipmentStatus.FAILED,
          completedAt: { gte: daysAgo(30) },
        },
      }),
    ]);

    const insights: PortalInsightDto[] = [];
    const outstanding = Number(credit.outstandingBalance);
    const limit =
      credit.creditLimit != null ? Number(credit.creditLimit) : null;

    if (limit != null && limit > 0 && outstanding > 0) {
      const ratio = outstanding / limit;
      if (ratio >= 1) {
        insights.push({
          id: 'credit-pressure-critical',
          type: 'CREDIT_PRESSURE',
          severity: 'critical',
          title: 'Crédit dépassé',
          message: `Solde ${outstanding.toFixed(3)} TND ≥ limite ${limit.toFixed(3)} TND.`,
          href: '/portal/finance',
          evidence: {
            outstandingBalance: credit.outstandingBalance,
            creditLimit: credit.creditLimit,
            ratio,
          },
        });
      } else if (ratio >= CREDIT_WARN_RATIO) {
        insights.push({
          id: 'credit-pressure-warn',
          type: 'CREDIT_PRESSURE',
          severity: 'warn',
          title: 'Crédit sous tension',
          message: `Solde à ${(ratio * 100).toFixed(0)} % de la limite (${outstanding.toFixed(3)} / ${limit.toFixed(3)} TND).`,
          href: '/portal/finance',
          evidence: {
            outstandingBalance: credit.outstandingBalance,
            creditLimit: credit.creditLimit,
            ratio,
          },
        });
      }
    }

    if (overdueCount > 0) {
      insights.push({
        id: 'overdue-open-items',
        type: 'OVERDUE_OPEN_ITEM',
        severity: 'warn',
        title: 'Échéances dépassées',
        message: `${overdueCount} créance(s) ouverte(s) avec date d’échéance dépassée.`,
        href: '/portal/finance',
        evidence: { overdueCount },
      });
    }

    if (openOrders === 0 && lastConfirmed?.confirmedAt) {
      const ageMs = Date.now() - lastConfirmed.confirmedAt.getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      if (ageDays >= reorderDays) {
        insights.push({
          id: 'reorder-due',
          type: 'REORDER_DUE',
          severity: 'info',
          title: 'Recommande suggérée',
          message: `Dernière commande confirmée (${lastConfirmed.number}) il y a ${Math.floor(ageDays)} j — aucune commande ouverte.`,
          href: `/portal/orders/${lastConfirmed.id}`,
          evidence: {
            lastOrderId: lastConfirmed.id,
            lastOrderNumber: lastConfirmed.number,
            confirmedAt: lastConfirmed.confirmedAt.toISOString(),
            reorderAfterDays: reorderDays,
          },
        });
      }
    }

    if (openClaims > 0) {
      insights.push({
        id: 'open-claims',
        type: 'OPEN_CLAIMS',
        severity: 'info',
        title: 'Réclamations ouvertes',
        message: `${openClaims} réclamation(s) en cours.`,
        href: '/portal/claims',
        evidence: { openClaims },
      });
    }

    if (failedDeliveries > 0) {
      insights.push({
        id: 'delivery-failed-recent',
        type: 'DELIVERY_FAILED',
        severity: 'warn',
        title: 'Livraisons en échec',
        message: `${failedDeliveries} livraison(s) en échec sur les 30 derniers jours.`,
        href: '/portal/deliveries',
        evidence: { failedDeliveries, windowDays: 30 },
      });
    }

    return sortInsights(insights);
  }
}

function sortInsights(items: PortalInsightDto[]): PortalInsightDto[] {
  const rank: Record<PortalInsightSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };
  return [...items].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id),
  );
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}
