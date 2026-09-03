import type { ModuleManifest } from '../manifest.types';

export const salesManifest: ModuleManifest = {
  id: 'sales',
  name: 'Sales',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Sales surface (stub ping until business module)',
  capabilities: [
    {
      key: 'sales.ping',
      moduleId: 'sales',
      version: '1',
      description: 'Sales module liveness surface',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['sales.ping'],
  permissions: [],
  dependencies: ['platform', 'organization', 'customers', 'inventory'],
  optionalDependencies: ['master_data'],
};
