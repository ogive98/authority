import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

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

  await prisma.orgSite.upsert({
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

  console.log(`Seed OK — company ${company.code} (${company.id})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
