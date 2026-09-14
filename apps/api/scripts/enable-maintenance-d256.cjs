const {
  PrismaClient,
  ModModuleStatus,
  IamGrantSubject,
  IamGrantEffect,
  IamLifecycleStatus,
} = require('@prisma/client');

const p = new PrismaClient();

const PERMS = ['maintenance.asset', 'maintenance.wo'];
const ROLES = ['admin', 'operator'];

async function upsertGrant(params) {
  const existing = await p.iamGrant.findFirst({
    where: {
      permissionKey: params.permissionKey,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      companyId: params.companyId ?? null,
      effect: params.effect ?? IamGrantEffect.ALLOW,
    },
  });
  if (existing) {
    await p.iamGrant.update({
      where: { id: existing.id },
      data: { status: IamLifecycleStatus.ACTIVE },
    });
    return;
  }
  await p.iamGrant.create({
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

(async () => {
  const companies = await p.orgCompany.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  });

  for (const c of companies) {
    await p.modModuleState.upsert({
      where: {
        companyId_moduleKey: { companyId: c.id, moduleKey: 'maintenance' },
      },
      update: { status: ModModuleStatus.ENABLED },
      create: {
        companyId: c.id,
        moduleKey: 'maintenance',
        status: ModModuleStatus.ENABLED,
      },
    });
    console.log('ENABLED maintenance for', c.code);

    for (const role of ROLES) {
      for (const permissionKey of PERMS) {
        await upsertGrant({
          permissionKey,
          subjectType: IamGrantSubject.ROLE,
          subjectId: role,
          companyId: c.id,
        });
      }
    }
  }

  const fleetGrants = await p.iamGrant.findMany({
    where: {
      permissionKey: 'fleet.manage',
      subjectType: IamGrantSubject.USER,
      status: IamLifecycleStatus.ACTIVE,
    },
  });

  for (const g of fleetGrants) {
    for (const permissionKey of PERMS) {
      await upsertGrant({
        permissionKey,
        subjectType: IamGrantSubject.USER,
        subjectId: g.subjectId,
        companyId: g.companyId,
      });
    }
  }

  console.log('Done. Grants mirrored for', fleetGrants.length, 'fleet.manage users');
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
