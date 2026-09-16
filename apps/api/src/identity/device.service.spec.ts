import { IamLifecycleStatus, IamUserStatus } from '@prisma/client';
import { DeviceService } from './device.service';
import { IDENTITY_ERROR_CODES } from './identity.constants';

describe('DeviceService', () => {
  let service: DeviceService;
  let prisma: {
    orgUserAssignment: { findFirst: jest.Mock };
    iamDevice: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let audit: { append: jest.Mock };

  const user = {
    id: 'user-1',
    email: 'demo@authority.local',
    displayName: 'Demo',
    status: IamUserStatus.ACTIVE,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      orgUserAssignment: { findFirst: jest.fn() },
      iamDevice: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    audit = { append: jest.fn().mockResolvedValue({ id: 'aud-1' }) };
    service = new DeviceService(prisma as never, audit as never);
  });

  it('pairs a pending device when the user is assigned to the company', async () => {
    prisma.orgUserAssignment.findFirst.mockResolvedValue({ id: 'asg-1' });
    const created = {
      id: 'dev-1',
      userId: 'user-1',
      companyId: 'co-1',
    };
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        iamDevice: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue(created),
        },
      };
      return fn(tx);
    });

    const result = await service.pair({ userId: 'user-1', companyId: 'co-1' });

    expect(result.deviceId).toBe('dev-1');
    expect(result.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(audit.append).toHaveBeenCalled();
  });

  it('claims a valid pending code once and returns a token', async () => {
    prisma.iamDevice.findFirst.mockResolvedValue({
      id: 'dev-1',
      userId: 'user-1',
      companyId: 'co-1',
      user,
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        iamDevice: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(tx);
    });

    const result = await service.claim({ code: 'ABCD-EFGH' });

    expect(result.deviceId).toBe('dev-1');
    expect(result.companyId).toBe('co-1');
    expect(result.token.startsWith('axd_')).toBe(true);
    expect(result.displayName).toBe('Demo');
  });

  it('rejects an expired or unknown pairing code', async () => {
    prisma.iamDevice.findFirst.mockResolvedValue(null);

    await expect(service.claim({ code: 'ABCD-EFGH' })).rejects.toMatchObject({
      code: IDENTITY_ERROR_CODES.PAIR_INVALID,
    });
  });

  it('finds an active device by token prefix', async () => {
    prisma.iamDevice.findFirst.mockResolvedValue({
      id: 'dev-1',
      userId: 'user-1',
      companyId: 'co-1',
      user,
    });
    prisma.iamDevice.update.mockResolvedValue({});

    const found = await service.findActiveByToken(
      'axd_' + 'a'.repeat(40),
    );

    expect(found?.id).toBe('dev-1');
    expect(found?.companyId).toBe('co-1');
  });

  it('ignores non-device bearer tokens', async () => {
    const found = await service.findActiveByToken('not-a-device');
    expect(found).toBeNull();
    expect(prisma.iamDevice.findFirst).not.toHaveBeenCalled();
  });

  it('revokes an owned device', async () => {
    prisma.iamDevice.findFirst.mockResolvedValue({
      id: 'dev-1',
      userId: 'user-1',
      companyId: 'co-1',
      status: IamLifecycleStatus.ACTIVE,
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        iamDevice: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await service.revoke({
      userId: 'user-1',
      companyId: 'co-1',
      deviceId: 'dev-1',
    });

    expect(audit.append).toHaveBeenCalled();
  });
});
