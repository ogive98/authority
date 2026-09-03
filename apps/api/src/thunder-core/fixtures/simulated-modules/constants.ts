export const SIMULATED_MODULE_EVENTS = {
  salesOrderConfirmed: 'sales.order.confirmed.v1',
  inventoryStockReserved: 'inventory.stock.reserved.v1',
} as const;

export const SIMULATED_MODULE_JOBS = {
  inventoryReserve: 'inventory.reserve.v1',
} as const;

export const SIMULATED_MODULE_CONSUMERS = {
  inventoryReserveFromOrder: 'inventory.reserveFromOrder',
  notificationsStockReserved: 'notifications.stockReserved',
} as const;
