import type { ModuleManifest } from '../manifest.types';

/**
 * Tax Engine V0 (D088) — Tunisia VAT catalog.
 * CNSS / IRPP / payroll rates are NOT here (future HR module).
 */
export const taxManifest: ModuleManifest = {
  id: 'tax',
  name: 'Fiscalité',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Tax Engine — Tunisia VAT codes/rates (7/13/19/0%); no payroll/CNSS',
  capabilities: [
    {
      key: 'tax.read',
      moduleId: 'tax',
      version: '1',
      description: 'Read VAT tax codes and active rates',
      permissionKey: 'tax.read',
      riskLevel: 'low',
    },
    {
      key: 'tax.rate.manage',
      moduleId: 'tax',
      version: '1',
      description: 'Create / patch VAT rate rows (law_ref required ideally)',
      permissionKey: 'tax.rate.manage',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: ['tax.rate.create', 'tax.rate.patch'],
  queries: ['tax.codes.list', 'tax.rates.list'],
  permissions: ['tax.read', 'tax.rate.manage'],
  dependencies: ['platform', 'organization', 'master_data'],
  publishedEvents: ['tax.rate.published.v1'],
  navigationEntries: [
    { id: 'tax-catalog', label: 'TVA Tunisie', href: '/tax' },
  ],
};
