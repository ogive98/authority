export const PERMISSION_CATALOGUE = [
  'platform.file.read',
  'platform.file.write',
  'platform.search.use',
  'platform.numbering.allocate',
  'identity.self.read',
  'identity.user.manage',
  'identity.session.revoke',
  'org.site.write',
  'license.manage',
  'settings.self',
  'settings.company.write',
  'thunder.job.enqueue',
  'system_monitoring.view',
  'hr.wage.read',
  'products.read',
  'products.write',
  'products.activate',
  'master_data.refs.read',
  'master_data.party.read',
  'master_data.party.write',
  'customers.read',
  'customers.write',
  'customers.block',
  'customers.credit.set',
  'inventory.read',
  'inventory.write',
  'inventory.reserve',
  'sales.read',
  'sales.write',
  'sales.confirm',
  'delivery.read',
  'delivery.prepare',
  'delivery.complete',
  'delivery.fail',
  'finance.ar.read',
  'finance.ar.write',
  'finance.allocate',
  'customer_portal.access',
  'customer_portal.dashboard.read',
  'customer_portal.claims.read',
  'customer_portal.claims.create',
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOGUE)[number];

export const PERMISSION_KEYS = {
  platformFileRead: 'platform.file.read',
  platformFileWrite: 'platform.file.write',
  platformSearchUse: 'platform.search.use',
  platformNumberingAllocate: 'platform.numbering.allocate',
  identitySelfRead: 'identity.self.read',
  identityUserManage: 'identity.user.manage',
  identitySessionRevoke: 'identity.session.revoke',
  orgSiteWrite: 'org.site.write',
  licenseManage: 'license.manage',
  settingsSelf: 'settings.self',
  settingsCompanyWrite: 'settings.company.write',
  thunderJobEnqueue: 'thunder.job.enqueue',
  systemMonitoringView: 'system_monitoring.view',
  hrWageRead: 'hr.wage.read',
  productsRead: 'products.read',
  productsWrite: 'products.write',
  productsActivate: 'products.activate',
  masterDataRefsRead: 'master_data.refs.read',
  masterDataPartyRead: 'master_data.party.read',
  masterDataPartyWrite: 'master_data.party.write',
  customersRead: 'customers.read',
  customersWrite: 'customers.write',
  customersBlock: 'customers.block',
  customersCreditSet: 'customers.credit.set',
  inventoryRead: 'inventory.read',
  inventoryWrite: 'inventory.write',
  inventoryReserve: 'inventory.reserve',
  salesRead: 'sales.read',
  salesWrite: 'sales.write',
  salesConfirm: 'sales.confirm',
  deliveryRead: 'delivery.read',
  deliveryPrepare: 'delivery.prepare',
  deliveryComplete: 'delivery.complete',
  deliveryFail: 'delivery.fail',
  financeArRead: 'finance.ar.read',
  financeArWrite: 'finance.ar.write',
  financeAllocate: 'finance.allocate',
  customerPortalAccess: 'customer_portal.access',
  customerPortalDashboardRead: 'customer_portal.dashboard.read',
  customerPortalClaimsRead: 'customer_portal.claims.read',
  customerPortalClaimsCreate: 'customer_portal.claims.create',
} as const satisfies Record<string, PermissionKey>;

export const PERMISSION_METADATA_KEY = 'authority:permission';

export const PERMISSION_ERROR_CODES = {
  FORBIDDEN: 'IAM.FORBIDDEN',
} as const;

export function isCataloguedPermission(key: string): key is PermissionKey {
  return (PERMISSION_CATALOGUE as readonly string[]).includes(key);
}

export function isWildcardPermission(key: string): boolean {
  return key.includes('*');
}
