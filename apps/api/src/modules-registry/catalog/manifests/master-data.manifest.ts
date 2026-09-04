import type { ModuleManifest } from '../manifest.types';

export const masterDataManifest: ModuleManifest = {
  id: 'master_data',
  name: 'Master Data',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Company reference lists (industry pack copies)',
  capabilities: [
    {
      key: 'master_data.refs.read',
      moduleId: 'master_data',
      version: '1',
      description: 'Read company reference lists',
      permissionKey: 'master_data.refs.read',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['master_data.refs'],
  permissions: ['master_data.refs.read'],
  dependencies: ['platform', 'organization'],
};
