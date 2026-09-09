import type { ModuleManifest } from '../manifest.types';

export const identityManifest: ModuleManifest = {
  id: 'identity',
  name: 'Identité',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Sessions, utilisateurs, authentification',
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
  permissions: ['identity.self.read', 'identity.user.manage', 'identity.session.revoke'],
  dependencies: ['platform'],
  publishedEvents: ['identity.user.updated.v1'],
  navigationEntries: [
    { id: 'account', label: 'Mon compte', href: '/account' },
    {
      id: 'users',
      label: 'Utilisateurs',
      href: '/users',
      permissionKey: 'identity.user.manage',
    },
  ],
};
