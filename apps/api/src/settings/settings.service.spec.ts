import { SetLevel } from '@prisma/client';
import { SettingsService } from './settings.service';

describe('SettingsService hierarchy', () => {
  let prisma: {
    setDef: { findMany: jest.Mock; findUnique: jest.Mock };
    setValue: { findMany: jest.Mock; findUnique: jest.Mock };
    orgUserAssignment: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      setDef: { findMany: jest.fn(), findUnique: jest.fn() },
      setValue: { findMany: jest.fn(), findUnique: jest.fn() },
      orgUserAssignment: { findFirst: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
    };

    const auditService = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outboxService = {
      enqueue: jest.fn().mockResolvedValue({ id: 'o1' }),
    };

    service = new SettingsService(
      prisma as never,
      auditService as never,
      outboxService as never,
    );
  });

  it('resolves USER over ROLE over COMPANY over SYSTEM', async () => {
    prisma.setDef.findMany.mockResolvedValue([
      {
        key: 'ui.theme',
        valueType: 'enum',
        defaultJson: 'system',
        description: 'theme',
        isPrefOnly: true,
      },
      {
        key: 'ui.density',
        valueType: 'enum',
        defaultJson: 'comfortable',
        description: 'density',
        isPrefOnly: true,
      },
      {
        key: 'ui.locale',
        valueType: 'enum',
        defaultJson: 'fr-TN',
        description: 'locale',
        isPrefOnly: true,
      },
    ]);

    prisma.setValue.findMany.mockResolvedValue([
      {
        defKey: 'ui.theme',
        scopeKey: 'company:company-demo',
        valueJson: 'dark',
        level: SetLevel.COMPANY,
      },
      {
        defKey: 'ui.theme',
        scopeKey: 'user:company-demo:user-demo',
        valueJson: 'light',
        level: SetLevel.USER,
      },
      {
        defKey: 'ui.density',
        scopeKey: 'role:company-demo:operator',
        valueJson: 'compact',
        level: SetLevel.ROLE,
      },
    ]);

    const result = await service.getEffective({
      userId: 'user-demo',
      companyId: 'company-demo',
      roleCode: 'operator',
    });

    const theme = result.settings.find((row) => row.key === 'ui.theme');
    const density = result.settings.find((row) => row.key === 'ui.density');
    const locale = result.settings.find((row) => row.key === 'ui.locale');

    expect(theme).toMatchObject({ value: 'light', source: SetLevel.USER });
    expect(density).toMatchObject({ value: 'compact', source: SetLevel.ROLE });
    expect(locale).toMatchObject({ value: 'fr-TN', source: SetLevel.SYSTEM });
  });

  it('rejects permission keys as settings values', async () => {
    await expect(
      service.upsertValue({
        context: {
          userId: 'user-demo',
          companyId: 'company-demo',
        },
        key: 'identity.user.manage',
        value: 'allowed',
        level: 'USER',
        actorUserId: 'user-demo',
      }),
    ).rejects.toMatchObject({ code: 'SET.INVALID' });
  });
});
