import type { ModuleManifest } from '../manifest.types';

export const analyticsManifest: ModuleManifest = {
  id: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Analytics light — live aggregates from Sales/Finance/Stock/Delivery (D293 · no invented KPIs)',
  capabilities: [
    {
      key: 'analytics.read',
      moduleId: 'analytics',
      version: '1',
      description: 'Read analytics summary',
      permissionKey: 'analytics.read',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['analytics.summary.get'],
  permissions: ['analytics.read'],
  dependencies: ['platform', 'organization'],
  publishedEvents: [],
  consumedEvents: [],
  navigationEntries: [
    { id: 'analytics-home', label: 'Analytics', href: '/analytics' },
  ],
};
