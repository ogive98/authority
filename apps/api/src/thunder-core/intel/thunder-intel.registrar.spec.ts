import { ThunderIntelRegistrar } from './thunder-intel.registrar';
import {
  THUNDER_INTEL_CONSUMER_ID,
  THUNDER_INTEL_EVENT_TYPES,
  THUNDER_SIGNAL_TYPES,
} from './intel.constants';

describe('ThunderIntelRegistrar', () => {
  const registry = {
    register: jest.fn(),
  };
  const signals = {
    create: jest.fn(),
  };
  const recommendations = {
    create: jest.fn(),
  };
  const collectionSchedule = {
    resolveRemindDays: jest.fn().mockResolvedValue([1, 7, 15, 30]),
  };
  const creditPressure = {
    evaluate: jest.fn().mockResolvedValue({
      level: null,
      ratio: null,
      warnRatio: 0.8,
      outstanding: 0,
      creditLimit: null,
    }),
  };
  const modules = {
    isEnabled: jest.fn().mockResolvedValue(false),
  };

  let registrar: ThunderIntelRegistrar;

  beforeEach(() => {
    jest.clearAllMocks();
    registrar = new ThunderIntelRegistrar(
      registry as never,
      signals as never,
      recommendations as never,
      {
        finOpenItem: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as never,
      collectionSchedule as never,
      creditPressure as never,
      modules as never,
    );
  });

  it('registers thunder.intel consumer', () => {
    registrar.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(
      THUNDER_INTEL_CONSUMER_ID,
      expect.any(Function),
      expect.objectContaining({
        consumes: expect.arrayContaining([
          THUNDER_INTEL_EVENT_TYPES.deliveryFailed,
          THUNDER_INTEL_EVENT_TYPES.financeOpenItemCreated,
        ]),
      }),
    );
  });

  it('emits FinanceCollectionMilestone when days past due hit schedule', async () => {
    const today = new Date();
    const due = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 10,
      ),
    );
    const prisma = {
      finOpenItem: {
        findMany: jest.fn().mockResolvedValue([
          { dueDate: due, amountOpen: 100 },
        ]),
      },
    };
    collectionSchedule.resolveRemindDays.mockResolvedValue([1, 7, 15, 30]);
    registrar = new ThunderIntelRegistrar(
      registry as never,
      signals as never,
      recommendations as never,
      prisma as never,
      collectionSchedule as never,
      creditPressure as never,
      modules as never,
    );
    signals.create.mockResolvedValue({ id: 'sig-1' });
    recommendations.create.mockResolvedValue({ id: 'rec-1' });

    await registrar.handle({
      eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventType: THUNDER_INTEL_EVENT_TYPES.financeOpenItemCreated,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId: '11111111-1111-1111-1111-111111111111',
      correlationId: null,
      aggregateType: 'fin_open_item',
      aggregateId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      payload: { customerId: '22222222-2222-2222-2222-222222222222' },
    });

    expect(signals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: THUNDER_SIGNAL_TYPES.FinanceCollectionMilestone,
        evidence: expect.objectContaining({
          maxDaysPastDue: 10,
          milestonesMatched: [1, 7],
          highestMilestone: 7,
        }),
      }),
    );
    expect(recommendations.create).toHaveBeenCalled();
  });

  it('skips milestone signal when overdue but below first remind day', async () => {
    const today = new Date();
    const due = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 3,
      ),
    );
    const prisma = {
      finOpenItem: {
        findMany: jest.fn().mockResolvedValue([
          { dueDate: due, amountOpen: 50 },
        ]),
      },
    };
    collectionSchedule.resolveRemindDays.mockResolvedValue([7, 15, 30]);
    registrar = new ThunderIntelRegistrar(
      registry as never,
      signals as never,
      recommendations as never,
      prisma as never,
      collectionSchedule as never,
      creditPressure as never,
      modules as never,
    );

    await registrar.handle({
      eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventType: THUNDER_INTEL_EVENT_TYPES.financeOpenItemCreated,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId: '11111111-1111-1111-1111-111111111111',
      correlationId: null,
      aggregateType: 'fin_open_item',
      aggregateId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      payload: { customerId: '22222222-2222-2222-2222-222222222222' },
    });

    expect(signals.create).not.toHaveBeenCalled();
  });

  it('emits FinanceCreditPressure on breach', async () => {
    creditPressure.evaluate.mockResolvedValue({
      level: 'breach',
      ratio: 1.2,
      warnRatio: 0.8,
      outstanding: 1200,
      creditLimit: 1000,
    });
    signals.create.mockResolvedValue({ id: 'sig-cp' });
    recommendations.create.mockResolvedValue({ id: 'rec-cp' });

    await registrar.handle({
      eventId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      eventType: THUNDER_INTEL_EVENT_TYPES.financeOpenItemCreated,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId: '11111111-1111-1111-1111-111111111111',
      correlationId: null,
      aggregateType: 'fin_open_item',
      aggregateId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      payload: { customerId: '22222222-2222-2222-2222-222222222222' },
    });

    expect(signals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: THUNDER_SIGNAL_TYPES.FinanceCreditPressure,
        severity: 'CRITICAL',
        evidence: expect.objectContaining({
          level: 'breach',
          ratio: 1.2,
        }),
      }),
    );
  });

  it('suggests ProductionNeed when production module ON (D290)', async () => {
    modules.isEnabled.mockResolvedValue(true);
    signals.create
      .mockResolvedValueOnce({ id: 'sig-sales' })
      .mockResolvedValueOnce({ id: 'sig-prod' });
    recommendations.create.mockResolvedValue({ id: 'rec-prod' });

    await registrar.handle({
      eventId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      eventType: THUNDER_INTEL_EVENT_TYPES.salesConfirmed,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'sales',
      companyId: '11111111-1111-1111-1111-111111111111',
      siteId: null,
      correlationId: null,
      aggregateType: 'sales_order',
      aggregateId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      payload: { orderId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', orderNumber: 'SO-9' },
    });

    expect(modules.isEnabled).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'production',
    );
    expect(signals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: THUNDER_SIGNAL_TYPES.ProductionNeedSuggested,
        evidence: expect.objectContaining({
          orderNumber: 'SO-9',
        }),
      }),
    );
    expect(recommendations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        problem: expect.stringContaining('SO-9'),
        autonomyLevel: 2,
      }),
    );
  });

  it('skips ProductionNeed when production module OFF (D290)', async () => {
    modules.isEnabled.mockResolvedValue(false);
    signals.create.mockResolvedValue({ id: 'sig-sales' });

    await registrar.handle({
      eventId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      eventType: THUNDER_INTEL_EVENT_TYPES.salesConfirmed,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'sales',
      companyId: '11111111-1111-1111-1111-111111111111',
      siteId: null,
      correlationId: null,
      aggregateType: 'sales_order',
      aggregateId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      payload: { orderNumber: 'SO-OFF' },
    });

    expect(signals.create).toHaveBeenCalledTimes(1);
    expect(signals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: THUNDER_SIGNAL_TYPES.SalesOrderConfirmed,
      }),
    );
    expect(
      signals.create.mock.calls.some(
        (c) => c[0]?.type === THUNDER_SIGNAL_TYPES.ProductionNeedSuggested,
      ),
    ).toBe(false);
  });
});
