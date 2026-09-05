import type { ModuleManifest } from '../manifest.types';

export const portalsManifest: ModuleManifest = {
  id: 'portals',
  name: 'Portals',
  version: '0.1.0',
  apiVersion: '1',
  description:
    'External portals — Customer Portal P1 (access realm, me, dashboard shell)',
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
  ],
  commands: [],
  queries: ['customer_portal.me', 'customer_portal.dashboard'],
  permissions: ['customer_portal.access', 'customer_portal.dashboard.read'],
  dependencies: ['platform', 'identity', 'customers'],
  publishedEvents: [],
  // Navigation optional for P1 — portal has its own /portal shell
  navigationEntries: [],
};
