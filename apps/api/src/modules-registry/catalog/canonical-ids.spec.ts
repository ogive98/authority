import {
  canonicalCapabilityId,
  canonicalCommandId,
  canonicalConfigurationId,
  canonicalEventId,
  canonicalFeatureId,
  canonicalModuleId,
  canonicalQueryId,
  stripCanonicalPrefix,
} from './canonical-ids';

describe('canonical ids', () => {
  it('prefixes technical keys without doubling', () => {
    expect(canonicalModuleId('sales')).toBe('mod.sales');
    expect(canonicalModuleId('mod.sales')).toBe('mod.sales');
    expect(canonicalCapabilityId('sales.confirm')).toBe('cap.sales.confirm');
    expect(canonicalCapabilityId('cap.sales.confirm')).toBe(
      'cap.sales.confirm',
    );
    expect(canonicalFeatureId('sales', 'orders')).toBe('feat.sales.orders');
    expect(canonicalFeatureId('sales', 'sales.orders')).toBe(
      'feat.sales.orders',
    );
    expect(canonicalCommandId('sales.order.create')).toBe(
      'cmd.sales.order.create',
    );
    expect(canonicalQueryId('sales.orders.list')).toBe(
      'query.sales.orders.list',
    );
    expect(canonicalConfigurationId('tax.vat')).toBe('cfg.tax.vat');
  });

  it('strips event version for the alias only', () => {
    expect(canonicalEventId('sales.order.created.v1')).toBe(
      'event.sales.order.created',
    );
    expect(canonicalEventId('event.sales.order.created')).toBe(
      'event.sales.order.created',
    );
  });

  it('strips prefix back to the technical key', () => {
    expect(stripCanonicalPrefix('module', 'mod.sales')).toBe('sales');
    expect(stripCanonicalPrefix('module', 'sales')).toBe('sales');
  });
});
