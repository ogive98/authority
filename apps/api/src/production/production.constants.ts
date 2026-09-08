export const PRODUCTION_ERROR_CODES = {
  NOT_FOUND: 'PRD.NOT_FOUND',
  INVALID_STATUS: 'PRD.INVALID_STATUS',
  BOM_MISSING: 'PRD.BOM_MISSING',
  INSUFFICIENT_MP: 'PRD.INSUFFICIENT_MP',
  YIELD_OUT: 'PRD.YIELD_OUT',
  INVALID_QTY: 'PRD.INVALID_QTY',
  PRODUCT_NOT_FOUND: 'PRD.PRODUCT_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'PRD.WAREHOUSE_NOT_FOUND',
} as const;

export type ProductionErrorCode =
  (typeof PRODUCTION_ERROR_CODES)[keyof typeof PRODUCTION_ERROR_CODES];

export const PRODUCTION_EVENT_TYPES = {
  WO_CREATED: 'production.work_order.created.v1',
  WO_RELEASED: 'production.work_order.released.v1',
  CONSUMPTION_POSTED: 'production.consumption.posted.v1',
  OUTPUT_POSTED: 'production.output.posted.v1',
  YIELD_DEVIATION: 'production.yield.deviation.v1',
  SCRAP_POSTED: 'production.scrap.posted.v1',
} as const;
