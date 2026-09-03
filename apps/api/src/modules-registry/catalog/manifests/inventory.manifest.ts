import type { ModuleManifest } from '../manifest.types';

export const inventoryManifest: ModuleManifest = {
  id: 'inventory',
  name: 'Inventory',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Inventory / stock (gated jobs until business module)',
  capabilities: [
    {
      key: 'inventory.job.gated',
      moduleId: 'inventory',
      version: '1',
      description: 'Module-gated Thunder job surface',
      riskLevel: 'medium',
      requiresIdempotency: true,
    },
  ],
  commands: [],
  queries: [],
  permissions: [],
  dependencies: ['platform', 'organization', 'master_data'],
};
