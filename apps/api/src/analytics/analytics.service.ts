import { Injectable } from '@nestjs/common';
import {
  DlvShipmentStatus,
  FinOpenItemSide,
  FinOpenItemStatus,
  InvLotStatus,
  SalOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';

export type AnalyticsSummaryDto = {
  asOf: string;
  currency: 'TND';
  modules: {
    sales: boolean;
    finance: boolean;
    inventory: boolean;
    delivery: boolean;
  };
  sales: {
    draftCount: number;
    confirmedCount: number;
  } | null;
  finance: {
    openCount: number;
    overdueCount: number;
    outstandingOpen: string;
  } | null;
  inventory: {
    balanceLines: number;
    positiveAvailableLines: number;
    openLots: number;
  } | null;
  delivery: {
    readyCount: number;
    assignedCount: number;
    outCount: number;
  } | null;
  note: string;
};

/**
 * D293 — live read-only aggregates. No invented CA · no ML · no KPI snapshots table.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: ModuleRegistryService,
  ) {}

  async summary(companyId: string): Promise<AnalyticsSummaryDto> {
    const [salesOn, financeOn, inventoryOn, deliveryOn] = await Promise.all([
      this.modules.isEnabled(companyId, 'sales'),
      this.modules.isEnabled(companyId, 'finance'),
      this.modules.isEnabled(companyId, 'inventory'),
      this.modules.isEnabled(companyId, 'delivery'),
    ]);

    const sales = salesOn ? await this.salesSlice(companyId) : null;
    const finance = financeOn ? await this.financeSlice(companyId) : null;
    const inventory = inventoryOn ? await this.inventorySlice(companyId) : null;
    const delivery = deliveryOn ? await this.deliverySlice(companyId) : null;

    return {
      asOf: new Date().toISOString(),
      currency: 'TND',
      modules: {
        sales: salesOn,
        finance: financeOn,
        inventory: inventoryOn,
        delivery: deliveryOn,
      },
      sales,
      finance,
      inventory,
      delivery,
      note: 'Live aggregates only — no invented KPIs · MC home-kpis remain source for module strips (D293)',
    };
  }

  private async salesSlice(companyId: string) {
    const [draftCount, confirmedCount] = await Promise.all([
      this.prisma.salOrder.count({
        where: {
          companyId,
          deletedAt: null,
          status: SalOrderStatus.DRAFT,
        },
      }),
      this.prisma.salOrder.count({
        where: {
          companyId,
          deletedAt: null,
          status: SalOrderStatus.CONFIRMED,
        },
      }),
    ]);
    return { draftCount, confirmedCount };
  }

  private async financeSlice(companyId: string) {
    const today = new Date();
    const start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const openItems = await this.prisma.finOpenItem.findMany({
      where: {
        companyId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: {
          in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
        },
      },
      select: { amountOpen: true, dueDate: true },
    });
    let outstanding = 0;
    let overdueCount = 0;
    for (const row of openItems) {
      outstanding += Number(row.amountOpen);
      if (row.dueDate && row.dueDate < start) overdueCount += 1;
    }
    return {
      openCount: openItems.length,
      overdueCount,
      outstandingOpen: outstanding.toFixed(3),
    };
  }

  private async inventorySlice(companyId: string) {
    const [balanceLines, positiveAvailableLines, openLots] = await Promise.all([
      this.prisma.invBalance.count({
        where: { companyId },
      }),
      this.prisma.invBalance.count({
        where: { companyId, onHand: { gt: 0 } },
      }),
      this.prisma.invLot.count({
        where: { companyId, status: InvLotStatus.OPEN },
      }),
    ]);
    return { balanceLines, positiveAvailableLines, openLots };
  }

  private async deliverySlice(companyId: string) {
    const [readyCount, assignedCount, outCount] = await Promise.all([
      this.prisma.dlvShipment.count({
        where: {
          companyId,
          deletedAt: null,
          status: DlvShipmentStatus.READY,
        },
      }),
      this.prisma.dlvShipment.count({
        where: {
          companyId,
          deletedAt: null,
          status: DlvShipmentStatus.ASSIGNED,
        },
      }),
      this.prisma.dlvShipment.count({
        where: {
          companyId,
          deletedAt: null,
          status: DlvShipmentStatus.OUT,
        },
      }),
    ]);
    return { readyCount, assignedCount, outCount };
  }
}
