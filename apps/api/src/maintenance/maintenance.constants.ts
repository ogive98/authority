export const MNT_ERROR_CODES = {
  NOT_FOUND: 'MNT.NOT_FOUND',
  CODE_DUP: 'MNT.CODE_DUP',
  VERSION_CONFLICT: 'MNT.VERSION_CONFLICT',
  INVALID_STATUS: 'MNT.INVALID_STATUS',
  INVALID_TYPE: 'MNT.INVALID_TYPE',
  ASSET_DOWN: 'MNT.ASSET_DOWN',
  ASSET_ONLINE: 'MNT.ASSET_ONLINE',
  WO_DONE: 'MNT.WO_DONE',
  VEHICLE_NOT_FOUND: 'MNT.VEHICLE_NOT_FOUND',
  INVALID_TITLE: 'MNT.INVALID_TITLE',
  NO_PREVENTIVE_DATE: 'MNT.NO_PREVENTIVE_DATE',
} as const;

export type MntErrorCode =
  (typeof MNT_ERROR_CODES)[keyof typeof MNT_ERROR_CODES];

export const MNT_ASSET_STATUSES = ['ONLINE', 'DOWN'] as const;
export type MntAssetStatusCode = (typeof MNT_ASSET_STATUSES)[number];

export const MNT_WO_STATUSES = ['OPEN', 'DONE'] as const;
export type MntWoStatusCode = (typeof MNT_WO_STATUSES)[number];

export const MNT_WO_TYPES = ['BREAKDOWN', 'PREVENTIVE'] as const;
export type MntWoTypeCode = (typeof MNT_WO_TYPES)[number];

export const MNT_ASSET_TYPES = [
  'EQUIPMENT',
  'VEHICLE',
  'COLD_ROOM',
  'PRESS',
  'OTHER',
] as const;

export const MNT_EVENT_TYPES = {
  ASSET_CREATED: 'maintenance.asset.created.v1',
  ASSET_UPDATED: 'maintenance.asset.updated.v1',
  ASSET_DOWN: 'maintenance.asset.down.v1',
  ASSET_UP: 'maintenance.asset.up.v1',
  WO_CREATED: 'maintenance.wo.created.v1',
  WO_DONE: 'maintenance.wo.done.v1',
} as const;
