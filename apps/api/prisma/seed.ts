import { config } from 'dotenv';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

import { IamGrantEffect, IamGrantSubject, IamLifecycleStatus, IamMfaPurpose, Prisma, SetLevel } from '@prisma/client';
import { buildScopeKey } from '../src/settings/settings.constants';
import { signLicensePayload } from '../src/license/license-crypto';
import type { LicensePayload } from '../src/license/license.constants';
import { LICENSE_CACHE_KEY } from '../src/license/license.constants';
import { encryptMfaSecret } from '../src/super-admin/mfa-crypto';
import Redis from 'ioredis';
import {
  applyPackToCompany,
  seedIndustryPacks,
} from './industry-packs.seed';
import {
  BUSINESS_ROLE_CODES,
  ROLE_PERMISSION_PACKS,
} from '../src/identity/business-roles';
import { isCataloguedPermission } from '../src/permissions/permission.constants';

const DEMO_USER_EMAIL = 'demo@authority.local';
const DEMO_USER_PASSWORD = 'DemoPass123!';
const SUPER_ADMIN_EMAIL = 'superadmin@authority.local';
const SUPER_ADMIN_PASSWORD = 'SuperAdminPass123!';
/** Dev/test TOTP seed only — never use in production. */
const SUPER_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const LIMITED_USER_EMAIL = 'limited@authority.local';
const LIMITED_USER_PASSWORD = 'LimitedPass123!';
const ACCOUNTANT_USER_EMAIL = 'comptable@authority.local';
const ACCOUNTANT_USER_PASSWORD = 'AccountantPass123!';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed skipped in production.');
    return;
  }

  const company = await prisma.orgCompany.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      code: 'DEMO',
      legalName: 'Fromagerie Demo AUTHORITY',
      country: 'TN',
      currency: 'TND',
      timezone: 'Africa/Tunis',
      status: 'ACTIVE',
    },
  });

  const demoSite = await prisma.orgSite.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'SFX',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      code: 'SFX',
      type: 'USINE',
      timezone: 'Africa/Tunis',
      status: 'ACTIVE',
    },
  });

  await prisma.orgSite.deleteMany({
    where: {
      companyId: company.id,
      code: { not: 'SFX' },
    },
  });

  const otherCompany = await prisma.orgCompany.upsert({
    where: { code: 'OTHER' },
    update: {},
    create: {
      code: 'OTHER',
      legalName: 'Autre Fromagerie (IDOR test)',
      country: 'TN',
      currency: 'TND',
      timezone: 'Africa/Tunis',
      status: 'ACTIVE',
    },
  });

  await prisma.orgSite.upsert({
    where: {
      companyId_code: {
        companyId: otherCompany.id,
        code: 'OTH',
      },
    },
    update: {},
    create: {
      companyId: otherCompany.id,
      code: 'OTH',
      type: 'DEPOT',
      timezone: 'Africa/Tunis',
      status: 'ACTIVE',
    },
  });

  const platformModules = [
    'platform',
    'identity',
    'organization',
    'settings',
    'monitoring',
  ] as const;

  for (const moduleKey of platformModules) {
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company.id,
          moduleKey,
        },
      },
      update: { status: 'ENABLED' },
      create: {
        companyId: company.id,
        moduleKey,
        status: 'ENABLED',
      },
    });
  }

  const businessModules = [
    'sales',
    'inventory',
    'delivery',
    'fleet',
    'maintenance',
    'production',
    'payroll',
    'hr',
    'attendance',
    'tax',
    'customers',
    'suppliers',
    'master_data',
    'products',
    'portals',
    'finance',
    'documents',
    'accounting',
    'repair',
    'backup',
    'automation',
    'forge',
    'analytics',
  ] as const;

  for (const moduleKey of businessModules) {
    const enabled =
      moduleKey === 'master_data' ||
      moduleKey === 'products' ||
      moduleKey === 'customers' ||
      moduleKey === 'suppliers' ||
      moduleKey === 'inventory' ||
      moduleKey === 'sales' ||
      moduleKey === 'delivery' ||
      moduleKey === 'fleet' ||
      moduleKey === 'maintenance' ||
      moduleKey === 'portals' ||
      moduleKey === 'finance' ||
      moduleKey === 'documents' ||
      moduleKey === 'accounting' ||
      moduleKey === 'repair' ||
      moduleKey === 'backup' ||
      moduleKey === 'production' ||
      moduleKey === 'tax' ||
      moduleKey === 'hr' ||
      moduleKey === 'attendance' ||
      moduleKey === 'automation' ||
      moduleKey === 'forge' ||
      moduleKey === 'analytics'
        ? 'ENABLED'
        : 'DISABLED';
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company.id,
          moduleKey,
        },
      },
      update: { status: enabled },
      create: {
        companyId: company.id,
        moduleKey,
        status: enabled,
      },
    });
  }

  await seedTunisiaVatCatalog(prisma, company.id);
  await seedExpertiseOperationalStubs(prisma, company.id);

  await prisma.modFlag.upsert({
    where: {
      companyId_flagKey: {
        companyId: company.id,
        flagKey: 'platform.search',
      },
    },
    update: { enabled: false },
    create: {
      companyId: company.id,
      flagKey: 'platform.search',
      enabled: false,
    },
  });

  const passwordHash = await argon2.hash(DEMO_USER_PASSWORD, {
    type: argon2.argon2id,
  });

  const demoUser = await prisma.iamUser.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {
      passwordHash,
      status: 'ACTIVE',
      displayName: 'Demo Operator',
    },
    create: {
      email: DEMO_USER_EMAIL,
      displayName: 'Demo Operator',
      status: 'ACTIVE',
      passwordHash,
    },
  });

  await prisma.orgUserAssignment.upsert({
    where: {
      companyId_userId: {
        companyId: company.id,
        userId: demoUser.id,
      },
    },
    update: { roleCode: 'admin' },
    create: {
      companyId: company.id,
      userId: demoUser.id,
      roleCode: 'admin',
    },
  });

  const limitedPasswordHash = await argon2.hash(LIMITED_USER_PASSWORD, {
    type: argon2.argon2id,
  });

  const limitedUser = await prisma.iamUser.upsert({
    where: { email: LIMITED_USER_EMAIL },
    update: {
      passwordHash: limitedPasswordHash,
      status: 'ACTIVE',
      displayName: 'Limited Operator',
    },
    create: {
      email: LIMITED_USER_EMAIL,
      displayName: 'Limited Operator',
      status: 'ACTIVE',
      passwordHash: limitedPasswordHash,
    },
  });

  await prisma.orgUserAssignment.upsert({
    where: {
      companyId_userId: {
        companyId: company.id,
        userId: limitedUser.id,
      },
    },
    update: { roleCode: 'operator' },
    create: {
      companyId: company.id,
      userId: limitedUser.id,
      roleCode: 'operator',
    },
  });

  const accountantPasswordHash = await argon2.hash(ACCOUNTANT_USER_PASSWORD, {
    type: argon2.argon2id,
  });

  const accountantUser = await prisma.iamUser.upsert({
    where: { email: ACCOUNTANT_USER_EMAIL },
    update: {
      passwordHash: accountantPasswordHash,
      status: 'ACTIVE',
      displayName: 'Demo Comptable',
    },
    create: {
      email: ACCOUNTANT_USER_EMAIL,
      displayName: 'Demo Comptable',
      status: 'ACTIVE',
      passwordHash: accountantPasswordHash,
    },
  });

  await prisma.orgUserAssignment.upsert({
    where: {
      companyId_userId: {
        companyId: company.id,
        userId: accountantUser.id,
      },
    },
    update: { roleCode: 'accountant' },
    create: {
      companyId: company.id,
      userId: accountantUser.id,
      roleCode: 'accountant',
    },
  });

  await upsertGrant({
    permissionKey: 'identity.self.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
  });
  await upsertGrant({
    permissionKey: 'identity.session.revoke',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
  });
  await upsertGrant({
    permissionKey: 'identity.self.read',
    subjectType: IamGrantSubject.USER,
    subjectId: limitedUser.id,
  });
  await upsertGrant({
    permissionKey: 'identity.session.revoke',
    subjectType: IamGrantSubject.USER,
    subjectId: limitedUser.id,
  });
  await upsertGrant({
    permissionKey: 'identity.self.read',
    subjectType: IamGrantSubject.USER,
    subjectId: accountantUser.id,
  });
  await upsertGrant({
    permissionKey: 'identity.session.revoke',
    subjectType: IamGrantSubject.USER,
    subjectId: accountantUser.id,
  });

  for (const roleCode of BUSINESS_ROLE_CODES) {
    for (const permissionKey of ROLE_PERMISSION_PACKS[roleCode]) {
      if (!isCataloguedPermission(permissionKey)) continue;
      await upsertGrant({
        permissionKey,
        subjectType: IamGrantSubject.ROLE,
        subjectId: roleCode,
        companyId: company.id,
      });
    }
  }

  await upsertGrant({
    permissionKey: 'identity.user.manage',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'platform.file.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
  });
  await upsertGrant({
    permissionKey: 'platform.file.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
  });
  await upsertGrant({
    permissionKey: 'org.site.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'license.manage',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
  });
  await upsertGrant({
    permissionKey: 'platform.numbering.allocate',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'settings.self',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'settings.company.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'thunder.job.enqueue',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'thunder.intel.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'thunder.intel.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'system_monitoring.view',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'products.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'products.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'products.activate',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'master_data.refs.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'master_data.party.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'master_data.party.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'customers.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'customers.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'customers.block',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'customers.credit.set',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'suppliers.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'suppliers.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'suppliers.hold',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'fleet.manage',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'fleet.assign',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'maintenance.asset',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'maintenance.wo',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'inventory.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'inventory.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'inventory.reserve',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'sales.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'sales.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'sales.confirm',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'delivery.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'delivery.prepare',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'delivery.complete',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'delivery.fail',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'finance.ar.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'finance.ar.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'finance.allocate',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'tax.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'tax.rate.manage',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'documents.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'documents.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'automation.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'automation.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'automation.approve',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'forge.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'forge.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'forge.approve',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'analytics.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'accounting.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'accounting.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'accounting.post',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'repair.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'repair.scan',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'repair.execute',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'repair.reset',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.view',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.create',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.verify',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.manage_settings',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.restore',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.specific_folder.view',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.specific_folder.create',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.specific_folder.configure',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.destination.download',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'backup.destination.local_disk',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'production.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'production.wo.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'production.declare',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'production.scrap',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'hr.employee.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'hr.employee.write',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'hr.wage.read',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'attendance.self',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'attendance.manage',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'attendance.approve',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });
  await upsertGrant({
    permissionKey: 'employee_portal.access',
    subjectType: IamGrantSubject.USER,
    subjectId: demoUser.id,
    companyId: company.id,
  });

  for (const zone of [
    { code: 'SF-NORD', name: 'Zone Nord' },
    { code: 'SF-SUD', name: 'Zone Sud' },
  ] as const) {
    await prisma.cusZone.upsert({
      where: {
        companyId_code: {
          companyId: company.id,
          code: zone.code,
        },
      },
      update: {
        name: zone.name,
        active: true,
        deletedAt: null,
      },
      create: {
        companyId: company.id,
        code: zone.code,
        name: zone.name,
        active: true,
      },
    });
  }

  await prisma.invWarehouse.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: 'MAIN',
      },
    },
    update: {
      name: 'Entrepôt principal',
      active: true,
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      code: 'MAIN',
      name: 'Entrepôt principal',
      active: true,
    },
  });

  // Demo customer + product so sales intake autocomplete is never empty
  let demoParty = await prisma.mdParty.findFirst({
    where: {
      companyId: company.id,
      legalName: 'Fromagerie Atlas',
      deletedAt: null,
    },
  });
  if (!demoParty) {
    demoParty = await prisma.mdParty.create({
      data: {
        companyId: company.id,
        type: 'CUSTOMER',
        legalName: 'Fromagerie Atlas',
        status: 'ACTIVE',
      },
    });
  }

  const existingAtlas = await prisma.cusCustomer.findFirst({
    where: {
      companyId: company.id,
      OR: [{ code: 'C-ATLAS' }, { partyId: demoParty.id }],
    },
  });
  if (existingAtlas) {
    await prisma.cusCustomer.update({
      where: { id: existingAtlas.id },
      data: {
        code: 'C-ATLAS',
        nickname: 'Atlas',
        status: 'ACTIVE',
        deletedAt: null,
        partyId: demoParty.id,
      },
    });
  } else {
    await prisma.cusCustomer.create({
      data: {
        companyId: company.id,
        partyId: demoParty.id,
        code: 'C-ATLAS',
        nickname: 'Atlas',
        status: 'ACTIVE',
      },
    });
  }

  await prisma.prdProduct.upsert({
    where: {
      companyId_sku: { companyId: company.id, sku: 'BRIE-250' },
    },
    update: {
      name: 'Brie 250g',
      status: 'ACTIVE',
      trackLot: true,
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      sku: 'BRIE-250',
      name: 'Brie 250g',
      typeKey: 'FINISHED',
      uom: 'kg',
      storageClassKey: 'COLD',
      status: 'ACTIVE',
      trackLot: true,
    },
  });

  await seedFefoDemoLots(company.id);
  await seedCheeseArticles(company.id);
  await seedAgreedPrices(company.id);

  await seedSettingsDefinitions(company.id, demoUser.id);
  await seedAccountingGl(company.id);

  const currentYear = new Date().getFullYear();
  for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
    await prisma.coreNumberingSeries.upsert({
      where: {
        companyId_siteId_docType_year: {
          companyId: company.id,
          siteId: demoSite.id,
          docType: 'INVOICE',
          year,
        },
      },
      update: {
        prefix: 'INV-',
        padding: 6,
      },
      create: {
        companyId: company.id,
        siteId: demoSite.id,
        docType: 'INVOICE',
        year,
        prefix: 'INV-',
        nextValue: 1,
        padding: 6,
      },
    });
  }

  const licensePayload: LicensePayload = {
    plan: 'demo',
    maxSites: 2,
    maxUsers: 50,
    expiresAt: '2027-12-31T23:59:59.000Z',
    issuedAt: new Date().toISOString(),
  };
  const licenseSignature = signLicensePayload(licensePayload);
  const existingLicense = await prisma.licCurrent.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existingLicense) {
    await prisma.licCurrent.update({
      where: { id: existingLicense.id },
      data: {
        payloadJson: licensePayload as unknown as Prisma.InputJsonValue,
        signature: licenseSignature,
        lastOnlineAt: new Date(),
      },
    });
  } else {
    await prisma.licCurrent.create({
      data: {
        payloadJson: licensePayload as unknown as Prisma.InputJsonValue,
        signature: licenseSignature,
        lastOnlineAt: new Date(),
      },
    });
  }

  await clearLicenseCache();

  const superAdminPasswordHash = await argon2.hash(SUPER_ADMIN_PASSWORD, {
    type: argon2.argon2id,
  });

  const superAdmin = await prisma.iamUser.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      passwordHash: superAdminPasswordHash,
      status: 'ACTIVE',
      displayName: 'Super Admin',
      mfaEnabled: true,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      displayName: 'Super Admin',
      status: 'ACTIVE',
      passwordHash: superAdminPasswordHash,
      mfaEnabled: true,
    },
  });

  await prisma.iamSuperAdminMembership.upsert({
    where: { userId: superAdmin.id },
    update: { status: IamLifecycleStatus.ACTIVE },
    create: {
      userId: superAdmin.id,
      status: IamLifecycleStatus.ACTIVE,
    },
  });

  const existingSaMfa = await prisma.iamMfaDevice.findFirst({
    where: {
      userId: superAdmin.id,
      purpose: IamMfaPurpose.SUPER_ADMIN,
      status: IamLifecycleStatus.ACTIVE,
    },
  });

  if (!existingSaMfa) {
    await prisma.iamMfaDevice.create({
      data: {
        userId: superAdmin.id,
        purpose: IamMfaPurpose.SUPER_ADMIN,
        secretEnc: encryptMfaSecret(SUPER_ADMIN_TOTP_SECRET),
        status: IamLifecycleStatus.ACTIVE,
      },
    });
  } else {
    await prisma.iamMfaDevice.update({
      where: { id: existingSaMfa.id },
      data: {
        secretEnc: encryptMfaSecret(SUPER_ADMIN_TOTP_SECRET),
        status: IamLifecycleStatus.ACTIVE,
      },
    });
  }

  await clearLicenseCache();

  await seedIndustryPacks(prisma);
  await applyPackToCompany(prisma, company.id, 'dairy');

  // Customer Portal P1 — demo user + membership (membership-only access)
  const PORTAL_USER_EMAIL = 'portal@authority.local';
  const PORTAL_USER_PASSWORD = 'PortalPass123!';

  const portalPasswordHash = await argon2.hash(PORTAL_USER_PASSWORD, {
    type: argon2.argon2id,
  });

  const portalUser = await prisma.iamUser.upsert({
    where: { email: PORTAL_USER_EMAIL },
    update: {
      passwordHash: portalPasswordHash,
      status: 'ACTIVE',
      displayName: 'Portal Demo Buyer',
      mfaEnabled: false,
    },
    create: {
      email: PORTAL_USER_EMAIL,
      displayName: 'Portal Demo Buyer',
      status: 'ACTIVE',
      passwordHash: portalPasswordHash,
      mfaEnabled: false,
    },
  });

  let portalParty = await prisma.mdParty.findFirst({
    where: {
      companyId: company.id,
      legalName: 'Portal Demo Customer',
      deletedAt: null,
    },
  });
  if (!portalParty) {
    portalParty = await prisma.mdParty.create({
      data: {
        companyId: company.id,
        type: 'CUSTOMER',
        legalName: 'Portal Demo Customer',
        status: 'ACTIVE',
      },
    });
  }

  let portalCustomer = await prisma.cusCustomer.findFirst({
    where: {
      companyId: company.id,
      OR: [{ code: 'PORTAL-DEMO' }, { partyId: portalParty.id }],
    },
  });
  if (portalCustomer) {
    portalCustomer = await prisma.cusCustomer.update({
      where: { id: portalCustomer.id },
      data: {
        code: 'PORTAL-DEMO',
        nickname: 'Portal Demo',
        status: 'ACTIVE',
        deletedAt: null,
        partyId: portalParty.id,
      },
    });
  } else {
    portalCustomer = await prisma.cusCustomer.create({
      data: {
        companyId: company.id,
        partyId: portalParty.id,
        code: 'PORTAL-DEMO',
        nickname: 'Portal Demo',
        status: 'ACTIVE',
      },
    });
  }

  const existingPortalMem = await prisma.ptlMembership.findFirst({
    where: {
      companyId: company.id,
      userId: portalUser.id,
      customerId: portalCustomer.id,
    },
  });
  if (existingPortalMem) {
    await prisma.ptlMembership.update({
      where: { id: existingPortalMem.id },
      data: {
        role: 'buyer',
        status: IamLifecycleStatus.ACTIVE,
      },
    });
  } else {
    await prisma.ptlMembership.create({
      data: {
        companyId: company.id,
        userId: portalUser.id,
        customerId: portalCustomer.id,
        role: 'buyer',
        status: IamLifecycleStatus.ACTIVE,
      },
    });
  }

  // Portal P3 — sample prior order so catalog lastUnitPrice works for create
  const portalWh = await prisma.invWarehouse.findFirst({
    where: { companyId: company.id, code: 'MAIN', deletedAt: null },
  });
  const portalProduct = await prisma.prdProduct.findFirst({
    where: {
      companyId: company.id,
      sku: 'BRIE-250',
      deletedAt: null,
    },
  });
  if (portalWh && portalProduct) {
    const existingPortalOrder = await prisma.salOrder.findFirst({
      where: {
        companyId: company.id,
        customerId: portalCustomer.id,
        number: 'SO-PORTAL-SEED',
      },
    });
    if (!existingPortalOrder) {
      await prisma.salOrder.create({
        data: {
          companyId: company.id,
          number: 'SO-PORTAL-SEED',
          customerId: portalCustomer.id,
          warehouseId: portalWh.id,
          requestedDate: new Date(),
          currency: 'TND',
          notes: null,
          preferredDriver: null,
          amountTotal: 50,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          lines: {
            create: [
              {
                companyId: company.id,
                lineNo: 1,
                productId: portalProduct.id,
                qty: 10,
                unitPrice: 5,
                discountPct: 0,
                lineTotal: 50,
              },
            ],
          },
        },
      });
    }

    const portalOrder = await prisma.salOrder.findFirst({
      where: {
        companyId: company.id,
        customerId: portalCustomer.id,
        number: 'SO-PORTAL-SEED',
      },
    });
    if (portalOrder) {
      const existingShip = await prisma.dlvShipment.findFirst({
        where: {
          companyId: company.id,
          number: 'DLV-PORTAL-SEED',
        },
      });
      if (!existingShip) {
        const assignedAt = new Date();
        assignedAt.setHours(assignedAt.getHours() - 3);
        const dispatchedAt = new Date();
        dispatchedAt.setHours(dispatchedAt.getHours() - 1);
        await prisma.dlvShipment.create({
          data: {
            companyId: company.id,
            number: 'DLV-PORTAL-SEED',
            orderId: portalOrder.id,
            customerId: portalCustomer.id,
            warehouseId: portalWh.id,
            status: 'OUT',
            driverLabel: 'Karim Ben Salah',
            preferredDriver: portalOrder.preferredDriver,
            assignedAt,
            dispatchedAt,
          },
        });
      }

      const existingFin = await prisma.finOpenItem.findFirst({
        where: {
          companyId: company.id,
          number: 'FIN-PORTAL-SEED',
        },
      });
      if (!existingFin) {
        await prisma.finOpenItem.create({
          data: {
            companyId: company.id,
            number: 'FIN-PORTAL-SEED',
            customerId: portalCustomer.id,
            side: 'AR',
            status: 'OPEN',
            salesOrderId: portalOrder.id,
            currency: 'TND',
            amountTotal: 50,
            amountOpen: 50,
            dueDate: new Date(Date.now() + 14 * 86400000),
            label: 'Créance démo portal (montant enregistré — pas de TVA calculée)',
            notes: null,
          },
        });
      }

      const portalOpenItem = await prisma.finOpenItem.findFirst({
        where: {
          companyId: company.id,
          number: 'FIN-PORTAL-SEED',
        },
      });

      const existingInv = await prisma.finInvoice.findFirst({
        where: {
          companyId: company.id,
          number: 'INV-PORTAL-SEED',
        },
      });
      if (!existingInv) {
        const issuedAt = new Date();
        const dueDate = new Date(Date.now() + 14 * 86400000);
        const tva19 = await prisma.taxCode.findFirst({
          where: { companyId: company.id, code: 'TVA19', deletedAt: null },
        });
        // 50.000 TTC @ 19% → HT = 50/1.19 ≈ 42.017, tax ≈ 7.983
        const amountHt = 42.017;
        const amountTax = 7.983;
        const amountTotal = 50;
        const invoice = await prisma.finInvoice.create({
          data: {
            companyId: company.id,
            number: 'INV-PORTAL-SEED',
            customerId: portalCustomer.id,
            status: 'ISSUED',
            salesOrderId: portalOrder.id,
            currency: 'TND',
            amountTotal,
            amountHt,
            amountTax,
            dueDate,
            issuedAt,
            label: 'Facture démo portal (TVA 19% Code TVA)',
            notes: 'INTERNAL — never returned to portal',
            ...(tva19
              ? {
                  lines: {
                    create: [
                      {
                        companyId: company.id,
                        lineNo: 1,
                        description: 'Livraison démo portal',
                        qty: 1,
                        unitPriceHt: amountHt,
                        taxCodeId: tva19.id,
                        amountHt,
                        amountTax,
                        amountTtc: amountTotal,
                      },
                    ],
                  },
                }
              : {}),
          },
        });
        if (portalOpenItem && !portalOpenItem.invoiceId) {
          await prisma.finOpenItem.update({
            where: { id: portalOpenItem.id },
            data: { invoiceId: invoice.id },
          });
        }
      } else {
        const lineCount = await prisma.finInvoiceLine.count({
          where: { invoiceId: existingInv.id },
        });
        if (lineCount === 0) {
          const tva19 = await prisma.taxCode.findFirst({
            where: { companyId: company.id, code: 'TVA19', deletedAt: null },
          });
          if (tva19) {
            const amountHt = 42.017;
            const amountTax = 7.983;
            await prisma.finInvoice.update({
              where: { id: existingInv.id },
              data: {
                amountHt,
                amountTax,
                label: 'Facture démo portal (TVA 19% Code TVA)',
              },
            });
            await prisma.finInvoiceLine.create({
              data: {
                companyId: company.id,
                invoiceId: existingInv.id,
                lineNo: 1,
                description: 'Livraison démo portal',
                qty: 1,
                unitPriceHt: amountHt,
                taxCodeId: tva19.id,
                amountHt,
                amountTax,
                amountTtc: 50,
              },
            });
          }
        }
      }

      const ptpOpenItem = await prisma.finOpenItem.findFirst({
        where: {
          companyId: company.id,
          number: 'FIN-PORTAL-SEED',
        },
      });
      if (ptpOpenItem) {
        const existingPtp = await prisma.finPromiseToPay.findFirst({
          where: {
            companyId: company.id,
            number: 'PTP-SEED-0001',
          },
        });
        if (!existingPtp) {
          await prisma.finPromiseToPay.create({
            data: {
              companyId: company.id,
              number: 'PTP-SEED-0001',
              customerId: ptpOpenItem.customerId,
              openItemId: ptpOpenItem.id,
              amount: 25,
              currency: 'TND',
              promisedDate: new Date(Date.now() + 7 * 86400000),
              status: 'OPEN',
              notes: 'Promesse démo collections (D087)',
            },
          });
        }
      }

      const existingClaim = await prisma.ptlClaim.findFirst({
        where: {
          companyId: company.id,
          number: 'CLM-PORTAL-SEED',
        },
      });
      let portalClaimId = existingClaim?.id ?? null;
      if (!existingClaim) {
        const ship = await prisma.dlvShipment.findFirst({
          where: {
            companyId: company.id,
            number: 'DLV-PORTAL-SEED',
          },
        });
        const created = await prisma.ptlClaim.create({
          data: {
            companyId: company.id,
            customerId: portalCustomer.id,
            number: 'CLM-PORTAL-SEED',
            type: 'DELIVERY',
            status: 'OPEN',
            subject: 'Livraison — carton endommagé (démo)',
            description:
              'Réclamation démo portal : carton partiellement ouvert. Pièce DOC-PORTAL-SEED visible sur /portal/documents.',
            orderId: portalOrder.id,
            shipmentId: ship?.id ?? null,
            createdByUserId: portalUser.id,
          },
        });
        portalClaimId = created.id;
      }

      await seedPortalDocument({
        companyId: company.id,
        customerId: portalCustomer.id,
        claimId: portalClaimId,
        actorUserId: demoUser.id,
      });
    }
  }

  // D218 — Employee Portal: link demo user to an ACTIVE employee (HrEmployee.userId)
  const existingDemoEmployee = await prisma.hrEmployee.findFirst({
    where: {
      companyId: company.id,
      OR: [{ userId: demoUser.id }, { matricule: 'EMP-DEMO' }],
      deletedAt: null,
    },
  });
  if (existingDemoEmployee) {
    if (!existingDemoEmployee.userId) {
      await prisma.hrEmployee.update({
        where: { id: existingDemoEmployee.id },
        data: { userId: demoUser.id, status: 'ACTIVE', deletedAt: null },
      });
    }
  } else {
    await prisma.hrEmployee.create({
      data: {
        companyId: company.id,
        matricule: 'EMP-DEMO',
        displayName: 'Demo Operator',
        siteId: demoSite.id,
        email: DEMO_USER_EMAIL,
        userId: demoUser.id,
        status: 'ACTIVE',
        notes:
          'Seed D218 — linked to demo@authority.local for /employee-portal',
      },
    });
  }

  console.log(
    `Seed OK — company ${company.code}, site ${demoSite.code}, other ${otherCompany.code}, user ${DEMO_USER_EMAIL}, limited ${LIMITED_USER_EMAIL}, accountant ${ACCOUNTANT_USER_EMAIL}, super-admin ${SUPER_ADMIN_EMAIL}, portal ${PORTAL_USER_EMAIL}, employee-portal ${DEMO_USER_EMAIL}`,
  );
}

async function seedSettingsDefinitions(
  companyId: string,
  demoUserId: string,
): Promise<void> {
  const definitions = [
    {
      key: 'ui.locale',
      valueType: 'enum',
      defaultJson: 'fr-TN',
      description: 'Interface language',
      isPrefOnly: true,
    },
    {
      key: 'ui.theme',
      valueType: 'enum',
      defaultJson: 'system',
      description: 'Color theme',
      isPrefOnly: true,
    },
    {
      key: 'ui.density',
      valueType: 'enum',
      defaultJson: 'comfortable',
      description: 'UI density',
      isPrefOnly: true,
    },
    {
      key: 'sales.reserve_on_confirm',
      valueType: 'boolean',
      defaultJson: true,
      description: 'Reserve stock automatically on sales order confirm',
      isPrefOnly: true,
    },
    {
      key: 'sales.auto_confirm_on_create',
      valueType: 'boolean',
      defaultJson: false,
      description: 'Auto-run confirm+reserve workflow after creating a draft',
      isPrefOnly: false,
    },
    {
      key: 'sales.require_requested_date',
      valueType: 'boolean',
      defaultJson: false,
      description: 'Require requested delivery date on order intake',
      isPrefOnly: false,
    },
    {
      key: 'sales.allow_manual_price',
      valueType: 'boolean',
      defaultJson: true,
      description: 'Allow manual unit price on order lines (V0 without pricing engine)',
      isPrefOnly: false,
    },
    {
      key: 'sales.default_currency',
      valueType: 'string',
      defaultJson: 'TND',
      description: 'Default currency for sales orders',
      isPrefOnly: false,
    },
    {
      key: 'inventory.daily_lot_gen.hour_tunis',
      valueType: 'number',
      defaultJson: 0,
      description:
        'Hour (0–23) in Africa/Tunis for daily cheese lot generation (D100 default midnight)',
      isPrefOnly: false,
    },
    {
      key: 'inventory.daily_lot_gen.tz',
      valueType: 'string',
      defaultJson: 'Africa/Tunis',
      description: 'Timezone for daily cheese lot generation',
      isPrefOnly: false,
    },
    {
      key: 'salubrita.outlook.from_email',
      valueType: 'string',
      defaultJson: '',
      description:
        'Adresse expéditeur Outlook/mailto pour certificats (vide jusqu’à saisie humaine)',
      isPrefOnly: true,
    },
    {
      key: 'salubrita.whatsapp.default_prefix',
      valueType: 'string',
      defaultJson: '',
      description:
        'Préfixe téléphone WhatsApp (ex. 216) — vide jusqu’à saisie humaine',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.ttl_days',
      valueType: 'number',
      defaultJson: 7,
      description: 'Durée de validité du lien d’invitation (jours)',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.min_password_length',
      valueType: 'number',
      defaultJson: 8,
      description: 'Longueur minimale du mot de passe à l’acceptation invite',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.auto_send',
      valueType: 'boolean',
      defaultJson: true,
      description:
        'Si true et SMTP configuré, envoi auto à invite/reinvite',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.email_subject',
      valueType: 'string',
      defaultJson: 'Invitation AUTHORITY',
      description: 'Objet e-mail d’invitation',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.email_body_text',
      valueType: 'string',
      defaultJson:
        'Bonjour {{displayName}},\n\nVous êtes invité(e) sur AUTHORITY.\nDéfinissez votre mot de passe via ce lien (valide {{ttlDays}} jours) :\n{{inviteUrl}}\n\n— AUTHORITY',
      description:
        'Corps texte invitation — placeholders {{displayName}} {{inviteUrl}} {{ttlDays}} {{email}}',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.email_body_html',
      valueType: 'string',
      defaultJson:
        '<p>Bonjour {{displayName}},</p><p>Vous êtes invité(e) sur <strong>AUTHORITY</strong>.</p><p><a href="{{inviteUrl}}">Définir mon mot de passe</a> (valide {{ttlDays}} jours).</p><p>— AUTHORITY</p>',
      description:
        'Corps HTML invitation — mêmes placeholders (displayName échappé)',
      isPrefOnly: true,
    },
    {
      key: 'identity.invite.web_origin',
      valueType: 'string',
      defaultJson: '',
      description:
        'Base URL publique des liens invite (vide = AUTHORITY_WEB_ORIGIN / localhost:3000)',
      isPrefOnly: true,
    },
    {
      key: 'identity.smtp.host',
      valueType: 'string',
      defaultJson: '',
      description: 'Hôte SMTP société (vide = fallback env SMTP_HOST)',
      isPrefOnly: true,
    },
    {
      key: 'identity.smtp.port',
      valueType: 'number',
      defaultJson: 587,
      description: 'Port SMTP',
      isPrefOnly: true,
    },
    {
      key: 'identity.smtp.secure',
      valueType: 'boolean',
      defaultJson: false,
      description: 'SMTP TLS implicite (true pour 465)',
      isPrefOnly: true,
    },
    {
      key: 'identity.smtp.user',
      valueType: 'string',
      defaultJson: '',
      description: 'Utilisateur SMTP',
      isPrefOnly: true,
    },
    {
      key: 'identity.smtp.pass',
      valueType: 'string',
      defaultJson: '',
      description: 'Mot de passe SMTP (secret société)',
      isPrefOnly: true,
    },
    {
      key: 'identity.smtp.from',
      valueType: 'string',
      defaultJson: '',
      description: 'Expéditeur From (ex. AUTHORITY <noreply@entreprise.tn>)',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.smtp.host',
      valueType: 'string',
      defaultJson: '',
      description:
        'Dunning SMTP host (finance-dedicated — empty until human, D194)',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.smtp.port',
      valueType: 'number',
      defaultJson: 587,
      description: 'Dunning SMTP port',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.smtp.secure',
      valueType: 'boolean',
      defaultJson: false,
      description: 'Dunning SMTP TLS (true for 465)',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.smtp.user',
      valueType: 'string',
      defaultJson: '',
      description: 'Dunning SMTP user',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.smtp.pass',
      valueType: 'string',
      defaultJson: '',
      description: 'Dunning SMTP password (write-only secret)',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.smtp.from',
      valueType: 'string',
      defaultJson: '',
      description: 'Dunning SMTP From header',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.wa.phone_number_id',
      valueType: 'string',
      defaultJson: '',
      description:
        'WhatsApp Cloud API phone number id (empty until human, D194)',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.wa.access_token',
      valueType: 'string',
      defaultJson: '',
      description: 'WhatsApp Cloud API access token (write-only secret)',
      isPrefOnly: true,
    },
    {
      key: 'finance.dunning.wa.api_version',
      valueType: 'string',
      defaultJson: 'v21.0',
      description: 'WhatsApp Graph API version',
      isPrefOnly: true,
    },
    {
      key: 'ops.unlock_code',
      valueType: 'string',
      defaultJson: '3141',
      description:
        'Calculator PIN to exit SPECTRE/PATCH/GHOST (company Admin, 4–12 digits)',
      isPrefOnly: true,
    },
    {
      key: 'finance.credit.enforce',
      valueType: 'boolean',
      defaultJson: false,
      description:
        'When true, deny sales confirm if outstanding + order exceeds customer creditLimit',
      isPrefOnly: false,
    },
    {
      key: 'finance.collection.remind_days',
      valueType: 'json',
      defaultJson: [1, 7, 15, 30],
      description:
        'Collection milestones as days past due (JSON array). Empty = any overdue. Not tax rates.',
      isPrefOnly: true,
    },
    {
      key: 'finance.credit.warn_ratio',
      valueType: 'number',
      defaultJson: 0.8,
      description:
        'FIN-INTEL credit pressure warn when outstanding/limit ≥ ratio (0–1). Breach at ≥1. Not tax.',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.ar',
      valueType: 'string',
      defaultJson: '411',
      description: 'GL account code for Accounts Receivable (Finance→GL)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.bank',
      valueType: 'string',
      defaultJson: '512',
      description: 'GL account code for Bank (Finance→GL payment)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.revenue',
      valueType: 'string',
      defaultJson: '701',
      description: 'GL account code for Revenue (Finance→GL invoice)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.vat',
      valueType: 'string',
      defaultJson: '4367',
      description:
        'GL account code for VAT collected (as-recorded amounts only — not a tax rate)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.ap',
      valueType: 'string',
      defaultJson: '401',
      description: 'GL account code for Accounts Payable (AP→GL D273)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.expense',
      valueType: 'string',
      defaultJson: '601',
      description: 'GL account code for AP bill expense / purchases (D273)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.sales_journal',
      valueType: 'string',
      defaultJson: 'VEN',
      description: 'Sales journal code for invoice GL posting',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.bank_journal',
      valueType: 'string',
      defaultJson: 'BQ',
      description: 'Bank journal code for payment / AP payment GL posting',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.purchases_journal',
      valueType: 'string',
      defaultJson: 'ACH',
      description: 'Purchases journal code for AP bill GL posting (D273)',
      isPrefOnly: true,
    },
    {
      key: 'accounting.gl.bank_fee',
      valueType: 'string',
      defaultJson: '',
      description:
        'GL account code for bank fees — empty until human Prefs (D193). Not a tax rate.',
      isPrefOnly: true,
    },
    {
      key: 'ops.ghost.hide_delivery',
      valueType: 'boolean',
      defaultJson: true,
      description: 'GHOST mode: hide Delivery (BL) from navigation',
      isPrefOnly: true,
    },
    {
      key: 'ops.patch.hide_delivery',
      valueType: 'boolean',
      defaultJson: true,
      description: 'PATCH mode: hide Delivery (BL) from navigation',
      isPrefOnly: true,
    },
    {
      key: 'ops.patch.accounting_partial',
      valueType: 'boolean',
      defaultJson: true,
      description:
        'PATCH mode: CoA only (hide entries / trial balance / mapping write)',
      isPrefOnly: true,
    },
    {
      key: 'ops.ghost.accounting_partial',
      valueType: 'boolean',
      defaultJson: false,
      description:
        'GHOST mode: CoA only (hide entries / trial balance / mapping write)',
      isPrefOnly: true,
    },
  ] as const;

  for (const definition of definitions) {
    await prisma.setDef.upsert({
      where: { key: definition.key },
      update: {
        valueType: definition.valueType,
        defaultJson: definition.defaultJson,
        description: definition.description,
        isPrefOnly: definition.isPrefOnly,
      },
      create: {
        key: definition.key,
        valueType: definition.valueType,
        defaultJson: definition.defaultJson,
        description: definition.description,
        isPrefOnly: definition.isPrefOnly,
      },
    });
  }

  await upsertSettingValue({
    defKey: 'sales.reserve_on_confirm',
    level: SetLevel.COMPANY,
    companyId,
    subjectId: companyId,
    valueJson: true,
  });
  await upsertSettingValue({
    defKey: 'sales.auto_confirm_on_create',
    level: SetLevel.COMPANY,
    companyId,
    subjectId: companyId,
    valueJson: false,
  });

  await upsertSettingValue({
    defKey: 'finance.credit.enforce',
    level: SetLevel.COMPANY,
    companyId,
    subjectId: companyId,
    valueJson: false,
  });

  await upsertSettingValue({
    defKey: 'ui.theme',
    level: SetLevel.COMPANY,
    companyId,
    subjectId: companyId,
    valueJson: 'dark',
  });

  await upsertSettingValue({
    defKey: 'ui.density',
    level: SetLevel.ROLE,
    companyId,
    subjectId: 'operator',
    valueJson: 'compact',
  });

  await upsertSettingValue({
    defKey: 'ui.theme',
    level: SetLevel.USER,
    companyId,
    subjectId: demoUserId,
    valueJson: 'light',
  });
}

async function upsertSettingValue(params: {
  defKey: string;
  level: SetLevel;
  companyId: string;
  subjectId: string;
  valueJson: string | boolean | number;
}): Promise<void> {
  const scopeKey = buildScopeKey(params.level, {
    companyId: params.companyId,
    subjectId: params.subjectId,
  });

  await prisma.setValue.upsert({
    where: {
      defKey_scopeKey: {
        defKey: params.defKey,
        scopeKey,
      },
    },
    update: {
      valueJson: params.valueJson,
      deletedAt: null,
      level: params.level,
      companyId: params.companyId,
    },
    create: {
      defKey: params.defKey,
      level: params.level,
      scopeKey,
      companyId: params.companyId,
      valueJson: params.valueJson,
    },
  });
}

async function upsertGrant(params: {
  permissionKey: string;
  subjectType: IamGrantSubject;
  subjectId: string;
  companyId?: string;
  effect?: IamGrantEffect;
}) {
  const existing = await prisma.iamGrant.findFirst({
    where: {
      permissionKey: params.permissionKey,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      companyId: params.companyId ?? null,
      effect: params.effect ?? IamGrantEffect.ALLOW,
    },
  });

  if (existing) {
    await prisma.iamGrant.update({
      where: { id: existing.id },
      data: { status: IamLifecycleStatus.ACTIVE },
    });
    return;
  }

  await prisma.iamGrant.create({
    data: {
      permissionKey: params.permissionKey,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      companyId: params.companyId,
      effect: params.effect ?? IamGrantEffect.ALLOW,
      status: IamLifecycleStatus.ACTIVE,
    },
  });
}

async function seedPortalDocument(input: {
  companyId: string;
  customerId: string;
  claimId: string | null;
  actorUserId: string;
}): Promise<void> {
  if (!input.claimId) {
    return;
  }

  const existing = await prisma.docDocument.findFirst({
    where: {
      companyId: input.companyId,
      number: 'DOC-PORTAL-SEED',
    },
  });
  if (existing) {
    return;
  }

  const {
    CreateBucketCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
  } = await import('@aws-sdk/client-s3');
  const { randomUUID } = await import('node:crypto');

  const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
  const port = process.env.MINIO_PORT ?? '9000';
  const useSsl = process.env.MINIO_USE_SSL === 'true';
  const accessKey = process.env.MINIO_ACCESS_KEY ?? 'authority';
  const secretKey = process.env.MINIO_SECRET_KEY ?? 'authoritydev';
  const bucket = process.env.MINIO_BUCKET ?? 'authority';

  const client = new S3Client({
    endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });

  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    const fileId = randomUUID();
    const key = `companies/${input.companyId}/${fileId}`;
    const body = Buffer.from(
      'AUTHORITY portal demo document\nLinked to CLM-PORTAL-SEED\n',
      'utf8',
    );
    const mime = 'text/plain';

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );

    await prisma.coreFile.create({
      data: {
        id: fileId,
        companyId: input.companyId,
        bucket,
        key,
        mime,
        size: BigInt(body.length),
      },
    });

    await prisma.docDocument.create({
      data: {
        companyId: input.companyId,
        number: 'DOC-PORTAL-SEED',
        title: 'Preuve réclamation (démo portal)',
        mime,
        size: BigInt(body.length),
        coreFileId: fileId,
        visibility: 'CUSTOMER_PORTAL',
        linkType: 'CLAIM',
        linkId: input.claimId,
        customerId: input.customerId,
        createdByUserId: input.actorUserId,
      },
    });
  } catch (error) {
    console.warn(
      `Seed DOC-PORTAL-SEED skipped (MinIO?): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function seedAccountingGl(companyId: string): Promise<void> {
  for (const account of [
    { code: '411', name: 'Clients', type: 'ASSET' as const },
    { code: '512', name: 'Banque', type: 'ASSET' as const },
    { code: '701', name: 'Ventes', type: 'REVENUE' as const },
    {
      code: '4367',
      name: 'TVA collectée',
      type: 'LIABILITY' as const,
    },
    { code: '401', name: 'Fournisseurs', type: 'LIABILITY' as const },
    { code: '601', name: 'Achats', type: 'EXPENSE' as const },
  ]) {
    await prisma.accAccount.upsert({
      where: {
        companyId_code: { companyId, code: account.code },
      },
      update: {
        name: account.name,
        type: account.type,
        active: true,
        deletedAt: null,
      },
      create: {
        companyId,
        code: account.code,
        name: account.name,
        type: account.type,
        active: true,
      },
    });
  }

  await prisma.accJournal.upsert({
    where: {
      companyId_code: { companyId, code: 'VEN' },
    },
    update: {
      name: 'Journal des ventes',
      active: true,
      deletedAt: null,
    },
    create: {
      companyId,
      code: 'VEN',
      name: 'Journal des ventes',
      active: true,
    },
  });

  await prisma.accJournal.upsert({
    where: {
      companyId_code: { companyId, code: 'BQ' },
    },
    update: {
      name: 'Journal de banque',
      active: true,
      deletedAt: null,
    },
    create: {
      companyId,
      code: 'BQ',
      name: 'Journal de banque',
      active: true,
    },
  });

  await prisma.accJournal.upsert({
    where: {
      companyId_code: { companyId, code: 'ACH' },
    },
    update: {
      name: 'Journal des achats',
      active: true,
      deletedAt: null,
    },
    create: {
      companyId,
      code: 'ACH',
      name: 'Journal des achats',
      active: true,
    },
  });

  const year = await prisma.accFiscalYear.upsert({
    where: {
      companyId_code: { companyId, code: '2026' },
    },
    update: {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      deletedAt: null,
    },
    create: {
      companyId,
      code: '2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    },
  });

  for (let month = 1; month <= 12; month += 1) {
    const code = `2026-${String(month).padStart(2, '0')}`;
    const startDate = new Date(Date.UTC(2026, month - 1, 1));
    const endDate = new Date(Date.UTC(2026, month, 0));
    await prisma.accFiscalPeriod.upsert({
      where: {
        companyId_code: { companyId, code },
      },
      update: {
        fiscalYearId: year.id,
        startDate,
        endDate,
        status: 'OPEN',
        deletedAt: null,
      },
      create: {
        companyId,
        fiscalYearId: year.id,
        code,
        startDate,
        endDate,
        status: 'OPEN',
      },
    });
  }
}

/** D099 — demo OPEN lots with staggered DLC so FEFO pick is visible (no tax rates). */
async function seedFefoDemoLots(companyId: string): Promise<void> {
  const warehouse = await prisma.invWarehouse.findFirst({
    where: { companyId, code: 'MAIN', deletedAt: null },
  });
  const product = await prisma.prdProduct.findFirst({
    where: { companyId, sku: 'BRIE-250', deletedAt: null },
  });
  if (!warehouse || !product) return;

  const lots: Array<{ lotCode: string; qty: string; dlc: string }> = [
    { lotCode: 'LOT-FEFO-SOON', qty: '40', dlc: '2026-10-15' },
    { lotCode: 'LOT-FEFO-MID', qty: '60', dlc: '2026-11-20' },
    { lotCode: 'LOT-FEFO-LATE', qty: '50', dlc: '2027-01-10' },
  ];

  let totalOnHand = new Prisma.Decimal(0);
  for (const lot of lots) {
    const qty = new Prisma.Decimal(lot.qty);
    totalOnHand = totalOnHand.add(qty);
    await prisma.invLot.upsert({
      where: {
        companyId_warehouseId_productId_lotCode: {
          companyId,
          warehouseId: warehouse.id,
          productId: product.id,
          lotCode: lot.lotCode,
        },
      },
      update: {
        qtyOnHand: qty,
        qtyReserved: new Prisma.Decimal(0),
        dlc: new Date(`${lot.dlc}T00:00:00.000Z`),
        status: 'OPEN',
      },
      create: {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
        lotCode: lot.lotCode,
        qtyOnHand: qty,
        qtyReserved: new Prisma.Decimal(0),
        dlc: new Date(`${lot.dlc}T00:00:00.000Z`),
        status: 'OPEN',
      },
    });
  }

  await prisma.invBalance.upsert({
    where: {
      companyId_warehouseId_productId: {
        companyId,
        warehouseId: warehouse.id,
        productId: product.id,
      },
    },
    update: {
      onHand: totalOnHand,
      reserved: new Prisma.Decimal(0),
    },
    create: {
      companyId,
      warehouseId: warehouse.id,
      productId: product.id,
      onHand: totalOnHand,
      reserved: new Prisma.Decimal(0),
    },
  });
}

/** D100/D102 — products with shelf-life (catalogue) + legacy cheese article sync. */
async function seedCheeseArticles(companyId: string): Promise<void> {
  const defs: Array<{
    sku: string;
    name: string;
    shelfLifeDays: number;
    productionOffsetDays: number;
    notes: string;
  }> = [
    {
      sku: 'BRIE-250',
      name: 'Brie 250g',
      shelfLifeDays: 30,
      productionOffsetDays: 30,
      notes: 'Pâte molle — DLC = emballage + 30 j',
    },
    {
      sku: 'MOZ-FIOR',
      name: 'Mozzarella fior di latte',
      shelfLifeDays: 7,
      productionOffsetDays: 0,
      notes: 'Frais — prod = emballage · DLC + 7 j',
    },
    {
      sku: 'GRUY-AFF',
      name: 'Gruyère affiné',
      shelfLifeDays: 60,
      productionOffsetDays: 30,
      notes: 'Affiné — prod = emballage − 30 j · DLC + 60 j',
    },
  ];

  for (const d of defs) {
    const product = await prisma.prdProduct.upsert({
      where: { companyId_sku: { companyId, sku: d.sku } },
      update: {
        name: d.name,
        status: 'ACTIVE',
        trackLot: true,
        perishable: true,
        shelfLifeDays: d.shelfLifeDays,
        productionOffsetDays: d.productionOffsetDays,
        deletedAt: null,
      },
      create: {
        companyId,
        sku: d.sku,
        name: d.name,
        typeKey: 'FINISHED',
        uom: 'kg',
        storageClassKey: 'COLD',
        status: 'ACTIVE',
        trackLot: true,
        perishable: true,
        shelfLifeDays: d.shelfLifeDays,
        productionOffsetDays: d.productionOffsetDays,
      },
    });

    await prisma.invCheeseArticle.upsert({
      where: {
        companyId_productId: {
          companyId,
          productId: product.id,
        },
      },
      update: {
        shelfLifeDays: d.shelfLifeDays,
        active: true,
        notes: d.notes,
      },
      create: {
        companyId,
        productId: product.id,
        shelfLifeDays: d.shelfLifeDays,
        active: true,
        notes: d.notes,
      },
    });
  }
}

/** D174 — negotiated HT prices for ADV + portal demo customers. */
async function seedAgreedPrices(companyId: string): Promise<void> {
  const customers = await prisma.cusCustomer.findMany({
    where: {
      companyId,
      deletedAt: null,
      code: { in: ['C-ATLAS', 'PORTAL-DEMO'] },
    },
    select: { id: true, code: true },
  });
  const products = await prisma.prdProduct.findMany({
    where: {
      companyId,
      deletedAt: null,
      sku: { in: ['BRIE-250', 'MOZ-FIOR', 'GRUY-AFF'] },
    },
    select: { id: true, sku: true },
  });
  const priceBySku: Record<string, number> = {
    'BRIE-250': 5.25,
    'MOZ-FIOR': 4.8,
    'GRUY-AFF': 7.1,
  };
  for (const customer of customers) {
    for (const product of products) {
      const unitPriceHt = priceBySku[product.sku];
      if (unitPriceHt == null) continue;
      await prisma.cusCustomerPrice.upsert({
        where: {
          companyId_customerId_productId: {
            companyId,
            customerId: customer.id,
            productId: product.id,
          },
        },
        update: {
          unitPriceHt,
          currency: 'TND',
          deletedAt: null,
        },
        create: {
          companyId,
          customerId: customer.id,
          productId: product.id,
          unitPriceHt,
          currency: 'TND',
        },
      });
    }
  }
}

/** Tunisia VAT catalog (Code TVA) — VAT only; CNSS/IRPP reserved for HR. */
async function seedTunisiaVatCatalog(
  prismaClient: typeof prisma,
  companyId: string,
): Promise<void> {
  const validatedAt = new Date('2026-09-08T00:00:00.000Z');
  const validFrom = new Date('2018-01-01T00:00:00.000Z');
  const lawRef = 'Code TVA art.7 / LF2018 art.43 (taux 7/13/19)';
  const defs: Array<{ code: string; label: string; rateBps: number }> = [
    { code: 'TVA19', label: 'TVA normale 19%', rateBps: 1900 },
    { code: 'TVA13', label: 'TVA intermédiaire 13%', rateBps: 1300 },
    { code: 'TVA7', label: 'TVA réduite 7%', rateBps: 700 },
    { code: 'EXO', label: 'Exonération / hors champ 0%', rateBps: 0 },
  ];

  for (const d of defs) {
    let codeRow = await prismaClient.taxCode.findFirst({
      where: { companyId, code: d.code, deletedAt: null },
    });
    if (!codeRow) {
      codeRow = await prismaClient.taxCode.create({
        data: {
          companyId,
          code: d.code,
          label: d.label,
          kind: 'VAT',
          calcMethod: 'RATE',
          status: 'ACTIVE',
          active: true,
        },
      });
    } else {
      await prismaClient.taxCode.update({
        where: { id: codeRow.id },
        data: {
          label: d.label,
          active: true,
          calcMethod: 'RATE',
          status: 'ACTIVE',
        },
      });
    }

    const existingRate = await prismaClient.taxRate.findFirst({
      where: {
        companyId,
        taxCodeId: codeRow.id,
        deletedAt: null,
      },
      orderBy: { validFrom: 'desc' },
    });
    if (!existingRate) {
      await prismaClient.taxRate.create({
        data: {
          companyId,
          taxCodeId: codeRow.id,
          rateBps: d.rateBps,
          calcMethod: 'RATE',
          status: 'VALIDATED',
          validFrom,
          lawRef,
          expertValidatedAt: validatedAt,
        },
      });
    }
  }

  // D271 — stub product default VAT = TVA19 until expert overrides (no FODEC invent)
  await seedProductVatStubs(prismaClient, companyId);
}

/** Operational stub: every active product gets defaultVat → TVA19 if unset. */
async function seedProductVatStubs(
  prismaClient: typeof prisma,
  companyId: string,
): Promise<void> {
  const tva19 = await prismaClient.taxCode.findFirst({
    where: { companyId, code: 'TVA19', deletedAt: null, active: true },
    select: { id: true },
  });
  if (!tva19) return;

  const products = await prismaClient.prdProduct.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true },
  });
  for (const p of products) {
    const existing = await prismaClient.prdFiscalProfile.findFirst({
      where: { companyId, productId: p.id, deletedAt: null },
    });
    if (!existing) {
      await prismaClient.prdFiscalProfile.create({
        data: {
          companyId,
          productId: p.id,
          defaultVatTaxCodeId: tva19.id,
          notes: 'STUB_UNTIL_EXPERT — TVA19 catalogue Code TVA (D271)',
        },
      });
    } else if (!existing.defaultVatTaxCodeId) {
      await prismaClient.prdFiscalProfile.update({
        where: { id: existing.id },
        data: {
          defaultVatTaxCodeId: tva19.id,
          notes:
            existing.notes ??
            'STUB_UNTIL_EXPERT — TVA19 catalogue Code TVA (D271)',
        },
      });
    }
  }
}

/** D272 — operational stubs so AUTHORITY is not blocked until accountant.
 * Marked STUB_UNTIL_EXPERT. TEJ transmission remains DISABLED in code forever.
 * Not legal claims — replace in Préférences → Expertise.
 */
async function seedExpertiseOperationalStubs(
  prismaClient: typeof prisma,
  companyId: string,
): Promise<void> {
  const validatedAt = new Date('2026-09-15T12:00:00.000Z');
  const lawRef = 'STUB_UNTIL_EXPERT — remplacer par le comptable';
  const notes = 'STUB_UNTIL_EXPERT — valeurs opérationnelles temporaires (D272)';

  const stubs: Array<{
    slotKey: string;
    valueLabel: string;
    rateBps?: number | null;
    amountMilli?: number | null;
  }> = [
    {
      slotKey: 'tax.fodec',
      valueLabel: '1 % STUB (FODEC)',
      rateBps: 100,
    },
    {
      slotKey: 'tax.timbre',
      valueLabel: '1,000 TND STUB (timbre)',
      amountMilli: 1000,
    },
    {
      slotKey: 'tax.tej',
      valueLabel: 'Régime local STUB — draft XML only (pas de transmission)',
    },
    {
      slotKey: 'hr.cnss.employee',
      valueLabel: '9,18 % STUB (CNSS salarié)',
      rateBps: 918,
    },
    {
      slotKey: 'hr.cnss.employer',
      valueLabel: '16,57 % STUB (CNSS employeur)',
      rateBps: 1657,
    },
    {
      slotKey: 'hr.cnss.ceiling',
      valueLabel: '6 000 TND STUB (plafond CNSS)',
      amountMilli: 6_000_000,
    },
  ];

  for (const s of stubs) {
    const existing = await prismaClient.setExpertise.findUnique({
      where: {
        companyId_slotKey: { companyId, slotKey: s.slotKey },
      },
    });
    // Never overwrite a real expert row
    if (existing && existing.deletedAt == null) {
      const isStub =
        (existing.notes?.includes('STUB_UNTIL_EXPERT') ?? false) ||
        existing.lawRef.includes('STUB_UNTIL_EXPERT');
      if (!isStub) continue;
    }

    if (existing) {
      await prismaClient.setExpertise.update({
        where: { id: existing.id },
        data: {
          valueLabel: s.valueLabel,
          lawRef,
          expertValidatedAt: validatedAt,
          rateBps: s.rateBps ?? null,
          amountMilli: s.amountMilli ?? null,
          notes,
          deletedAt: null,
        },
      });
    } else {
      await prismaClient.setExpertise.create({
        data: {
          companyId,
          slotKey: s.slotKey,
          valueLabel: s.valueLabel,
          lawRef,
          expertValidatedAt: validatedAt,
          rateBps: s.rateBps ?? null,
          amountMilli: s.amountMilli ?? null,
          notes,
        },
      });
    }
  }
}

async function clearLicenseCache(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    return;
  }

  const redis = new Redis(url);
  try {
    await redis.del(LICENSE_CACHE_KEY);
  } finally {
    await redis.quit();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
