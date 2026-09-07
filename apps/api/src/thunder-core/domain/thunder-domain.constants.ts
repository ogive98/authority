export const THUNDER_DOMAIN_CONSUMERS = {
  inventoryReserveFromOrder: 'inventory.reserveFromOrder',
  financeOpenItemFromDelivery: 'finance.openItemFromDelivery',
} as const;

export const THUNDER_DOMAIN_EVENT_TYPES = {
  salesConfirmed: 'sales.order.confirmed.v1',
  shipmentDelivered: 'delivery.shipment.delivered.v1',
} as const;
