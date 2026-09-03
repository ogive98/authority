import type { ModuleManifest } from '../manifest.types';

export const productionManifest: ModuleManifest = {
  id: 'production',
  name: 'Production',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Production (catalog stub)',
  capabilities: [
    {
      key: 'production.discover',
      moduleId: 'production',
      version: '1',
      description: 'Production module discovery placeholder',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: [],
  permissions: [],
  dependencies: ['platform', 'organization', 'inventory'],
};
