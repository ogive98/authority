import type { AuthorityEventEnvelope } from '../../events/event-envelope';
import { SIMULATED_MODULE_EVENTS } from './constants';
import { simulationLedger } from './simulation-ledger';

export function notificationsStockReservedConsumer(
  envelope: AuthorityEventEnvelope,
): Promise<void> {
  if (envelope.eventType !== SIMULATED_MODULE_EVENTS.inventoryStockReserved) {
    return Promise.resolve();
  }

  const orderId =
    typeof envelope.payload.orderId === 'string'
      ? envelope.payload.orderId
      : envelope.aggregateId;

  simulationLedger.notifications.push({
    orderId,
    channel: 'stub',
    correlationId: envelope.correlationId,
  });

  return Promise.resolve();
}
