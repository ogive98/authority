export const THUNDER_INTEL_CONSUMER_ID = 'thunder.intel';

export const THUNDER_SIGNAL_TYPES = {
  DeliveryFailed: 'DeliveryFailed',
  SalesOrderConfirmed: 'SalesOrderConfirmed',
  FinanceAllocationRecorded: 'FinanceAllocationRecorded',
  FinanceOverdueOpenItems: 'FinanceOverdueOpenItems',
  FinanceBrokenPromises: 'FinanceBrokenPromises',
} as const;

export const THUNDER_INTEL_EVENT_TYPES = {
  deliveryFailed: 'delivery.shipment.failed.v1',
  salesConfirmed: 'sales.order.confirmed.v1',
  financeAllocation: 'finance.allocation.recorded.v1',
  financeOpenItemCreated: 'finance.open_item.created.v1',
  financePromiseCreated: 'finance.promise.created.v1',
  financePromiseStatus: 'finance.promise.status.v1',
} as const;
