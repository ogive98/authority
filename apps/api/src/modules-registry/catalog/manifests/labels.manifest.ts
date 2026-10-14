import type { ModuleManifest } from '../manifest.types';

export const labelsManifest: ModuleManifest = {
  id: 'labels',
  name: 'Étiquettes',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Étiquettes V0 — templates ZPL, rendu, logs impression (D327)',
  capabilities: [
    {
      key: 'labels.read',
      moduleId: 'labels',
      version: '1',
      description: 'List templates and print logs',
      permissionKey: 'quality.check',
      riskLevel: 'low',
    },
    {
      key: 'labels.write',
      moduleId: 'labels',
      version: '1',
      description: 'Create templates and render labels',
      permissionKey: 'quality.check',
      riskLevel: 'medium',
    },
  ],
  commands: ['labels.template.create', 'labels.render'],
  queries: ['labels.templates.list', 'labels.logs.list'],
  permissions: ['quality.check'],
  dependencies: ['platform', 'organization'],
  publishedEvents: [],
  navigationEntries: [{ id: 'labels', label: 'Étiquettes', href: '/labels' }],
};
