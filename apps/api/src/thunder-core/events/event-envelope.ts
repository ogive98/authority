export interface AuthorityEventEnvelope {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  source: string;
  companyId?: string;
  siteId?: string;
  actorId?: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  payloadRef?: string | null;
}

export type EventConsumerHandler = (
  envelope: AuthorityEventEnvelope,
) => Promise<void>;

export interface RegisteredEventConsumer {
  consumerId: string;
  handler: EventConsumerHandler;
}
