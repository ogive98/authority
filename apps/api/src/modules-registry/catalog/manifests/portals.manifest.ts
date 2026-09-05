import type { ModuleManifest } from '../manifest.types';

export const portalsManifest: ModuleManifest = {
  id: 'portals',
  name: 'Portals',
  version: '0.6.0',
  apiVersion: '1',
  description:
    'External portals — Customer Portal P1–P6 (access, orders, finance read, delivery track, claims)',
  capabilities: [
    {
      key: 'customer_portal.access',
      moduleId: 'portals',
      version: '1',
      description: 'Access customer portal login and session',
      permissionKey: 'customer_portal.access',
      riskLevel: 'medium',
    },
    {
      key: 'customer_portal.dashboard.read',
      moduleId: 'portals',
      version: '1',
      description: 'Read customer portal dashboard shell',
      permissionKey: 'customer_portal.dashboard.read',
      riskLevel: 'low',
    },
    {
      key: 'customer_portal.claims.read',
      moduleId: 'portals',
      version: '1',
      description: 'List and read portal claims for membership customer',
      permissionKey: 'customer_portal.claims.read',
      riskLevel: 'low',
    },
    {
      key: 'customer_portal.claims.create',
      moduleId: 'portals',
      version: '1',
      description: 'Create portal claims linked to own orders/shipments',
      permissionKey: 'customer_portal.claims.create',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: ['customer_portal.claims.create'],
  queries: [
    'customer_portal.me',
    'customer_portal.dashboard',
    'customer_portal.claims.list',
    'customer_portal.claims.get',
  ],
  permissions: [
    'customer_portal.access',
    'customer_portal.dashboard.read',
    'customer_portal.claims.read',
    'customer_portal.claims.create',
  ],
  dependencies: [
    'platform',
    'identity',
    'customers',
    'sales',
    'delivery',
    'finance',
  ],
  publishedEvents: ['portals.claim.created.v1'],
  navigationEntries: [],
};
