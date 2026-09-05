import type { ModuleManifest } from '../manifest.types';

export const masterDataManifest: ModuleManifest = {
  id: 'master_data',
  name: 'Master Data',
  version: '1.1.0',
  apiVersion: '1',
  description: 'Reference lists + party kernel',
  capabilities: [
    {
      key: 'master_data.refs.read',
      moduleId: 'master_data',
      version: '1',
      description: 'Read company reference lists',
      permissionKey: 'master_data.refs.read',
      riskLevel: 'low',
    },
    {
      key: 'master_data.party.read',
      moduleId: 'master_data',
      version: '1',
      description: 'Read parties',
      permissionKey: 'master_data.party.read',
      riskLevel: 'low',
    },
    {
      key: 'master_data.party.write',
      moduleId: 'master_data',
      version: '1',
      description: 'Create parties',
      permissionKey: 'master_data.party.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: ['master_data.party.create'],
  queries: ['master_data.refs', 'master_data.parties'],
  permissions: [
    'master_data.refs.read',
    'master_data.party.read',
    'master_data.party.write',
  ],
  dependencies: ['platform', 'organization'],
};
