import type { ModuleManifest } from '../manifest.types';

export const haccpManifest: ModuleManifest = {
  id: 'haccp',
  name: 'HACCP',
  version: '1.0.0',
  apiVersion: '1',
  description: 'HACCP V0 — CCP, enregistrements, audits internes (D326)',
  capabilities: [
    {
      key: 'haccp.read',
      moduleId: 'haccp',
      version: '1',
      description: 'List CCPs, records, and audits',
      permissionKey: 'quality.check',
      riskLevel: 'low',
    },
    {
      key: 'haccp.write',
      moduleId: 'haccp',
      version: '1',
      description: 'Create CCPs, records, and audits',
      permissionKey: 'quality.check',
      riskLevel: 'medium',
    },
  ],
  commands: ['haccp.ccp.create', 'haccp.record.create', 'haccp.audit.create'],
  queries: ['haccp.ccps.list', 'haccp.records.list', 'haccp.audits.list'],
  permissions: ['quality.check'],
  dependencies: ['platform', 'organization'],
  publishedEvents: [],
  navigationEntries: [{ id: 'haccp', label: 'HACCP', href: '/haccp' }],
};
