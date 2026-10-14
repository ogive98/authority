import type { ModuleManifest } from '../manifest.types';

export const traceabilityManifest: ModuleManifest = {
  id: 'traceability',
  name: 'Traçabilité',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Traçabilité V0 — lots, généalogie, rappels (D326)',
  capabilities: [
    {
      key: 'traceability.read',
      moduleId: 'traceability',
      version: '1',
      description: 'List lots and recalls',
      permissionKey: 'quality.check',
      riskLevel: 'low',
    },
    {
      key: 'traceability.write',
      moduleId: 'traceability',
      version: '1',
      description: 'Create lots, links, and recalls',
      permissionKey: 'quality.release',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: ['traceability.lot.create', 'traceability.link.create', 'traceability.recall.create', 'traceability.recall.complete'],
  queries: ['traceability.lots.list', 'traceability.lots.tree', 'traceability.recalls.list'],
  permissions: ['quality.check', 'quality.release'],
  dependencies: ['platform', 'organization', 'inventory'],
  publishedEvents: [],
  navigationEntries: [{ id: 'traceability', label: 'Traçabilité', href: '/traceability' }],
};
