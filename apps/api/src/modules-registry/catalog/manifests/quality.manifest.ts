import type { ModuleManifest } from '../manifest.types';

export const qualityManifest: ModuleManifest = {
  id: 'quality',
  name: 'Qualité',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Qualité V0 — contrôles QC, NCR, hold/libération lots (D326)',
  capabilities: [
    {
      key: 'quality.check',
      moduleId: 'quality',
      version: '1',
      description: 'Create and list quality checks',
      permissionKey: 'quality.check',
      riskLevel: 'medium',
    },
    {
      key: 'quality.ncr.write',
      moduleId: 'quality',
      version: '1',
      description: 'Create and close non-conformance reports',
      permissionKey: 'quality.ncr.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'quality.release',
      moduleId: 'quality',
      version: '1',
      description: 'Hold and release lots',
      permissionKey: 'quality.release',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: ['quality.check.create', 'quality.ncr.create', 'quality.ncr.close', 'quality.lot.hold', 'quality.lot.release'],
  queries: ['quality.checks.list', 'quality.ncrs.list'],
  permissions: ['quality.check', 'quality.ncr.write', 'quality.release'],
  dependencies: ['platform', 'organization', 'inventory'],
  publishedEvents: [],
  navigationEntries: [{ id: 'quality', label: 'Qualité', href: '/quality' }],
};
