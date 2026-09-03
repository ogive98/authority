import type { AuthorityEventEnvelope } from '../../events/event-envelope';
import type { JobEnqueueService } from '../../jobs/job-enqueue.service';
import { SIMULATED_MODULE_EVENTS, SIMULATED_MODULE_JOBS } from './constants';

export function createInventoryReserveFromOrderConsumer(deps: {
  enqueue: Pick<JobEnqueueService, 'enqueue'>;
}) {
  return async (envelope: AuthorityEventEnvelope): Promise<void> => {
    if (envelope.eventType !== SIMULATED_MODULE_EVENTS.salesOrderConfirmed) {
      return;
    }

    if (!envelope.companyId) {
      throw new Error(
        'inventory.reserveFromOrder requires companyId on envelope',
      );
    }

    const lines = Array.isArray(envelope.payload.lines)
      ? (envelope.payload.lines as Array<Record<string, unknown>>)
      : [];

    await deps.enqueue.enqueue({
      jobType: SIMULATED_MODULE_JOBS.inventoryReserve,
      companyId: envelope.companyId,
      queue: 'ops',
      priority: 2,
      idempotencyKey: `inventory.reserve.${envelope.eventId}`,
      payload: {
        orderId: envelope.aggregateId,
        lines,
      },
      correlationId: envelope.correlationId,
    });
  };
}
