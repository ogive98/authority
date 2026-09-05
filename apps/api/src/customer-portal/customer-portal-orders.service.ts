import { HttpStatus, Injectable } from '@nestjs/common';
import { SalOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesException } from '../sales/sales.exception';
import { SalesService, type SalesOrderDto } from '../sales/sales.service';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import { CustomerPortalException } from './customer-portal.exception';

export type PortalOrderLineDto = {
  sku: string | null;
  name: string | null;
  qty: string;
  unitPrice: string;
  lineTotal: string;
};

/** External customer-facing order — no warehouse / internal notes. */
export type PortalOrderDto = {
  id: string;
  number: string;
  status: SalOrderStatus;
  requestedDate: string | null;
  currency: string;
  amountTotal: string;
  preferredDriver: string | null;
  confirmedAt: string | null;
  createdAt: string;
  lines: PortalOrderLineDto[];
};

@Injectable()
export class CustomerPortalOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesService: SalesService,
  ) {}

  async listOrders(
    companyId: string,
    customerId: string,
    opts: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: PortalOrderDto[]; nextCursor: string | null }> {
    const result = await this.salesService.list(companyId, {
      ...opts,
      customerId,
    });
    return {
      items: result.items.map((o) => this.toPortalOrder(o)),
      nextCursor: result.nextCursor,
    };
  }

  async getOrder(
    companyId: string,
    customerId: string,
    id: string,
  ): Promise<PortalOrderDto> {
    let order: SalesOrderDto;
    try {
      order = await this.salesService.get(companyId, id);
    } catch (err) {
      if (err instanceof SalesException && err.getStatus() === HttpStatus.NOT_FOUND) {
        throw this.notFound();
      }
      throw err;
    }

    if (order.customerId !== customerId) {
      throw this.notFound();
    }

    return this.toPortalOrder(order);
  }

  async getDashboardShell(companyId: string, customerId: string) {
    const openOrders = await this.prisma.salOrder.count({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        status: { in: [SalOrderStatus.DRAFT, SalOrderStatus.CONFIRMED] },
      },
    });

    return {
      kpis: {
        openOrders,
        pendingDeliveries: 0,
        outstandingBalance: null as number | null,
      },
      sections: ['orders', 'deliveries', 'finance'] as const,
      message: 'Portal P2 — orders read',
    };
  }

  toPortalOrder(order: SalesOrderDto): PortalOrderDto {
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      requestedDate: order.requestedDate,
      currency: order.currency,
      amountTotal: order.amountTotal,
      preferredDriver: order.preferredDriver,
      confirmedAt: order.confirmedAt,
      createdAt: order.createdAt,
      lines: order.lines.map((line) => ({
        sku: line.productSku,
        name: line.productName,
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
    };
  }

  private notFound(): CustomerPortalException {
    return new CustomerPortalException(
      CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      'Order not found.',
      HttpStatus.NOT_FOUND,
    );
  }
}
