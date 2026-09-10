import type { ModuleManifest } from '../manifest.types';

export const accountingManifest: ModuleManifest = {
  id: 'accounting',
  name: 'Comptabilité',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Accounting GL V0 — chart of accounts, journals, fiscal periods, journal entries, trial balance (no invented tax rates)',
  capabilities: [
    {
      key: 'accounting.read',
      moduleId: 'accounting',
      version: '1',
      description: 'List CoA, journals, periods, entries, trial balance',
      permissionKey: 'accounting.read',
      riskLevel: 'low',
    },
    {
      key: 'accounting.write',
      moduleId: 'accounting',
      version: '1',
      description: 'Create accounts, journals, fiscal years/periods, draft entries',
      permissionKey: 'accounting.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'accounting.post',
      moduleId: 'accounting',
      version: '1',
      description: 'Post and reverse journal entries (OPEN period only)',
      permissionKey: 'accounting.post',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: [
    'accounting.account.create',
    'accounting.journal.create',
    'accounting.fiscal_year.create',
    'accounting.entry.create',
    'accounting.entry.post',
    'accounting.entry.reverse',
  ],
  queries: [
    'accounting.accounts.list',
    'accounting.journals.list',
    'accounting.fiscal_years.list',
    'accounting.periods.list',
    'accounting.entries.list',
    'accounting.entries.get',
    'accounting.trial_balance',
  ],
  permissions: [
    'accounting.read',
    'accounting.write',
    'accounting.post',
  ],
  dependencies: ['platform', 'organization'],
  publishedEvents: [
    'accounting.account.created.v1',
    'accounting.entry.posted.v1',
  ],
  consumedEvents: [
    'finance.invoice.issued.v1',
    'finance.invoice.cancelled.v1',
    'finance.payment.allocated.v1',
    'finance.payment.reversed.v1',
    'finance.instrument.rejected.v1',
  ],
  navigationEntries: [
    { id: 'gl', label: 'Grand livre', href: '/accounting' },
  ],
};
