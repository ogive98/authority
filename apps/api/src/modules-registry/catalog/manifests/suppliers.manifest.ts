import type { ModuleManifest } from '../manifest.types';

export const suppliersManifest: ModuleManifest = {
  id: 'suppliers',
  name: 'Fournisseurs',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Supplier master AUTHORITY V0 — party, category, contacts, lead time, MOQ (D250)',
  capabilities: [
    {
      key: 'suppliers.read',
      moduleId: 'suppliers',
      version: '1',
      description: 'List and read suppliers and contacts',
      permissionKey: 'suppliers.read',
      riskLevel: 'low',
    },
    {
      key: 'suppliers.write',
      moduleId: 'suppliers',
      version: '1',
      description: 'Create, update, archive suppliers and contacts',
      permissionKey: 'suppliers.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'suppliers.hold',
      moduleId: 'suppliers',
      version: '1',
      description: 'Set quality hold / ON_HOLD status',
      permissionKey: 'suppliers.hold',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: [
    'suppliers.create',
    'suppliers.update',
    'suppliers.contact.create',
    'suppliers.hold',
  ],
  queries: ['suppliers.list', 'suppliers.get'],
  permissions: ['suppliers.read', 'suppliers.write', 'suppliers.hold'],
  dependencies: ['platform', 'organization', 'master_data'],
  publishedEvents: [
    'suppliers.supplier.created.v1',
    'suppliers.supplier.updated.v1',
    'suppliers.supplier.hold.v1',
  ],
  navigationEntries: [
    { id: 'suppliers', label: 'Fournisseurs', href: '/suppliers' },
  ],
};
