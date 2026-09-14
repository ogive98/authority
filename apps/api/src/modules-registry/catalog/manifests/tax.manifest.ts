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
    'Tax Engine — TVA Tunisie + lecture FODEC/timbre/RAS/TEJ Prefs (VALIDATED only); no invented rates; no TEJ transmission',
  capabilities: [
    {
      key: 'tax.read',
      moduleId: 'tax',
      version: '1',
      description: 'Read VAT tax codes, active rates, and fiscal expertise readiness',
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
    { id: 'tax-catalog', label: 'Fiscalité / TVA', href: '/tax' },
    {
      id: 'tax-expertise',
      label: 'Expertise fiscale (Prefs)',
      href: '/settings#expertise',
    },
  ],
};
