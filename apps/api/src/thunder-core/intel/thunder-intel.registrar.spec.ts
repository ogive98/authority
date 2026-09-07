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

  let registrar: ThunderIntelRegistrar;

  beforeEach(() => {
    jest.clearAllMocks();
    registrar = new ThunderIntelRegistrar(
      registry as never,
      signals as never,
      recommendations as never,
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
        ]),
      }),
    );
  });

  it('creates signal + recommendation on delivery failed', async () => {
    signals.create.mockResolvedValue({ id: 'sig-1' });
    recommendations.create.mockResolvedValue({ id: 'rec-1' });

    await registrar.handle({
      eventId: 'evt-1',
      eventType: THUNDER_INTEL_EVENT_TYPES.deliveryFailed,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'delivery',
      companyId: 'co-1',
      correlationId: 'corr-1',
      aggregateType: 'dlv_shipment',
      aggregateId: 'ship-1',
      payload: { failReason: 'NO_ANSWER' },
    });

    expect(signals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: THUNDER_SIGNAL_TYPES.DeliveryFailed,
        severity: 'WARN',
        sourceEventId: 'evt-1',
      }),
    );
    expect(recommendations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        signalId: 'sig-1',
        autonomyLevel: 2,
      }),
    );
  });

  it('creates observe-only signal on sales confirmed', async () => {
    signals.create.mockResolvedValue({ id: 'sig-2' });

    await registrar.handle({
      eventId: 'evt-2',
      eventType: THUNDER_INTEL_EVENT_TYPES.salesConfirmed,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'sales',
      companyId: 'co-1',
      correlationId: 'corr-2',
      aggregateType: 'sal_order',
      aggregateId: 'ord-1',
      payload: {},
    });

    expect(signals.create).toHaveBeenCalled();
    expect(recommendations.create).not.toHaveBeenCalled();
  });

  it('ignores events without companyId', async () => {
    await registrar.handle({
      eventId: 'evt-3',
      eventType: THUNDER_INTEL_EVENT_TYPES.financeAllocation,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      correlationId: 'corr-3',
      aggregateType: 'fin_allocation',
      aggregateId: 'alloc-1',
      payload: {},
    });

    expect(signals.create).not.toHaveBeenCalled();
  });
});
