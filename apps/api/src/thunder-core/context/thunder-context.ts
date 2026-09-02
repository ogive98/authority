import { randomUUID } from 'node:crypto';

export type ThunderContextSource =
  'http' | 'job' | 'event' | 'scheduler' | 'system';

export interface ThunderContext {
  tenantId?: string;
  companyId?: string;
  siteId?: string;
  userId?: string;
  sessionId?: string;
  correlationId: string;
  causationId?: string;
  requestId: string;
  idempotencyKey?: string;
  source: ThunderContextSource;
  locale?: string;
  timezone?: string;
  occurredAt: string;
}

export function createThunderContext(
  partial: Partial<ThunderContext> & Pick<ThunderContext, 'source'>,
): ThunderContext {
  const now = new Date().toISOString();
  return {
    correlationId: partial.correlationId ?? randomUUID(),
    requestId: partial.requestId ?? randomUUID(),
    occurredAt: partial.occurredAt ?? now,
    ...partial,
  };
}
