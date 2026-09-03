import type { ModuleManifest } from '../manifest.types';

export const masterDataManifest: ModuleManifest = {
  id: 'master_data',
  name: 'Master Data',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Master data (catalog stub)',
  capabilities: [
    {
      key: 'master_data.discover',
      moduleId: 'master_data',
      version: '1',
      description: 'Master data module discovery placeholder',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: [],
  permissions: [],
  dependencies: ['platform', 'organization'],
};
