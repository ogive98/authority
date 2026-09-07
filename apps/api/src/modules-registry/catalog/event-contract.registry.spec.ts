import {
  EventContractError,
  EventContractRegistry,
  resetDefaultEventContractRegistry,
} from './event-contract.registry';
import { STATIC_MODULE_MANIFESTS } from './manifests';

describe('EventContractRegistry', () => {
  afterEach(() => {
    resetDefaultEventContractRegistry();
    delete process.env.THUNDER_EVENT_CONTRACTS_MODE;
  });

  it('indexes published events from static manifests', () => {
    const registry = EventContractRegistry.fromManifests(
      STATIC_MODULE_MANIFESTS,
      'strict',
    );
    expect(registry.has('sales.order.confirmed.v1')).toBe(true);
    expect(registry.has('delivery.shipment.failed.v1')).toBe(true);
    expect(registry.has('identity.user.updated.v1')).toBe(true);
    expect(registry.get('sales.order.confirmed.v1')?.publisherModuleId).toBe(
      'sales',
    );
  });

  it('rejects unknown publish in strict mode', () => {
    const registry = EventContractRegistry.fromManifests(
      STATIC_MODULE_MANIFESTS,
      'strict',
    );
    expect(() =>
      registry.assertPublishable('unknown.event.v1'),
    ).toThrow(EventContractError);
  });

  it('allows known publish', () => {
    const registry = EventContractRegistry.fromManifests(
      STATIC_MODULE_MANIFESTS,
      'strict',
    );
    expect(() =>
      registry.assertPublishable('finance.allocation.recorded.v1'),
    ).not.toThrow();
  });

  it('filters consumer accepts by consumes list', () => {
    const registry = EventContractRegistry.fromManifests(
      STATIC_MODULE_MANIFESTS,
      'off',
    );
    expect(
      registry.consumerAccepts(
        ['delivery.shipment.failed.v1'],
        'delivery.shipment.failed.v1',
      ),
    ).toBe(true);
    expect(
      registry.consumerAccepts(
        ['delivery.shipment.failed.v1'],
        'sales.order.confirmed.v1',
      ),
    ).toBe(false);
    expect(registry.consumerAccepts(['*'], 'sales.order.confirmed.v1')).toBe(
      true,
    );
  });

  it('validates consumedEvents against published contracts', () => {
    const registry = EventContractRegistry.fromManifests(
      STATIC_MODULE_MANIFESTS,
      'off',
    );
    expect(() =>
      registry.assertConsumedEventsDeclared('inventory', [
        'sales.order.confirmed.v1',
      ]),
    ).not.toThrow();
    expect(() =>
      registry.assertConsumedEventsDeclared('inventory', [
        'does.not.exist.v1',
      ]),
    ).toThrow(EventContractError);
  });
});
