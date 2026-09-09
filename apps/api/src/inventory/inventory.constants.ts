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
  LOT_SOURCE_REQUIRED: 'INV.LOT_SOURCE_REQUIRED',
  ARTICLE_DUP: 'INV.ARTICLE_DUP',
  ARTICLE_NOT_FOUND: 'INV.ARTICLE_NOT_FOUND',
  INVALID_SHELF_LIFE: 'INV.INVALID_SHELF_LIFE',
} as const;

export type InventoryErrorCode =
  (typeof INVENTORY_ERROR_CODES)[keyof typeof INVENTORY_ERROR_CODES];

export const INVENTORY_EVENT_TYPES = {
  ADJUSTED: 'inventory.stock.adjusted.v1',
  RESERVED: 'inventory.stock.reserved.v1',
  RELEASED: 'inventory.stock.released.v1',
  ISSUED: 'inventory.stock.issued.v1',
  LOT_ADJUSTED: 'inventory.lot.adjusted.v1',
  ARTICLE_UPSERTED: 'inventory.cheese_article.upserted.v1',
} as const;

/** Company settings — generation hour in Africa/Tunis (D100). Paramétrable Préférences. */
export const INVENTORY_SETTING_KEYS = {
  DAILY_LOT_GEN_HOUR_TUNIS: 'inventory.daily_lot_gen.hour_tunis',
  DAILY_LOT_GEN_TZ: 'inventory.daily_lot_gen.tz',
} as const;

export const INVENTORY_SETTING_DEFAULTS = {
  [INVENTORY_SETTING_KEYS.DAILY_LOT_GEN_HOUR_TUNIS]: 0,
  [INVENTORY_SETTING_KEYS.DAILY_LOT_GEN_TZ]: 'Africa/Tunis',
} as const;
