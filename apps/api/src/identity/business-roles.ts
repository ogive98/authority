/**
 * Fixed company business roles (D112).
 * Admin-only: users admin + company Préférences / expertise légale.
 */
export const BUSINESS_ROLE_CODES = [
  'admin',
  'accountant',
  'operator',
  /** Portal salarié — pas d’accès ADV ERP (D219). */
  'employee',
] as const;

export type BusinessRoleCode = (typeof BUSINESS_ROLE_CODES)[number];

export const BUSINESS_ROLE_CATALOGUE: ReadonlyArray<{
  code: BusinessRoleCode;
  label: string;
  description: string;
}> = [
  {
    code: 'admin',
    label: 'Administrateur',
    description:
      'Utilisateurs, droits, Préférences société et tous les modules',
  },
  {
    code: 'accountant',
    label: 'Comptable',
    description:
      'Ventes, finance, compta, fiscalité lecture — pas users ni Préférences',
  },
  {
    code: 'operator',
    label: 'Opérateur',
    description:
      'Stock, livraison, opérations terrain — pas users ni Préférences',
  },
  {
    code: 'employee',
    label: 'Salarié',
    description:
      'Employee Portal + congés self — pas d’accès Soft Glass ADV',
  },
];

/** Company-scoped ROLE ALLOW keys per role (seed + documentation). */
export const ROLE_PERMISSION_PACKS: Record<BusinessRoleCode, readonly string[]> =
  {
    admin: [
      'identity.user.manage',
      'settings.self',
      'settings.company.write',
      'org.site.write',
      'license.manage',
      'platform.search.use',
      'platform.file.read',
      'platform.file.write',
      'platform.numbering.allocate',
      'thunder.job.enqueue',
      'thunder.intel.read',
      'thunder.intel.write',
      'system_monitoring.view',
      'products.read',
      'products.write',
      'products.activate',
      'master_data.refs.read',
      'master_data.party.read',
      'master_data.party.write',
      'customers.read',
      'customers.write',
      'customers.block',
      'customers.credit.set',
      'inventory.read',
      'inventory.write',
      'inventory.reserve',
      'sales.read',
      'sales.write',
      'sales.confirm',
      'delivery.read',
      'delivery.prepare',
      'delivery.complete',
      'delivery.fail',
      'finance.ar.read',
      'finance.ar.write',
      'finance.allocate',
      'tax.read',
      'tax.rate.manage',
      'documents.read',
      'documents.write',
      'accounting.read',
      'accounting.write',
      'accounting.post',
      'production.read',
      'production.wo.write',
      'production.declare',
      'production.scrap',
      'hr.employee.read',
      'hr.employee.write',
      'hr.wage.read',
      'attendance.self',
      'attendance.manage',
      'attendance.approve',
      'employee_portal.access',
      'repair.read',
      'repair.scan',
      'repair.execute',
      'repair.reset',
    ],
    accountant: [
      'settings.self',
      'platform.search.use',
      'platform.file.read',
      'products.read',
      'master_data.refs.read',
      'master_data.party.read',
      'customers.read',
      'customers.write',
      'inventory.read',
      'sales.read',
      'sales.write',
      'sales.confirm',
      'delivery.read',
      'finance.ar.read',
      'finance.ar.write',
      'finance.allocate',
      'tax.read',
      'documents.read',
      'documents.write',
      'accounting.read',
      'accounting.write',
      'accounting.post',
    ],
    operator: [
      'settings.self',
      'platform.search.use',
      'platform.file.read',
      'products.read',
      'master_data.refs.read',
      'master_data.party.read',
      'customers.read',
      'inventory.read',
      'inventory.write',
      'inventory.reserve',
      'sales.read',
      'delivery.read',
      'delivery.prepare',
      'delivery.complete',
      'delivery.fail',
      'documents.read',
      'production.read',
      'production.wo.write',
      'production.declare',
    ],
    employee: [
      'employee_portal.access',
      'attendance.self',
    ],
  };
