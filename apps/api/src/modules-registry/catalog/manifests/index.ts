import type { ModuleManifest } from '../manifest.types';
import { customersManifest } from './customers.manifest';
import { identityManifest } from './identity.manifest';
import { inventoryManifest } from './inventory.manifest';
import { masterDataManifest } from './master-data.manifest';
import { monitoringManifest } from './monitoring.manifest';
import { organizationManifest } from './organization.manifest';
import { payrollManifest } from './payroll.manifest';
import { platformManifest } from './platform.manifest';
import { productionManifest } from './production.manifest';
import { productsManifest } from './products.manifest';
import { salesManifest } from './sales.manifest';
import { settingsManifest } from './settings.manifest';

/** Static catalog — exactly the seeded runtime module keys. */
export const STATIC_MODULE_MANIFESTS: readonly ModuleManifest[] = [
  platformManifest,
  identityManifest,
  organizationManifest,
  settingsManifest,
  monitoringManifest,
  salesManifest,
  inventoryManifest,
  productionManifest,
  payrollManifest,
  customersManifest,
  masterDataManifest,
  productsManifest,
] as const;
