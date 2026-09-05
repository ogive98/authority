import type { ModuleManifest } from '../manifest.types';

export const salesManifest: ModuleManifest = {
  id: 'sales',
  name: 'Sales',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Sales Order V0 — draft, lines, confirm/reserve',
  capabilities: [
    {
      key: 'sales.ping',
      moduleId: 'sales',
      version: '1',
      description: 'Sales module liveness surface',
      riskLevel: 'low',
    },
    {
      key: 'sales.read',
      moduleId: 'sales',
      version: '1',
      description: 'List and read sales orders',
      permissionKey: 'sales.read',
      riskLevel: 'low',
    },
    {
      key: 'sales.write',
      moduleId: 'sales',
      version: '1',
      description: 'Create and update draft sales orders',
      permissionKey: 'sales.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'sales.confirm',
      moduleId: 'sales',
      version: '1',
      description: 'Confirm order and reserve stock',
      permissionKey: 'sales.confirm',
      riskLevel: 'high',
      requiresAudit: true,
      requiresIdempotency: true,
    },
  ],
  commands: [
    'sales.order.create',
    'sales.order.update',
    'sales.order.confirm',
    'sales.order.cancel',
  ],
  queries: ['sales.ping', 'sales.orders.list', 'sales.orders.get'],
  permissions: ['sales.read', 'sales.write', 'sales.confirm'],
  dependencies: [
    'platform',
    'organization',
    'customers',
    'products',
    'inventory',
  ],
  optionalDependencies: ['master_data'],
  publishedEvents: [
    'sales.order.created.v1',
    'sales.order.confirmed.v1',
    'sales.order.cancelled.v1',
  ],
  navigationEntries: [
    { id: 'orders', label: 'Commandes', href: '/sales' },
  ],
};
