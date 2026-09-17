export const PRODUCTION_ERROR_CODES = {
  NOT_FOUND: 'PRD.NOT_FOUND',
  INVALID_STATUS: 'PRD.INVALID_STATUS',
  BOM_MISSING: 'PRD.BOM_MISSING',
  INSUFFICIENT_MP: 'PRD.INSUFFICIENT_MP',
  YIELD_OUT: 'PRD.YIELD_OUT',
  INVALID_QTY: 'PRD.INVALID_QTY',
  PRODUCT_NOT_FOUND: 'PRD.PRODUCT_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'PRD.WAREHOUSE_NOT_FOUND',
  /** Product trackLot requires lotIn / lotOut on declare (D173). */
  LOT_REQUIRED: 'PRD.LOT_REQUIRED',
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
  /** D292 — Prep→Weigh→Control AUTHORITY (outbox only; no mutatif Thunder yet). */
  WORKSHEET_CREATED: 'production.worksheet.created.v1',
  WORKSHEET_PREPARED: 'production.worksheet.prepared.v1',
  WORKSHEET_WEIGHED: 'production.worksheet.weighed.v1',
  WORKSHEET_CONTROLLED: 'production.worksheet.controlled.v1',
  WORKSHEET_REJECTED: 'production.worksheet.rejected.v1',
  WORKSHEET_CANCELLED: 'production.worksheet.cancelled.v1',
} as const;
