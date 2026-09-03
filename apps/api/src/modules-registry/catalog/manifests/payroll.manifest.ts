import type { ModuleManifest } from '../manifest.types';

export const payrollManifest: ModuleManifest = {
  id: 'payroll',
  name: 'Payroll',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Payroll (catalog stub — no business rules)',
  capabilities: [
    {
      key: 'payroll.discover',
      moduleId: 'payroll',
      version: '1',
      description: 'Payroll module discovery placeholder',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: [],
  permissions: [],
  dependencies: ['platform', 'organization', 'identity'],
};
