import type { ModuleManifest } from '../manifest.types';

export const customersManifest: ModuleManifest = {
  id: 'customers',
  name: 'Customers',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Customers (catalog stub)',
  capabilities: [
    {
      key: 'customers.discover',
      moduleId: 'customers',
      version: '1',
      description: 'Customers module discovery placeholder',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: [],
  permissions: [],
  dependencies: ['platform', 'organization', 'master_data'],
};
