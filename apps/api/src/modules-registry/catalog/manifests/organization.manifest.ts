import type { ModuleManifest } from '../manifest.types';

export const organizationManifest: ModuleManifest = {
  id: 'organization',
  name: 'Organization',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Companies, sites, assignments',
  capabilities: [
    {
      key: 'organization.context.read',
      moduleId: 'organization',
      version: '1',
      description: 'Read company / site tenancy context',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['organization.context'],
  permissions: [],
  dependencies: ['platform', 'identity'],
};
