import { HttpStatus, Injectable } from '@nestjs/common';
import { PrdProductStatus, SalOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesException } from '../sales/sales.exception';
import { SalesService, type SalesOrderDto } from '../sales/sales.service';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import type {
  PortalCreateOrderDto,
  PortalReorderDto,
} from './customer-portal.dto';
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

export type PortalCatalogItemDto = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  /** Last unit price for this customer+product, or null if never ordered. */
  lastUnitPrice: string | null;
  currency: string;
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
    const order = await this.getOwnedSalesOrder(companyId, customerId, id);
    return this.toPortalOrder(order);
  }

  async createOrder(
    companyId: string,
    customerId: string,
    dto: PortalCreateOrderDto,
  ): Promise<PortalOrderDto> {
    const warehouseId = await this.resolveDefaultWarehouseId(companyId);
    const lines = [];
    for (const line of dto.lines) {
      const unitPrice = await this.resolveLastUnitPrice(
        companyId,
        customerId,
        line.productId,
      );
      if (unitPrice == null) {
        throw new CustomerPortalException(
          CUSTOMER_PORTAL_ERROR_CODES.PRICE_UNAVAILABLE,
          'No prior price for this product — ask your ADV or reorder an existing order.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      lines.push({
        productId: line.productId,
        qty: line.qty,
        unitPrice,
      });
    }

    const created = await this.salesService.create(companyId, {
      customerId,
      warehouseId,
      requestedDate: dto.requestedDate,
      preferredDriver: dto.preferredDriver,
      lines,
      confirmAfter: false,
    });

    return this.toPortalOrder(created);
  }

  async reorderOrder(
    companyId: string,
    customerId: string,
    sourceOrderId: string,
    dto: PortalReorderDto = {},
  ): Promise<PortalOrderDto> {
    const source = await this.getOwnedSalesOrder(
      companyId,
      customerId,
      sourceOrderId,
    );

    if (source.lines.length === 0) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
        'Source order has no lines to reorder.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const created = await this.salesService.create(companyId, {
      customerId,
      warehouseId: source.warehouseId,
      requestedDate: dto.requestedDate,
      preferredDriver: source.preferredDriver ?? undefined,
      currency: source.currency,
      lines: source.lines.map((l) => ({
        productId: l.productId,
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice),
        discountPct: Number(l.discountPct),
      })),
      confirmAfter: false,
    });

    return this.toPortalOrder(created);
  }

  async listCatalog(
    companyId: string,
    customerId: string,
    opts: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: PortalCatalogItemDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where = {
      companyId,
      deletedAt: null,
      status: PrdProductStatus.ACTIVE,
      ...(opts.q?.trim()
        ? {
            OR: [
              { sku: { contains: opts.q.trim(), mode: 'insensitive' as const } },
              {
                name: { contains: opts.q.trim(), mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.prdProduct.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    const productIds = page.map((p) => p.id);
    const priceByProduct = await this.lastUnitPricesByProduct(
      companyId,
      customerId,
      productIds,
    );

    const currency = await this.defaultCurrency(companyId);

    return {
      items: page.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        uom: p.uom,
        lastUnitPrice:
          priceByProduct.get(p.id) != null
            ? priceByProduct.get(p.id)!.toFixed(3)
            : null,
        currency,
      })),
      nextCursor,
    };
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
      message: 'Portal P3 — order create / reorder',
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

  private async getOwnedSalesOrder(
    companyId: string,
    customerId: string,
    id: string,
  ): Promise<SalesOrderDto> {
    let order: SalesOrderDto;
    try {
      order = await this.salesService.get(companyId, id);
    } catch (err) {
      if (
        err instanceof SalesException &&
        err.getStatus() === HttpStatus.NOT_FOUND
      ) {
        throw this.notFound();
      }
      throw err;
    }

    if (order.customerId !== customerId) {
      throw this.notFound();
    }

    return order;
  }

  private async resolveDefaultWarehouseId(companyId: string): Promise<string> {
    const warehouse = await this.prisma.invWarehouse.findFirst({
      where: { companyId, active: true, deletedAt: null },
      orderBy: [{ code: 'asc' }],
    });
    if (!warehouse) {
      throw new CustomerPortalException(
        CUSTOMER_PORTAL_ERROR_CODES.WAREHOUSE_UNAVAILABLE,
        'No active warehouse available for orders.',
        HttpStatus.CONFLICT,
      );
    }
    return warehouse.id;
  }

  private async resolveLastUnitPrice(
    companyId: string,
    customerId: string,
    productId: string,
  ): Promise<number | null> {
    const map = await this.lastUnitPricesByProduct(companyId, customerId, [
      productId,
    ]);
    return map.get(productId) ?? null;
  }

  private async lastUnitPricesByProduct(
    companyId: string,
    customerId: string,
    productIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (productIds.length === 0) return result;

    const lines = await this.prisma.salOrderLine.findMany({
      where: {
        companyId,
        productId: { in: productIds },
        order: {
          companyId,
          customerId,
          deletedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['productId'],
      select: { productId: true, unitPrice: true },
    });

    for (const line of lines) {
      result.set(line.productId, Number(line.unitPrice));
    }
    return result;
  }

  private async defaultCurrency(companyId: string): Promise<string> {
    const settings = await this.salesService.getIntakeSettings(companyId);
    return settings.defaultCurrency || 'TND';
  }

  private notFound(): CustomerPortalException {
    return new CustomerPortalException(
      CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      'Order not found.',
      HttpStatus.NOT_FOUND,
    );
  }
}
