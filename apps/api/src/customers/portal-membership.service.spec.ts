import { HttpStatus } from '@nestjs/common';
import { IamLifecycleStatus } from '@prisma/client';
import { CUSTOMERS_ERROR_CODES } from './customers.constants';
import { CustomersException } from './customers.exception';
import { PortalMembershipService } from './portal-membership.service';

describe('PortalMembershipService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '33333333-3333-3333-3333-333333333333';
  const userId = '55555555-5555-5555-5555-555555555555';
  const membershipId = '66666666-6666-6666-6666-666666666666';

  function build(opts?: {
    existing?: {
      id: string;
      status: IamLifecycleStatus;
      version: number;
      role: string;
    } | null;
    portalsEnabled?: boolean;
  }) {
    const membership = {
      id: membershipId,
      companyId,
      customerId,
      userId,
      role: 'buyer',
      status: IamLifecycleStatus.ACTIVE,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: userId,
        email: 'portal@authority.local',
        displayName: 'Portal User',
        status: 'ACTIVE',
      },
    };

    const prisma = {
      ptlMembership: {
        findMany: jest.fn().mockResolvedValue([membership]),
        findUnique: jest.fn().mockResolvedValue(opts?.existing ?? null),
        findFirst: jest.fn().mockResolvedValue(
          opts?.existing
            ? {
                ...membership,
                ...opts.existing,
              }
            : null,
        ),
        findUniqueOrThrow: jest.fn().mockResolvedValue(membership),
        create: jest.fn().mockResolvedValue(membership),
        update: jest.fn().mockResolvedValue(membership),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orgUserAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId,
            user: {
              id: userId,
              email: 'portal@authority.local',
              displayName: 'Portal User',
              status: 'ACTIVE',
            },
          },
        ]),
        findFirst: jest.fn().mockResolvedValue({
          userId,
          user: { id: userId, deletedAt: null },
        }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ptlMembership: {
            create: jest.fn().mockResolvedValue(membership),
            update: jest.fn().mockResolvedValue({
              ...membership,
              status: IamLifecycleStatus.ACTIVE,
              version: 1,
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              ...membership,
              status: IamLifecycleStatus.REVOKED,
              version: 1,
            }),
          },
        }),
      ),
    };

    const customers = {
      get: jest.fn().mockResolvedValue({ id: customerId }),
    };
    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'o1' }),
    };
    const modules = {
      isEnabled: jest
        .fn()
        .mockResolvedValue(opts?.portalsEnabled !== false),
    };

    const service = new PortalMembershipService(
      prisma as never,
      customers as never,
      outbox as never,
      modules as never,
    );
    return { service, prisma, customers, outbox, modules, membership };
  }

  it('lists memberships for customer', async () => {
    const { service } = build();
    const result = await service.list(companyId, customerId);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBe('portal@authority.local');
    expect(result.items[0].role).toBe('buyer');
  });

  it('rejects link when portals module disabled', async () => {
    const { service } = build({ portalsEnabled: false });
    await expect(
      service.create(companyId, customerId, { userId, role: 'buyer' }),
    ).rejects.toMatchObject({
      code: CUSTOMERS_ERROR_CODES.PORTALS_DISABLED,
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('rejects duplicate active membership', async () => {
    const { service } = build({
      existing: {
        id: membershipId,
        status: IamLifecycleStatus.ACTIVE,
        version: 0,
        role: 'buyer',
      },
    });
    await expect(
      service.create(companyId, customerId, { userId }),
    ).rejects.toMatchObject({
      code: CUSTOMERS_ERROR_CODES.MEMBERSHIP_DUP,
      status: HttpStatus.CONFLICT,
    });
  });

  it('reactivates revoked membership', async () => {
    const { service, outbox } = build({
      existing: {
        id: membershipId,
        status: IamLifecycleStatus.REVOKED,
        version: 2,
        role: 'viewer',
      },
    });
    const row = await service.create(companyId, customerId, {
      userId,
      role: 'admin',
    });
    expect(row.id).toBe(membershipId);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('lists linkable users with membership flags', async () => {
    const { service, prisma } = build();
    prisma.ptlMembership.findMany.mockResolvedValueOnce([
      {
        id: membershipId,
        userId,
        status: IamLifecycleStatus.ACTIVE,
      },
    ]);
    const result = await service.listLinkableUsers(companyId, customerId);
    expect(result.items[0].membershipId).toBe(membershipId);
    expect(result.items[0].membershipStatus).toBe(IamLifecycleStatus.ACTIVE);
  });

  it('updates status to REVOKED', async () => {
    const { service, outbox } = build({
      existing: {
        id: membershipId,
        status: IamLifecycleStatus.ACTIVE,
        version: 0,
        role: 'buyer',
      },
    });
    const row = await service.update(companyId, customerId, membershipId, {
      status: 'REVOKED',
      version: 0,
    });
    expect(row.status).toBe(IamLifecycleStatus.REVOKED);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('throws NOT_FOUND for missing membership', async () => {
    const { service } = build({ existing: null });
    await expect(
      service.update(companyId, customerId, membershipId, {
        status: 'REVOKED',
        version: 0,
      }),
    ).rejects.toBeInstanceOf(CustomersException);
  });
});
