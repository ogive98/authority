import type { ModuleManifest } from '../manifest.types';

/**
 * Tax Engine (D088 + D259) — Tunisia VAT catalog + fiscal calculate.
 * FODEC / timbre / RAS / TEJ remain Prefs VALIDATED only (D090/D092/D246).
 * CNSS / IRPP / payroll rates are NOT here (HR).
 * tax.simulate (CDC) → permission tax.read
 * tax.manage (CDC) → permission tax.rate.manage
 */
export const taxManifest: ModuleManifest = {
  id: 'tax',
  name: 'Fiscalité',
  version: '1.1.0',
  apiVersion: '1',
  description:
    'Tax Engine — TVA Tunisie + POST /tax/calculate; FODEC/timbre/RAS/TEJ Prefs VALIDATED only; local TEJ XML draft+hash (D265); no invented rates; no TEJ transmission',
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
      key: 'tax.simulate',
      moduleId: 'tax',
      version: '1',
      description: 'Run Fiscal Engine calculate (preview FiscalDecision[])',
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
    {
      key: 'tax.manage',
      moduleId: 'tax',
      version: '1',
      description: 'Manage fiscal rules (CDC alias of tax.rate.manage)',
      permissionKey: 'tax.rate.manage',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: [
    'tax.rate.create',
    'tax.rate.patch',
    'tax.calculate',
    'tax.compute',
    'tax.tej.export.generate',
  ],
  queries: ['tax.codes.list', 'tax.rates.list', 'tax.tej.exports.list'],
  permissions: ['tax.read', 'tax.rate.manage'],
  dependencies: ['platform', 'organization', 'master_data', 'settings'],
  publishedEvents: [
    'tax.rate.published.v1',
    'tax.rate.changed.v1',
    'tax.tej.local_generated.v1',
  ],
  navigationEntries: [
    { id: 'tax-catalog', label: 'Fiscalité / TVA', href: '/tax' },
    {
      id: 'tax-expertise',
      label: 'Expertise fiscale (Prefs)',
      href: '/settings#expertise',
    },
  ],
};
