import { SetLevel } from '@prisma/client';
import { SettingsService } from './settings.service';

describe('SettingsService hierarchy', () => {
  let prisma: {
    setDef: { findMany: jest.Mock; findUnique: jest.Mock };
    setValue: { findMany: jest.Mock; findUnique: jest.Mock };
    orgUserAssignment: { findFirst: jest.Mock };
    taxCode: { findMany: jest.Mock };
    taxRate: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      setDef: { findMany: jest.fn(), findUnique: jest.fn() },
      setValue: { findMany: jest.fn(), findUnique: jest.fn() },
      orgUserAssignment: { findFirst: jest.fn() },
      taxCode: { findMany: jest.fn().mockResolvedValue([]) },
      taxRate: { findFirst: jest.fn().mockResolvedValue(null) },
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

  it('lists expertise slots without inventing FODEC/CNSS rates', async () => {
    const catalog = await service.listExpertise('company-demo');
    expect(catalog.items.length).toBeGreaterThanOrEqual(6);
    const fodec = catalog.items.find((i) => i.key === 'tax.fodec');
    const cnss = catalog.items.find((i) => i.key === 'hr.cnss');
    const vat = catalog.items.find((i) => i.key === 'tax.vat');
    expect(fodec?.status).toBe('PENDING_EXPERT');
    expect(fodec?.valueSummary).toBeNull();
    expect(cnss?.status).toBe('PENDING_EXPERT');
    expect(vat?.status).toBe('PENDING_EXPERT');
    expect(catalog.pendingExpertCount).toBeGreaterThan(0);
  });

  it('marks TVA VALIDATED when Tax Engine rates exist', async () => {
    prisma.taxCode.findMany.mockResolvedValue([
      { id: 'c1', code: 'TVA19' },
      { id: 'c2', code: 'TVA7' },
    ]);
    prisma.taxRate.findFirst
      .mockResolvedValueOnce({
        rateBps: 1900,
        lawRef: 'Code TVA art.7',
        expertValidatedAt: new Date('2026-09-08T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        rateBps: 700,
        lawRef: 'LF2018 art.43',
        expertValidatedAt: new Date('2026-09-08T00:00:00.000Z'),
      });

    const catalog = await service.listExpertise('company-demo');
    const vat = catalog.items.find((i) => i.key === 'tax.vat');
    expect(vat?.status).toBe('VALIDATED');
    expect(vat?.valueSummary).toContain('TVA19');
    expect(vat?.manageHref).toBe('/tax');
    const fodec = catalog.items.find((i) => i.key === 'tax.fodec');
    expect(fodec?.status).toBe('PENDING_EXPERT');
  });
});
