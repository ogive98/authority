import type { CoreOutbox } from '@prisma/client';
import type { AuthorityEventEnvelope } from './event-envelope';

export function buildEventEnvelope(row: CoreOutbox): AuthorityEventEnvelope {
  const payload =
    row.payloadJson && typeof row.payloadJson === 'object'
      ? (row.payloadJson as Record<string, unknown>)
      : {};
  const headers =
    row.headers && typeof row.headers === 'object'
      ? (row.headers as Record<string, unknown>)
      : {};

  const nestedPayload =
    payload.payload && typeof payload.payload === 'object'
      ? (payload.payload as Record<string, unknown>)
      : payload;

  const correlationRaw =
    headers.correlationId ?? payload.correlationId ?? row.id;
  const correlationId =
    typeof correlationRaw === 'string' ? correlationRaw : row.id;

  return {
    eventId: row.id,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    occurredAt: row.createdAt.toISOString(),
    source:
      typeof payload.source === 'string' ? payload.source : row.aggregateType,
    companyId: row.companyId ?? undefined,
    siteId: typeof payload.siteId === 'string' ? payload.siteId : undefined,
    actorId: typeof payload.actorId === 'string' ? payload.actorId : undefined,
    correlationId,
    causationId:
      typeof headers.causationId === 'string'
        ? headers.causationId
        : typeof payload.causationId === 'string'
          ? payload.causationId
          : undefined,
    idempotencyKey:
      typeof payload.idempotencyKey === 'string'
        ? payload.idempotencyKey
        : undefined,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload: nestedPayload,
    payloadRef:
      typeof payload.payloadRef === 'string' ? payload.payloadRef : null,
  };
}

export function parseEventEnvelopeFromStreamFields(
  fields: string[],
): AuthorityEventEnvelope {
  const dataIndex = fields.indexOf('data');
  if (dataIndex === -1 || dataIndex + 1 >= fields.length) {
    throw new Error('Event stream message missing data field');
  }

  const raw = fields[dataIndex + 1];
  return JSON.parse(raw) as AuthorityEventEnvelope;
}
