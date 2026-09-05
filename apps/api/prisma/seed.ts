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
    'customers',
    'master_data',
    'products',
    'portals',
    'finance',
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
      moduleKey === 'finance'
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
