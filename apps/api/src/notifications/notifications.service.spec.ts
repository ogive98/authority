import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const companyId = 'company-demo';

  function build(
    prisma: Record<string, unknown>,
    expertise?: { getSlot: jest.Mock },
  ) {
    return new NotificationsService(
      prisma as never,
      (expertise ?? {
        getSlot: jest
          .fn()
          .mockResolvedValueOnce({
            key: 'tax.ras',
            status: 'PENDING_EXPERT',
          })
          .mockResolvedValueOnce({
            key: 'tax.tej',
            status: 'VALIDATED',
            valueSummary: 'ok',
          }),
      }) as never,
    );
  }

  it('lists empty inbox without inventing alerts', async () => {
    const prisma = {
      coreInAppNotification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const svc = build(prisma);
    const res = await svc.list(companyId);
    expect(res.items).toEqual([]);
    expect(res.unreadCount).toBe(0);
  });

  it('sync upserts portal declaration + RAS pending once', async () => {
    const created: unknown[] = [];
    const prisma = {
      ptlPaymentDeclaration: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'decl-1',
            number: 'PD-001',
            amount: 100,
            currency: 'TND',
            customerId: 'cus-1',
            createdAt: new Date(),
          },
        ]),
      },
      finPromiseToPay: { findMany: jest.fn().mockResolvedValue([]) },
      finDunningDraft: { findMany: jest.fn().mockResolvedValue([]) },
      thuSignal: { findMany: jest.fn().mockResolvedValue([]) },
      atmRunLog: { findMany: jest.fn().mockResolvedValue([]) },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cus-1',
            code: 'C-001',
            party: { displayName: 'Fromagerie Demo' },
          },
        ]),
      },
      coreInAppNotification: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => {
          created.push(data);
          return Promise.resolve({
            id: `id-${created.length}`,
            companyId,
            ...data,
            readAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: null,
          });
        }),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const svc = build(prisma);
    const res = await svc.sync(companyId);
    expect(res.upserted).toBe(2);
    expect(res.reconciled).toBe(0);
    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: 'ptl_decl:decl-1',
          source: 'PORTAL_PAYMENT_DECL',
          body: expect.stringContaining('C-001'),
        }),
        expect.objectContaining({
          dedupeKey: `ras_pending:${companyId}`,
          source: 'RAS_PENDING',
        }),
      ]),
    );
  });

  it('sync reconciles stale unread when source cleared (D248)', async () => {
    const prisma = {
      ptlPaymentDeclaration: { findMany: jest.fn().mockResolvedValue([]) },
      finPromiseToPay: { findMany: jest.fn().mockResolvedValue([]) },
      finDunningDraft: { findMany: jest.fn().mockResolvedValue([]) },
      thuSignal: { findMany: jest.fn().mockResolvedValue([]) },
      atmRunLog: { findMany: jest.fn().mockResolvedValue([]) },
      cusCustomer: { findMany: jest.fn().mockResolvedValue([]) },
      coreInAppNotification: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 'stale-1', dedupeKey: 'ptl_decl:gone' },
            { id: 'keep-ras', dedupeKey: `ras_pending:${companyId}` },
          ])
          .mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const svc = build(prisma, {
      getSlot: jest
        .fn()
        .mockResolvedValueOnce({
          key: 'tax.ras',
          status: 'PENDING_EXPERT',
        })
        .mockResolvedValueOnce({
          key: 'tax.tej',
          status: 'VALIDATED',
          valueSummary: 'ok',
        }),
    });
    const res = await svc.sync(companyId);
    expect(res.reconciled).toBe(1);
    expect(prisma.coreInAppNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['stale-1'] },
        }),
      }),
    );
  });

  it('markRead sets readAt', async () => {
    const prisma = {
      coreInAppNotification: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'n1',
          companyId,
          source: 'RAS_PENDING',
          sourceRefId: null,
          type: 'system',
          priority: 'p3',
          title: 'RAS',
          body: 'pending',
          href: '/settings#expertise',
          readAt: null,
          createdAt: new Date('2026-09-14T10:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'n1',
          companyId,
          source: 'RAS_PENDING',
          sourceRefId: null,
          type: 'system',
          priority: 'p3',
          title: 'RAS',
          body: 'pending',
          href: '/settings#expertise',
          readAt: new Date('2026-09-14T11:00:00.000Z'),
          createdAt: new Date('2026-09-14T10:00:00.000Z'),
        }),
      },
    };
    const svc = build(prisma);
    const item = await svc.markRead(companyId, 'n1');
    expect(item?.read).toBe(true);
  });
});
