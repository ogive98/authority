import type { ModuleManifest } from '../manifest.types';

export const costingManifest: ModuleManifest = {
  id: 'costing',
  name: 'Coûts de revient',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Coûts de revient V0 — rollup périodique basé sur les recettes actives et les prix d\'achat moyens (D325)',
  capabilities: [
    {
      key: 'costing.read',
      moduleId: 'costing',
      version: '1',
      description: 'List and read cost rollups',
      permissionKey: 'costing.read',
      riskLevel: 'low',
    },
    {
      key: 'costing.run',
      moduleId: 'costing',
      version: '1',
      description: 'Run cost rollup for a period',
      permissionKey: 'costing.run',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: ['costing.rollup.run'],
  queries: [
    'costing.rolls.list',
    'costing.products.get',
  ],
  permissions: ['costing.read', 'costing.run'],
  dependencies: ['platform', 'organization', 'products', 'bom', 'procurement'],
  publishedEvents: [],
  navigationEntries: [
    { id: 'costing', label: 'Coûts', href: '/costing' },
  ],
};
