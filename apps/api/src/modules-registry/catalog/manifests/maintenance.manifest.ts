import type { ModuleManifest } from '../manifest.types';

export const maintenanceManifest: ModuleManifest = {
  id: 'maintenance',
  name: 'Maintenance',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Maintenance AUTHORITY — assets, WO, optional fleet link, preventive ADV (D256+D258)',
  capabilities: [
    {
      key: 'maintenance.asset',
      moduleId: 'maintenance',
      version: '1',
      description: 'Manage maintenance assets',
      permissionKey: 'maintenance.asset',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'maintenance.wo',
      moduleId: 'maintenance',
      version: '1',
      description: 'Create and complete maintenance work orders',
      permissionKey: 'maintenance.wo',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: [
    'maintenance.asset.create',
    'maintenance.asset.patch',
    'maintenance.asset.down',
    'maintenance.asset.up',
    'maintenance.wo.create',
    'maintenance.wo.open_preventive',
    'maintenance.wo.complete',
  ],
  queries: [
    'maintenance.assets.list',
    'maintenance.asset.get',
    'maintenance.wo.list',
  ],
  permissions: ['maintenance.asset', 'maintenance.wo'],
  dependencies: ['platform', 'organization'],
  publishedEvents: [
    'maintenance.asset.created.v1',
    'maintenance.asset.updated.v1',
    'maintenance.asset.down.v1',
    'maintenance.asset.up.v1',
    'maintenance.wo.created.v1',
    'maintenance.wo.done.v1',
  ],
  navigationEntries: [
    { id: 'mnt-assets', label: 'Maintenance', href: '/maintenance' },
    { id: 'mnt-wo', label: 'OT maintenance', href: '/maintenance?tab=wo' },
  ],
};
