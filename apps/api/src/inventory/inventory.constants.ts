export const INVENTORY_ERROR_CODES = {
  NOT_FOUND: 'INV.NOT_FOUND',
  WAREHOUSE_DUP: 'INV.WAREHOUSE_DUP',
  PRODUCT_NOT_FOUND: 'INV.PRODUCT_NOT_FOUND',
  INSUFFICIENT: 'INV.INSUFFICIENT',
  INVALID_QTY: 'INV.INVALID_QTY',
  VERSION_CONFLICT: 'INV.VERSION_CONFLICT',
  LOT_REQUIRED: 'INV.LOT_REQUIRED',
  LOT_DUP: 'INV.LOT_DUP',
  LOT_CLOSED: 'INV.LOT_CLOSED',
} as const;

export type InventoryErrorCode =
  (typeof INVENTORY_ERROR_CODES)[keyof typeof INVENTORY_ERROR_CODES];

export const INVENTORY_EVENT_TYPES = {
  ADJUSTED: 'inventory.stock.adjusted.v1',
  RESERVED: 'inventory.stock.reserved.v1',
  RELEASED: 'inventory.stock.released.v1',
  ISSUED: 'inventory.stock.issued.v1',
  LOT_ADJUSTED: 'inventory.lot.adjusted.v1',
} as const;
