import type { ModuleManifest } from '../manifest.types';

export const documentsManifest: ModuleManifest = {
  id: 'documents',
  name: 'Documents',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Documents light — metadata over SOC-09 files, portal signed downloads',
  capabilities: [
    {
      key: 'documents.read',
      moduleId: 'documents',
      version: '1',
      description: 'List and download documents',
      permissionKey: 'documents.read',
      riskLevel: 'low',
    },
    {
      key: 'documents.write',
      moduleId: 'documents',
      version: '1',
      description: 'Upload and link documents',
      permissionKey: 'documents.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: ['documents.document.create'],
  queries: [
    'documents.documents.list',
    'documents.documents.get',
    'documents.documents.download',
  ],
  permissions: ['documents.read', 'documents.write'],
  dependencies: ['platform', 'organization'],
  publishedEvents: ['documents.document.created.v1'],
  consumedEvents: [],
  navigationEntries: [
    { id: 'library', label: 'Documents', href: '/documents' },
  ],
};
