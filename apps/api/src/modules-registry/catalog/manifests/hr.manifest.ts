import type { ModuleManifest } from '../manifest.types';

/**
 * HR light V0 (D089) — employees / contracts.
 * No CNSS contribution rates, IRPP brackets, or payroll calc (Payroll module later).
 */
export const hrManifest: ModuleManifest = {
  id: 'hr',
  name: 'Ressources humaines',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'HR light — employees and contracts; no payroll rates (CNSS/IRPP deferred)',
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
      description: 'Reveal wage reference labels on contracts (field ACL)',
      permissionKey: 'hr.wage.read',
      riskLevel: 'high',
    },
  ],
  commands: [
    'hr.employee.create',
    'hr.employee.patch',
    'hr.contract.create',
    'hr.contract.end',
  ],
  queries: ['hr.employees.list', 'hr.employee.get'],
  permissions: ['hr.employee.read', 'hr.employee.write', 'hr.wage.read'],
  dependencies: ['platform', 'organization', 'identity'],
  publishedEvents: [
    'hr.employee.created.v1',
    'hr.employee.updated.v1',
    'hr.contract.created.v1',
    'hr.contract.ended.v1',
  ],
  navigationEntries: [
    { id: 'hr-employees', label: 'Employés', href: '/hr' },
  ],
};
