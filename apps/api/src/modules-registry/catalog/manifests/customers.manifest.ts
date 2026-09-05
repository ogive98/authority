import type { ModuleManifest } from '../manifest.types';

export const customersManifest: ModuleManifest = {
  id: 'customers',
  name: 'Customers',
  version: '1.1.0',
  apiVersion: '1',
  description:
    'Customers V1b — party link, profile, contacts, zones, credit, block',
  capabilities: [
    {
      key: 'customers.read',
      moduleId: 'customers',
      version: '1',
      description: 'List and read customers and zones',
      permissionKey: 'customers.read',
      riskLevel: 'low',
    },
    {
      key: 'customers.write',
      moduleId: 'customers',
      version: '1',
      description: 'Create, update, archive customers, contacts, and zones',
      permissionKey: 'customers.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'customers.block',
      moduleId: 'customers',
      version: '1',
      description: 'Block and unblock customers (denies sales confirm)',
      permissionKey: 'customers.block',
      riskLevel: 'high',
      requiresAudit: true,
    },
    {
      key: 'customers.credit.set',
      moduleId: 'customers',
      version: '1',
      description: 'Set customer credit limit',
      permissionKey: 'customers.credit.set',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: [
    'customers.create',
    'customers.update',
    'customers.contact.create',
    'customers.zone.create',
    'customers.block',
    'customers.unblock',
    'customers.credit.set',
  ],
  queries: ['customers.list', 'customers.get', 'customers.zones.list'],
  permissions: [
    'customers.read',
    'customers.write',
    'customers.block',
    'customers.credit.set',
  ],
  dependencies: ['platform', 'organization', 'master_data'],
  publishedEvents: [],
  navigationEntries: [
    { id: 'customers', label: 'Clients', href: '/customers' },
  ],
};
