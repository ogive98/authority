import type { ModuleManifest } from '../manifest.types';

export const financeManifest: ModuleManifest = {
  id: 'finance',
  name: 'Finance',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Finance light — AR open items and payment allocations (amounts as recorded; no invented tax rates)',
  capabilities: [
    {
      key: 'finance.ar.read',
      moduleId: 'finance',
      version: '1',
      description: 'List and read AR open items / credit snapshot',
      permissionKey: 'finance.ar.read',
      riskLevel: 'low',
    },
    {
      key: 'finance.ar.write',
      moduleId: 'finance',
      version: '1',
      description: 'Create AR open items',
      permissionKey: 'finance.ar.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'finance.allocate',
      moduleId: 'finance',
      version: '1',
      description: 'Record payment allocations against open items',
      permissionKey: 'finance.allocate',
      riskLevel: 'high',
      requiresAudit: true,
      requiresIdempotency: true,
    },
  ],
  commands: [
    'finance.open_item.create',
    'finance.open_item.allocate',
  ],
  queries: [
    'finance.open_items.list',
    'finance.open_items.get',
    'finance.credit.snapshot',
  ],
  permissions: [
    'finance.ar.read',
    'finance.ar.write',
    'finance.allocate',
  ],
  dependencies: [
    'platform',
    'organization',
    'customers',
  ],
  publishedEvents: [
    'finance.open_item.created.v1',
    'finance.allocation.recorded.v1',
  ],
  consumedEvents: [],
  navigationEntries: [
    { id: 'open-items', label: 'Créances', href: '/finance' },
  ],
};
