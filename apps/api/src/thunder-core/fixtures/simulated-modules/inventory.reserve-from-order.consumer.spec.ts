import { createInventoryReserveFromOrderConsumer } from './inventory.reserve-from-order.consumer';
import { SIMULATED_MODULE_EVENTS } from './constants';
import type { AuthorityEventEnvelope } from '../../events/event-envelope';

describe('createInventoryReserveFromOrderConsumer', () => {
  const envelope: AuthorityEventEnvelope = {
    eventId: 'event-1',
    eventType: SIMULATED_MODULE_EVENTS.salesOrderConfirmed,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: 'sales',
    companyId: 'company-1',
    correlationId: 'corr-1',
    aggregateType: 'sales_order',
    aggregateId: 'order-1',
    payload: {
      lines: [{ sku: 'CHEESE-001', qty: 2 }],
    },
  };

  it('enqueues an inventory reserve job for a sales order event', async () => {
    const enqueue = jest.fn().mockResolvedValue({
      jobId: 'job-1',
      status: 'PENDING',
      replayed: false,
    });
    const consumer = createInventoryReserveFromOrderConsumer({
      enqueue: { enqueue },
    });

    await consumer(envelope);

    expect(enqueue).toHaveBeenCalledWith({
      jobType: 'inventory.reserve.v1',
      companyId: 'company-1',
      queue: 'ops',
      priority: 2,
      idempotencyKey: 'inventory.reserve.event-1',
      payload: {
        orderId: 'order-1',
        lines: [{ sku: 'CHEESE-001', qty: 2 }],
      },
      correlationId: 'corr-1',
    });
  });

  it('ignores unrelated event types', async () => {
    const enqueue = jest.fn();
    const consumer = createInventoryReserveFromOrderConsumer({
      enqueue: { enqueue },
    });

    await consumer({
      ...envelope,
      eventType: 'inventory.stock.reserved.v1',
    });

    expect(enqueue).not.toHaveBeenCalled();
  });
});
