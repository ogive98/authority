import type { ModuleManifest } from '../manifest.types';

export const inventoryManifest: ModuleManifest = {
  id: 'inventory',
  name: 'Inventory',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Inventory light — balances, adjust, reserve',
  capabilities: [
    {
      key: 'inventory.read',
      moduleId: 'inventory',
      version: '1',
      description: 'List warehouses and stock balances',
      permissionKey: 'inventory.read',
      riskLevel: 'low',
    },
    {
      key: 'inventory.adjust',
      moduleId: 'inventory',
      version: '1',
      description: 'Adjust on-hand stock',
      permissionKey: 'inventory.write',
      riskLevel: 'medium',
      requiresAudit: true,
      requiresIdempotency: true,
    },
    {
      key: 'inventory.reserve',
      moduleId: 'inventory',
      version: '1',
      description: 'Reserve and release stock',
      permissionKey: 'inventory.reserve',
      riskLevel: 'high',
      requiresAudit: true,
      requiresIdempotency: true,
    },
    {
      key: 'inventory.job.gated',
      moduleId: 'inventory',
      version: '1',
      description: 'Module-gated Thunder job surface',
      riskLevel: 'medium',
      requiresIdempotency: true,
    },
  ],
  commands: [
    'inventory.adjust',
    'inventory.reserve',
    'inventory.release',
    'inventory.warehouse.create',
  ],
  queries: [
    'inventory.balances.list',
    'inventory.warehouses.list',
    'inventory.movements.list',
  ],
  permissions: ['inventory.read', 'inventory.write', 'inventory.reserve'],
  dependencies: ['platform', 'organization', 'master_data', 'products'],
  publishedEvents: [
    'inventory.stock.adjusted.v1',
    'inventory.stock.reserved.v1',
    'inventory.stock.released.v1',
    'inventory.stock.issued.v1',
  ],
  navigationEntries: [
    { id: 'stock', label: 'Stock', href: '/inventory' },
  ],
};
