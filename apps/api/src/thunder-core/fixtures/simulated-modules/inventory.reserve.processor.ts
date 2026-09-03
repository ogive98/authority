import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { JobExecutionContext } from '../../jobs/job.types';
import { SIMULATED_MODULE_EVENTS } from './constants';
import { simulationLedger } from './simulation-ledger';

export function createInventoryReserveProcessor(deps: {
  prisma: PrismaService;
}) {
  return async (
    context: JobExecutionContext,
  ): Promise<Prisma.InputJsonValue> => {
    const orderId =
      typeof context.payload.orderId === 'string'
        ? context.payload.orderId
        : 'unknown-order';
    const lines = Array.isArray(context.payload.lines)
      ? (context.payload.lines as Array<Record<string, unknown>>)
      : [];
    const firstLine = lines[0] ?? {};
    const sku =
      typeof firstLine.sku === 'string' ? firstLine.sku : 'CHEESE-001';
    const qty = typeof firstLine.qty === 'number' ? firstLine.qty : 1;

    const existing = simulationLedger.reservations.find(
      (entry) => entry.orderId === orderId,
    );
    if (existing) {
      return {
        reserved: true,
        replayed: true,
        orderId,
        sku: existing.sku,
        qty: existing.qty,
      };
    }

    simulationLedger.reservations.push({
      orderId,
      sku,
      qty,
      correlationId: context.context.correlationId,
    });

    if (context.companyId) {
      await deps.prisma.coreOutbox.create({
        data: {
          companyId: context.companyId,
          aggregateType: 'inventory_reservation',
          aggregateId: orderId,
          eventType: SIMULATED_MODULE_EVENTS.inventoryStockReserved,
          eventVersion: 1,
          payloadJson: {
            source: 'inventory',
            correlationId: context.context.correlationId,
            causationId: context.jobId,
            payload: { orderId, sku, qty },
          },
        },
      });
    }

    return {
      reserved: true,
      replayed: false,
      orderId,
      sku,
      qty,
    };
  };
}
