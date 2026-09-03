import type { ModuleManifest } from '../manifest.types';

export const platformManifest: ModuleManifest = {
  id: 'platform',
  name: 'Platform',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Kernel foundation — modules discovery, files, search, numbering',
  capabilities: [
    {
      key: 'platform.modules.read',
      moduleId: 'platform',
      version: '1',
      description: 'List module activation states for the company',
      riskLevel: 'low',
    },
    {
      key: 'platform.capabilities.read',
      moduleId: 'platform',
      version: '1',
      description: 'List effective capabilities for the company',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['platform.modules.list', 'platform.capabilities.list'],
  permissions: [],
  dependencies: [],
  navigationEntries: [],
  dashboardWidgets: [],
};
