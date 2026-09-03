import { randomUUID } from 'node:crypto';

export type ThunderContextSource =
  'http' | 'job' | 'event' | 'scheduler' | 'system';

export interface ThunderContext {
  /**
   * @deprecated Use `companyId`. Pack docs say "tenantId" — same value as OrgCompany id.
   * Kept as alias for transitional pack compatibility (C09 LOCKED).
   */
  tenantId?: string;
  /** Commercial tenant boundary — OrgCompany id (C09 LOCKED). */
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
  const companyId = partial.companyId ?? partial.tenantId;
  return {
    correlationId: partial.correlationId ?? randomUUID(),
    requestId: partial.requestId ?? randomUUID(),
    occurredAt: partial.occurredAt ?? now,
    ...partial,
    companyId,
    // Alias only — never a second identity
    tenantId: companyId,
  };
}
