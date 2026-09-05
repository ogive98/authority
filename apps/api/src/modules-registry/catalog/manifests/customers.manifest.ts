import type { ModuleManifest } from '../manifest.types';

export const customersManifest: ModuleManifest = {
  id: 'customers',
  name: 'Customers',
  version: '1.0.0',
  apiVersion: '1',
  description: 'Customers V1a — party link, profile, contacts',
  capabilities: [
    {
      key: 'customers.read',
      moduleId: 'customers',
      version: '1',
      description: 'List and read customers',
      permissionKey: 'customers.read',
      riskLevel: 'low',
    },
    {
      key: 'customers.write',
      moduleId: 'customers',
      version: '1',
      description: 'Create, update, archive customers and contacts',
      permissionKey: 'customers.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: [
    'customers.create',
    'customers.update',
    'customers.contact.create',
  ],
  queries: ['customers.list', 'customers.get'],
  permissions: ['customers.read', 'customers.write'],
  dependencies: ['platform', 'organization', 'master_data'],
  publishedEvents: [],
  navigationEntries: [
    { id: 'customers', label: 'Clients', href: '/customers' },
  ],
};
