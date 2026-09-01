import {
  IamGrantEffect,
  IamGrantSubject,
  IamLifecycleStatus,
} from '@prisma/client';
import { PermissionService } from './permission.service';
import { PERMISSION_KEYS } from './permission.constants';

describe('PermissionService matrix', () => {
  const userId = 'user-demo';
  const otherUserId = 'user-limited';
  const companyDemo = 'company-demo';
  const companyOther = 'company-other';
  const siteSfx = 'site-sfx';

  let prisma: {
    iamGrant: { findMany: jest.Mock };
    orgUserAssignment: { findMany: jest.Mock };
  };
  let service: PermissionService;

  function grant(partial: {
    permissionKey: string;
    effect?: IamGrantEffect;
    subjectType: IamGrantSubject;
    subjectId: string;
    companyId?: string | null;
    siteId?: string | null;
    warehouseId?: string | null;
  }) {
    return {
      effect: IamGrantEffect.ALLOW,
      companyId: null,
      siteId: null,
      warehouseId: null,
      status: IamLifecycleStatus.ACTIVE,
      ...partial,
    };
  }

  beforeEach(() => {
    prisma = {
      iamGrant: { findMany: jest.fn().mockResolvedValue([]) },
      orgUserAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new PermissionService(prisma as never);
  });

  it('allows identity.self.read for a user ALLOW grant without company scope', async () => {
    prisma.iamGrant.findMany.mockImplementation(
      (args: { where: { subjectType: string } }) => {
        if (args.where.subjectType === IamGrantSubject.USER) {
          return [
            grant({
              permissionKey: PERMISSION_KEYS.identitySelfRead,
              subjectType: IamGrantSubject.USER,
              subjectId: userId,
            }),
          ];
        }
        return [];
      },
    );

    await expect(
      service.evaluate(userId, PERMISSION_KEYS.identitySelfRead),
    ).resolves.toBe(true);
  });

  it('denies identity.user.manage when no grant exists', async () => {
    await expect(
      service.evaluate(userId, PERMISSION_KEYS.identityUserManage, {
        companyId: companyDemo,
      }),
    ).resolves.toBe(false);
  });

  it('denies a company-scoped grant outside that company', async () => {
    prisma.orgUserAssignment.findMany.mockResolvedValue([
      { roleCode: 'operator', companyId: companyDemo },
    ]);
    prisma.iamGrant.findMany.mockImplementation(
      (args: { where: { subjectType: string } }) => {
        if (args.where.subjectType === IamGrantSubject.ROLE) {
          return [
            grant({
              permissionKey: PERMISSION_KEYS.platformSearchUse,
              subjectType: IamGrantSubject.ROLE,
              subjectId: 'operator',
              companyId: companyDemo,
            }),
          ];
        }
        return [];
      },
    );

    await expect(
      service.evaluate(userId, PERMISSION_KEYS.platformSearchUse, {
        companyId: companyDemo,
      }),
    ).resolves.toBe(true);

    await expect(
      service.evaluate(userId, PERMISSION_KEYS.platformSearchUse, {
        companyId: companyOther,
      }),
    ).resolves.toBe(false);
  });

  it('DENY overrides ALLOW on the same permission', async () => {
    prisma.iamGrant.findMany.mockImplementation(
      (args: { where: { subjectType: string } }) => {
        if (args.where.subjectType === IamGrantSubject.USER) {
          return [
            grant({
              permissionKey: PERMISSION_KEYS.platformFileWrite,
              subjectType: IamGrantSubject.USER,
              subjectId: userId,
              companyId: companyDemo,
            }),
            grant({
              permissionKey: PERMISSION_KEYS.platformFileWrite,
              effect: IamGrantEffect.DENY,
              subjectType: IamGrantSubject.USER,
              subjectId: userId,
              companyId: companyDemo,
            }),
          ];
        }
        return [];
      },
    );

    await expect(
      service.evaluate(userId, PERMISSION_KEYS.platformFileWrite, {
        companyId: companyDemo,
      }),
    ).resolves.toBe(false);
  });

  it('never grants wildcard or uncatalogued keys (no permission: *)', async () => {
    prisma.iamGrant.findMany.mockResolvedValue([
      grant({
        permissionKey: 'platform.*',
        subjectType: IamGrantSubject.USER,
        subjectId: userId,
      }),
    ]);

    await expect(service.evaluate(userId, 'platform.*')).resolves.toBe(false);
    await expect(service.evaluate(userId, '*')).resolves.toBe(false);
    await expect(service.evaluate(userId, 'sales.order.read')).resolves.toBe(
      false,
    );
  });

  it('does not apply a site-scoped grant to another site', async () => {
    prisma.iamGrant.findMany.mockImplementation(
      (args: { where: { subjectType: string } }) => {
        if (args.where.subjectType === IamGrantSubject.USER) {
          return [
            grant({
              permissionKey: PERMISSION_KEYS.platformFileRead,
              subjectType: IamGrantSubject.USER,
              subjectId: userId,
              companyId: companyDemo,
              siteId: siteSfx,
            }),
          ];
        }
        return [];
      },
    );

    await expect(
      service.evaluate(userId, PERMISSION_KEYS.platformFileRead, {
        companyId: companyDemo,
        siteId: siteSfx,
      }),
    ).resolves.toBe(true);

    await expect(
      service.evaluate(userId, PERMISSION_KEYS.platformFileRead, {
        companyId: companyDemo,
        siteId: 'site-other',
      }),
    ).resolves.toBe(false);
  });

  it('does not treat Super Admin membership as a business grant', async () => {
    await expect(
      service.evaluate(otherUserId, PERMISSION_KEYS.identityUserManage, {
        companyId: companyDemo,
      }),
    ).resolves.toBe(false);
    expect(prisma.iamGrant.findMany).toHaveBeenCalled();
  });
});
