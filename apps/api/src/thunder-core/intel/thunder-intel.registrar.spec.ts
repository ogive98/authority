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
});
