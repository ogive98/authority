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
    'production',
    'payroll',
    'tax',
    'customers',
    'master_data',
    'products',
    'portals',
    'finance',
    'documents',
    'accounting',
    'repair',
  ] as const;

  for (const moduleKey of businessModules) {
    const enabled =
      moduleKey === 'master_data' ||
      moduleKey === 'products' ||
      moduleKey === 'customers' ||
      moduleKey === 'inventory' ||
      moduleKey === 'sales' ||
      moduleKey === 'delivery' ||
      moduleKey === 'portals' ||
      moduleKey === 'finance' ||
      moduleKey === 'documents' ||
      moduleKey === 'accounting' ||
      moduleKey === 'repair' ||
      moduleKey === 'production' ||
      moduleKey === 'tax'
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
    },
  });

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

  console.log(
    `Seed OK — company ${company.code}, site ${demoSite.code}, other ${otherCompany.code}, user ${DEMO_USER_EMAIL}, limited ${LIMITED_USER_EMAIL}, super-admin ${SUPER_ADMIN_EMAIL}, portal ${PORTAL_USER_EMAIL}`,
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
      isPrefOnly: false,
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
      key: 'finance.credit.enforce',
      valueType: 'boolean',
      defaultJson: false,
      description:
        'When true, deny sales confirm if outstanding + order exceeds customer creditLimit',
      isPrefOnly: false,
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
          active: true,
        },
      });
    } else {
      await prismaClient.taxCode.update({
        where: { id: codeRow.id },
        data: { label: d.label, active: true },
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
          validFrom,
          lawRef,
          expertValidatedAt: validatedAt,
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
