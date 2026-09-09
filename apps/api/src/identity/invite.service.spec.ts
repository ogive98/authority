import { createHash } from 'crypto';
import { IamUserStatus } from '@prisma/client';
import { InviteService } from './invite.service';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { AUDIT_ACTIONS } from '../audit/audit.constants';

describe('InviteService', () => {
  let service: InviteService;
  let prisma: {
    iamUser: { findUnique: jest.Mock };
    orgUserAssignment: {
      findFirst: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    iamInvite: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let passwords: { hash: jest.Mock };
  let audit: { append: jest.Mock };

  beforeEach(() => {
    prisma = {
      iamUser: { findUnique: jest.fn() },
      orgUserAssignment: {
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      iamInvite: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    passwords = { hash: jest.fn().mockResolvedValue('argon-hash') };
    audit = { append: jest.fn().mockResolvedValue({ id: 'aud-1' }) };
    service = new InviteService(
      prisma as never,
      passwords as never,
      audit as never,
    );
  });

  it('peek rejects short tokens', async () => {
    await expect(service.peek('short')).rejects.toMatchObject({
      code: IDENTITY_ERROR_CODES.VALIDATION,
    });
    expect(prisma.iamInvite.findFirst).not.toHaveBeenCalled();
  });

  it('accept rejects passwords under 8 chars', async () => {
    await expect(service.accept('a'.repeat(32), 'short')).rejects.toMatchObject(
      {
        code: IDENTITY_ERROR_CODES.VALIDATION,
      },
    );
  });

  it('invite stores sha256 of token (not raw) and audits', async () => {
    prisma.iamUser.findUnique.mockResolvedValue(null);
    const inviteCreate = jest.fn();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const user = {
          id: 'u-new',
          email: 'new@authority.local',
          displayName: 'New',
          status: IamUserStatus.INVITED,
          locale: 'fr-TN',
          timezone: 'Africa/Tunis',
          mfaEnabled: false,
          createdAt: new Date('2026-09-09T00:00:00.000Z'),
          updatedAt: new Date('2026-09-09T00:00:00.000Z'),
        };
        const tx = {
          iamUser: { create: jest.fn().mockResolvedValue(user) },
          orgUserAssignment: {
            create: jest.fn().mockResolvedValue({
              id: 'asg-1',
              roleCode: 'operator',
              user,
            }),
          },
          iamGrant: { create: jest.fn() },
          iamInvite: { create: inviteCreate },
        };
        return fn(tx);
      },
    );

    const result = await service.invite(
      'co-1',
      {
        email: 'new@authority.local',
        displayName: 'New',
        roleCode: 'operator',
      },
      'admin-1',
    );

    expect(result.alreadyActive).toBe(false);
    expect(result.inviteUrl).toContain('/invite/');
    const raw = result.inviteUrl!.split('/invite/')[1]!;
    const expectedHash = createHash('sha256').update(raw, 'utf8').digest('hex');

    expect(inviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: expectedHash,
          companyId: 'co-1',
          userId: 'u-new',
        }),
      }),
    );
    expect(inviteCreate.mock.calls[0][0].data.tokenHash).not.toBe(raw);
    expect(audit.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: AUDIT_ACTIONS.identityUserInvite,
        actorUserId: 'admin-1',
        entityId: 'u-new',
      }),
    );
  });

  it('accept activates user, consumes invite, audits via token', async () => {
    const raw = 'b'.repeat(32);
    const hash = createHash('sha256').update(raw, 'utf8').digest('hex');
    prisma.iamInvite.findFirst.mockResolvedValue({
      id: 'inv-1',
      userId: 'u-1',
      companyId: 'co-1',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 86_400_000),
      consumedAt: null,
      user: {
        id: 'u-1',
        email: 'invited@authority.local',
        displayName: 'Invited',
        status: IamUserStatus.INVITED,
        deletedAt: null,
      },
    });
    const userUpdate = jest.fn();
    const inviteUpdate = jest.fn();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          iamUser: { update: userUpdate },
          iamInvite: { update: inviteUpdate },
        }),
    );

    const out = await service.accept(raw, 'SecurePass1');
    expect(out.email).toBe('invited@authority.local');
    expect(passwords.hash).toHaveBeenCalledWith('SecurePass1');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({
          status: IamUserStatus.ACTIVE,
          passwordHash: 'argon-hash',
        }),
      }),
    );
    expect(inviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          tokenHash: 'consumed:inv-1',
        }),
      }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: AUDIT_ACTIONS.identityUserInviteAccept,
        afterJson: expect.objectContaining({ via: 'token' }),
      }),
    );
  });
});
