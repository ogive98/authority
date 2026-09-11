import type { ModuleManifest } from '../manifest.types';

/**
 * HR light + CNSS V0 (D089/D195) — employees / contracts / CNSS preview+snapshot.
 * Rates only from VALIDATED Prefs — never invent CNSS/IRPP.
 */
export const hrManifest: ModuleManifest = {
  id: 'hr',
  name: 'Ressources humaines',
  version: '1.1.0',
  apiVersion: '1',
  description:
    'HR — employees, contracts, CNSS preview/snapshot from VALIDATED Prefs',
  capabilities: [
    {
      key: 'hr.employee.read',
      moduleId: 'hr',
      version: '1',
      description: 'List and view employees and contracts',
      permissionKey: 'hr.employee.read',
      riskLevel: 'low',
    },
    {
      key: 'hr.employee.write',
      moduleId: 'hr',
      version: '1',
      description: 'Create/update employees and contracts',
      permissionKey: 'hr.employee.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'hr.wage.read',
      moduleId: 'hr',
      version: '1',
      description: 'Reveal wage fields and CNSS amounts (field ACL)',
      permissionKey: 'hr.wage.read',
      riskLevel: 'high',
    },
  ],
  commands: [
    'hr.employee.create',
    'hr.employee.patch',
    'hr.contract.create',
    'hr.contract.patch',
    'hr.contract.end',
    'hr.cnss.snapshot.create',
  ],
  queries: [
    'hr.employees.list',
    'hr.employee.get',
    'hr.cnss.preview',
    'hr.cnss.snapshots.list',
  ],
  permissions: ['hr.employee.read', 'hr.employee.write', 'hr.wage.read'],
  dependencies: ['platform', 'organization', 'identity'],
  publishedEvents: [
    'hr.employee.created.v1',
    'hr.employee.updated.v1',
    'hr.contract.created.v1',
    'hr.contract.ended.v1',
    'hr.cnss_snapshot.created.v1',
  ],
  navigationEntries: [
    { id: 'hr-employees', label: 'Employés', href: '/hr' },
  ],
};
