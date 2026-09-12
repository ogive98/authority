import { HttpStatus } from '@nestjs/common';
import { HR_ERROR_CODES } from './hr.constants';
import { HrIdentityProvisionService } from './hr-identity-provision.service';

describe('HrIdentityProvisionService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const employeeId = '22222222-2222-2222-2222-222222222222';

  function build(opts?: { existingUser?: boolean }) {
    const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx: any = {
      iamUser: {
        findUnique: jest.fn().mockResolvedValue(
          opts?.existingUser
            ? { id: userId, email: 'salarie@example.tn', deletedAt: null }
            : null,
        ),
        create: jest.fn().mockResolvedValue({
          id: userId,
          email: 'salarie@example.tn',
          displayName: 'Salarié Demo',
        }),
      },
      orgUserAssignment: {
        create: jest.fn().mockResolvedValue({ id: 'asg1' }),
      },
      iamGrant: {
        create: jest.fn().mockResolvedValue({ id: 'g1' }),
      },
      hrEmployee: {
        update: jest.fn().mockResolvedValue({ id: employeeId, userId }),
      },
    };

    const passwords = {
      hash: jest.fn().mockResolvedValue('hashed'),
    };
    const inviteSettings = {
      resolve: jest.fn().mockResolvedValue({
        minPasswordLength: 8,
        webOrigin: 'http://127.0.0.1:3000',
        autoSend: false,
        smtp: { host: '', port: 587, secure: false },
      }),
    };
    const mail = {
      isConfigured: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    const service = new HrIdentityProvisionService(
      {} as never,
      passwords as never,
      inviteSettings as never,
      mail as never,
    );

    return { service, tx, passwords, inviteSettings, mail, userId };
  }

  it('creates ACTIVE user role employee, links employee, returns password once', async () => {
    const { service, tx, passwords, userId } = build();
    const result = await service.provisionForNewEmployee({
      companyId,
      employeeId,
      email: 'Salarie@Example.TN',
      displayName: 'Salarié Demo',
      tx,
    });

    expect(result.userId).toBe(userId);
    expect(result.email).toBe('salarie@example.tn');
    expect(result.provisionalPassword.length).toBeGreaterThanOrEqual(8);
    expect(result.emailSent).toBe(false);
    expect(passwords.hash).toHaveBeenCalledWith(result.provisionalPassword);
    expect(tx.orgUserAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleCode: 'employee' }),
      }),
    );
    expect(tx.hrEmployee.update).toHaveBeenCalledWith({
      where: { id: employeeId },
      data: { userId },
    });
  });

  it('rejects when email already exists', async () => {
    const { service, tx } = build({ existingUser: true });
    await expect(
      service.provisionForNewEmployee({
        companyId,
        employeeId,
        email: 'salarie@example.tn',
        displayName: 'Salarié Demo',
        tx,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: HR_ERROR_CODES.EMAIL_EXISTS },
    });
  });
});
