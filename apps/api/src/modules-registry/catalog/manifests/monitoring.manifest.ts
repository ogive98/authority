import type { ModuleManifest } from '../manifest.types';

export const monitoringManifest: ModuleManifest = {
  id: 'monitoring',
  name: 'System Monitoring',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Thunder monitor snapshot and SSE',
  capabilities: [
    {
      key: 'monitoring.snapshot.read',
      moduleId: 'monitoring',
      version: '1',
      description: 'Read Thunder monitor snapshot',
      permissionKey: 'system_monitoring.view',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: ['monitoring.snapshot'],
  permissions: ['system_monitoring.view'],
  dependencies: ['platform'],
};
