import type { ModuleManifest } from '../manifest.types';

export const settingsManifest: ModuleManifest = {
  id: 'settings',
  name: 'Settings',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Hierarchical settings resolution',
  capabilities: [
    {
      key: 'settings.effective.read',
      moduleId: 'settings',
      version: '1',
      description: 'Read effective settings for the actor',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['settings.effective'],
  permissions: [],
  dependencies: ['platform', 'identity', 'organization'],
};
