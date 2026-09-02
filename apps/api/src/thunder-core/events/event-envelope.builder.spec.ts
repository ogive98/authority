import { buildEventEnvelope } from './event-envelope.builder';
import type { CoreOutbox } from '@prisma/client';

describe('buildEventEnvelope', () => {
  it('maps outbox rows into the authority event envelope', () => {
    const row = {
      id: 'event-1',
      companyId: 'company-1',
      aggregateType: 'iam_user',
      aggregateId: 'user-1',
      eventType: 'identity.user.updated.v1',
      eventVersion: 1,
      payloadJson: {
        source: 'identity',
        actorId: 'user-1',
        correlationId: 'corr-1',
        payload: { displayName: 'Demo' },
      },
      headers: null,
      createdAt: new Date('2026-09-02T12:00:00.000Z'),
      publishedAt: null,
      publishAttempts: 0,
    } as CoreOutbox;

    expect(buildEventEnvelope(row)).toEqual({
      eventId: 'event-1',
      eventType: 'identity.user.updated.v1',
      eventVersion: 1,
      occurredAt: '2026-09-02T12:00:00.000Z',
      source: 'identity',
      companyId: 'company-1',
      siteId: undefined,
      actorId: 'user-1',
      correlationId: 'corr-1',
      causationId: undefined,
      idempotencyKey: undefined,
      aggregateType: 'iam_user',
      aggregateId: 'user-1',
      payload: { displayName: 'Demo' },
      payloadRef: null,
    });
  });
});
