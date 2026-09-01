import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { OutboxService } from './outbox.service';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from './audit.constants';

describe('Audit + outbox same transaction', () => {
  it('writes aud_event and core_outbox through the same tx client', async () => {
    const tx = {
      audEvent: { create: jest.fn().mockResolvedValue({ id: 'aud-1' }) },
      coreOutbox: { create: jest.fn().mockResolvedValue({ id: 'ob-1' }) },
    };
    const audit = new AuditService({} as never);
    const outbox = new OutboxService({} as never);

    await audit.append(tx as unknown as Prisma.TransactionClient, {
      actorUserId: 'user-1',
      action: AUDIT_ACTIONS.identityUserUpdate,
      entityType: AUDIT_ENTITY_TYPES.iamUser,
      entityId: 'user-1',
      beforeJson: { displayName: 'A' },
      afterJson: { displayName: 'B' },
    });
    await outbox.enqueue(tx as unknown as Prisma.TransactionClient, {
      aggregateType: AUDIT_ENTITY_TYPES.iamUser,
      aggregateId: 'user-1',
      eventType: OUTBOX_EVENT_TYPES.identityUserUpdated,
      payloadJson: { displayName: 'B' },
    });

    expect(tx.audEvent.create).toHaveBeenCalled();
    expect(tx.coreOutbox.create).toHaveBeenCalled();
  });
});

describe('OutboxService.publishDue', () => {
  it('marks unpublished rows as published (worker stub)', async () => {
    const prisma = {
      coreOutbox: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ob-1' }]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const outbox = new OutboxService(prisma as never);
    const count = await outbox.publishDue();
    expect(count).toBe(1);
    expect(prisma.coreOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ob-1' } }),
    );
  });
});
