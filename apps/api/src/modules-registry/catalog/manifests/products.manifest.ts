import type { ModuleManifest } from '../manifest.types';

export const productsManifest: ModuleManifest = {
  id: 'products',
  name: 'Products',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Product catalogue (V0 CRUD)',
  capabilities: [
    {
      key: 'products.read',
      moduleId: 'products',
      version: '1',
      description: 'List and read products',
      permissionKey: 'products.read',
      riskLevel: 'low',
    },
    {
      key: 'products.write',
      moduleId: 'products',
      version: '1',
      description: 'Create, update, archive products',
      permissionKey: 'products.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'products.activate',
      moduleId: 'products',
      version: '1',
      description: 'Activate draft products',
      permissionKey: 'products.activate',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: ['products.create', 'products.update', 'products.activate'],
  queries: ['products.list', 'products.get'],
  permissions: ['products.read', 'products.write', 'products.activate'],
  dependencies: ['platform', 'organization', 'master_data'],
  publishedEvents: [
    'products.created.v1',
    'products.updated.v1',
    'products.activated.v1',
  ],
  navigationEntries: [
    { id: 'catalogue', label: 'Catalogue', href: '/products' },
  ],
};
