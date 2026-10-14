import type { ModuleManifest } from '../manifest.types';
import { accountingManifest } from './accounting.manifest';
import { analyticsManifest } from './analytics.manifest';
import { attendanceManifest } from './attendance.manifest';
import { automationManifest } from './automation.manifest';
import { customersManifest } from './customers.manifest';
import { deliveryManifest } from './delivery.manifest';
import { suppliersManifest } from './suppliers.manifest';
import { documentsManifest } from './documents.manifest';
import { forgeManifest } from './forge.manifest';
import { financeManifest } from './finance.manifest';
import { fleetManifest } from './fleet.manifest';
import { hrManifest } from './hr.manifest';
import { maintenanceManifest } from './maintenance.manifest';
import { identityManifest } from './identity.manifest';
import { inventoryManifest } from './inventory.manifest';
import { masterDataManifest } from './master-data.manifest';
import { monitoringManifest } from './monitoring.manifest';
import { organizationManifest } from './organization.manifest';
import { payrollManifest } from './payroll.manifest';
import { PENDING_MODULE_MANIFESTS } from './pending.manifests';
import { platformManifest } from './platform.manifest';
import { procurementManifest } from './procurement.manifest';
import { portalsManifest } from './portals.manifest';
import { productionManifest } from './production.manifest';
import { productsManifest } from './products.manifest';
import { repairManifest } from './repair.manifest';
import { backupManifest } from './backup.manifest';
import { bomManifest } from './bom.manifest';
import { costingManifest } from './costing.manifest';
import { qualityManifest } from './quality.manifest';
import { haccpManifest } from './haccp.manifest';
import { traceabilityManifest } from './traceability.manifest';
import { labelsManifest } from './labels.manifest';
import { salesManifest } from './sales.manifest';
import { settingsManifest } from './settings.manifest';
import { taxManifest } from './tax.manifest';

/**
 * Static catalog — exactly `KERNEL_MODULE_KEYS` + `BUSINESS_MODULE_KEYS`.
 * Mismatch makes `ModuleCatalogService.load()` throw at boot.
 */
export const STATIC_MODULE_MANIFESTS: readonly ModuleManifest[] = [
  platformManifest,
  identityManifest,
  organizationManifest,
  settingsManifest,
  monitoringManifest,
  salesManifest,
  inventoryManifest,
  deliveryManifest,
  financeManifest,
  fleetManifest,
  maintenanceManifest,
  documentsManifest,
  accountingManifest,
  productionManifest,
  payrollManifest,
  hrManifest,
  attendanceManifest,
  taxManifest,
  repairManifest,
  backupManifest,
  customersManifest,
  suppliersManifest,
  masterDataManifest,
  productsManifest,
  portalsManifest,
  automationManifest,
  forgeManifest,
  analyticsManifest,
  procurementManifest,
  bomManifest,
  costingManifest,
  qualityManifest,
  haccpManifest,
  traceabilityManifest,
  labelsManifest,
  ...PENDING_MODULE_MANIFESTS,
] as const;
