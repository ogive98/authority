import type { ModuleManifest } from '../manifest.types';

/**
 * Tax Engine catalog stub (D076).
 * No rates, no posting, no UI — discover-only until expert-validated rate tables.
 */
export const taxManifest: ModuleManifest = {
  id: 'tax',
  name: 'Tax',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Tax Engine (catalog stub — no rates; expert validation required)',
  capabilities: [
    {
      key: 'tax.discover',
      moduleId: 'tax',
      version: '1',
      description: 'Tax module discovery placeholder (no rate data)',
      riskLevel: 'low',
    },
  ],
  commands: [],
  queries: [],
  permissions: [],
  dependencies: ['platform', 'organization', 'master_data'],
};
