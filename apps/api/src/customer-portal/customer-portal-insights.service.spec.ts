import { CustomerPortalInsightsService } from './customer-portal-insights.service';

describe('CustomerPortalInsightsService', () => {
  const companyId = 'co-1';
  const customerId = 'cu-1';

  const prisma = {
    finOpenItem: { count: jest.fn() },
    salOrder: { count: jest.fn(), findFirst: jest.fn() },
    dlvShipment: { count: jest.fn() },
  };
  const finance = {
    creditSnapshot: jest.fn(),
  };
  const claims = {
    countOpen: jest.fn(),
  };

  let service: CustomerPortalInsightsService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PORTAL_REORDER_DAYS;
    service = new CustomerPortalInsightsService(
      prisma as never,
      finance as never,
      claims as never,
    );
  });

  it('emits credit pressure warn at 80%+ of limit', async () => {
    finance.creditSnapshot.mockResolvedValue({
      creditLimit: '100.000',
      outstandingBalance: '85.000',
      currency: 'TND',
    });
    prisma.finOpenItem.count.mockResolvedValue(0);
    prisma.salOrder.count.mockResolvedValue(1);
    prisma.salOrder.findFirst.mockResolvedValue(null);
    claims.countOpen.mockResolvedValue(0);
    prisma.dlvShipment.count.mockResolvedValue(0);

    const insights = await service.listInsights(companyId, customerId);
    expect(insights.some((i) => i.type === 'CREDIT_PRESSURE')).toBe(true);
    expect(insights.find((i) => i.type === 'CREDIT_PRESSURE')?.severity).toBe(
      'warn',
    );
  });

  it('suggests reorder when last confirm is old and no open orders', async () => {
    finance.creditSnapshot.mockResolvedValue({
      creditLimit: null,
      outstandingBalance: '0.000',
      currency: 'TND',
    });
    prisma.finOpenItem.count.mockResolvedValue(0);
    prisma.salOrder.count.mockResolvedValue(0);
    prisma.salOrder.findFirst.mockResolvedValue({
      id: 'ord-1',
      number: 'SO-1',
      confirmedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    });
    claims.countOpen.mockResolvedValue(0);
    prisma.dlvShipment.count.mockResolvedValue(0);

    const insights = await service.listInsights(companyId, customerId);
    const reorder = insights.find((i) => i.type === 'REORDER_DUE');
    expect(reorder).toBeDefined();
    expect(reorder?.href).toContain('/portal/orders/ord-1');
  });

  it('sorts critical before warn before info', async () => {
    finance.creditSnapshot.mockResolvedValue({
      creditLimit: '50.000',
      outstandingBalance: '60.000',
      currency: 'TND',
    });
    prisma.finOpenItem.count.mockResolvedValue(2);
    prisma.salOrder.count.mockResolvedValue(0);
    prisma.salOrder.findFirst.mockResolvedValue({
      id: 'ord-1',
      number: 'SO-1',
      confirmedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    claims.countOpen.mockResolvedValue(1);
    prisma.dlvShipment.count.mockResolvedValue(0);

    const insights = await service.listInsights(companyId, customerId);
    expect(insights[0]?.severity).toBe('critical');
    expect(insights.map((i) => i.severity)).toEqual(
      [...insights.map((i) => i.severity)].sort((a, b) => {
        const rank = { critical: 0, warn: 1, info: 2 } as const;
        return rank[a] - rank[b];
      }),
    );
  });
});
