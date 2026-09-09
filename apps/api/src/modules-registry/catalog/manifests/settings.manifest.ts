import type { ModuleManifest } from '../manifest.types';

export const settingsManifest: ModuleManifest = {
  id: 'settings',
  name: 'Paramètres',
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
  publishedEvents: [
    'settings.value.updated.v1',
    'settings.expertise.validated.v1',
  ],
  navigationEntries: [
    {
      id: 'prefs',
      label: 'Préférences',
      href: '/settings',
      permissionKey: 'settings.company.write',
    },
    {
      id: 'expertise',
      label: 'Expertise légale',
      href: '/settings#expertise',
      permissionKey: 'settings.company.write',
    },
  ],
};
