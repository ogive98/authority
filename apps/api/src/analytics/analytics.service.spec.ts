import { AnalyticsService } from './analytics.service';

describe('AnalyticsService (D293)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  it('returns null slices when modules are OFF', async () => {
    const modules = {
      isEnabled: jest.fn().mockResolvedValue(false),
    };
    const prisma = {};
    const service = new AnalyticsService(prisma as never, modules as never);
    const summary = await service.summary(companyId);
    expect(summary.sales).toBeNull();
    expect(summary.finance).toBeNull();
    expect(summary.inventory).toBeNull();
    expect(summary.delivery).toBeNull();
    expect(summary.currency).toBe('TND');
    expect(summary.note).toContain('Live aggregates');
  });

  it('aggregates sales when module ON', async () => {
    const modules = {
      isEnabled: jest.fn(async (_c: string, key: string) => key === 'sales'),
    };
    const prisma = {
      salOrder: {
        count: jest
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(5),
      },
    };
    const service = new AnalyticsService(prisma as never, modules as never);
    const summary = await service.summary(companyId);
    expect(summary.modules.sales).toBe(true);
    expect(summary.sales).toEqual({ draftCount: 2, confirmedCount: 5 });
    expect(summary.finance).toBeNull();
  });
});
