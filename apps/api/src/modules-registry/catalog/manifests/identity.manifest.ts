import type { ModuleManifest } from '../manifest.types';

export const identityManifest: ModuleManifest = {
  id: 'identity',
  name: 'Identity & Security',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Sessions, users, authentication',
  capabilities: [
    {
      key: 'identity.session.read',
      moduleId: 'identity',
      version: '1',
      description: 'Read current session / me',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['identity.me'],
  permissions: [],
  dependencies: ['platform'],
};
