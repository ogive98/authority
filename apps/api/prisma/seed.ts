import { config } from 'dotenv';
import { resolve } from 'node:path';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

import { IamGrantEffect, IamGrantSubject, IamLifecycleStatus, IamMfaPurpose } from '@prisma/client';
import { encryptMfaSecret } from '../src/super-admin/mfa-crypto';

const DEMO_USER_EMAIL = 'demo@authority.local';
const DEMO_USER_PASSWORD = 'DemoPass123!';
const SUPER_ADMIN_EMAIL = 'superadmin@authority.local';
const SUPER_ADMIN_PASSWORD = 'SuperAdminPass123!';
/** Dev/test TOTP seed only — never use in production. */
const SUPER_ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
const LIMITED_USER_EMAIL = 'limited@authority.local';
const LIMITED_USER_PASSWORD = 'LimitedPass123!';

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
    'production',
    'payroll',
    'customers',
    'master_data',
  ] as const;

  for (const moduleKey of businessModules) {
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company.id,
          moduleKey,
        },
      },
      update: { status: 'DISABLED' },
      create: {
        companyId: company.id,
        moduleKey,
        status: 'DISABLED',
      },
    });
  }

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
    update: {},
    create: {
      companyId: company.id,
      userId: demoUser.id,
      roleCode: 'operator',
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
    permissionKey: 'platform.search.use',
    subjectType: IamGrantSubject.ROLE,
    subjectId: 'operator',
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

  console.log(
    `Seed OK — company ${company.code}, site ${demoSite.code}, other ${otherCompany.code}, user ${DEMO_USER_EMAIL}, limited ${LIMITED_USER_EMAIL}, super-admin ${SUPER_ADMIN_EMAIL}`,
  );
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

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
