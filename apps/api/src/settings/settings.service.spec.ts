import { SetLevel } from '@prisma/client';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { SettingsException } from './settings.exception';
import { SettingsService } from './settings.service';

describe('SettingsService hierarchy', () => {
  let prisma: {
    setDef: { findMany: jest.Mock; findUnique: jest.Mock; upsert: jest.Mock };
    setValue: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    setExpertise: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    orgUserAssignment: { findFirst: jest.Mock };
    taxCode: { findMany: jest.Mock };
    taxRate: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { append: jest.Mock };
  let inviteSettings: { resolve: jest.Mock };
  let mail: { isConfigured: jest.Mock; send: jest.Mock };
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      setDef: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({
          key: 'ops.unlock_code',
          valueType: 'string',
          defaultJson: '3141',
          description: 'ops unlock',
          isPrefOnly: true,
        }),
      },
      setValue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      setExpertise: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      orgUserAssignment: { findFirst: jest.fn() },
      taxCode: { findMany: jest.fn().mockResolvedValue([]) },
      taxRate: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
    };

    auditService = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outboxService = {
      enqueue: jest.fn().mockResolvedValue({ id: 'o1' }),
    };
    inviteSettings = { resolve: jest.fn() };
    mail = { isConfigured: jest.fn(), send: jest.fn() };
    const opsVisibility = {
      ensureDefinitions: jest.fn().mockResolvedValue(undefined),
      resolve: jest.fn(),
    };

    service = new SettingsService(
      prisma as never,
      auditService as never,
      outboxService as never,
      inviteSettings as never,
      mail as never,
      opsVisibility as never,
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
        actorIsSuperAdmin: false,
      }),
    ).rejects.toMatchObject({ code: 'SET.INVALID' });
  });

  it('lists expertise slots without inventing FODEC/CNSS rates', async () => {
    const catalog = await service.listExpertise('company-demo');
    expect(catalog.items.length).toBeGreaterThanOrEqual(6);
    const fodec = catalog.items.find((i) => i.key === 'tax.fodec');
    const cnss = catalog.items.find((i) => i.key === 'hr.cnss.employee');
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

  it('upserts FODEC expertise when expert provides lawRef + value', async () => {
    const saved = {
      id: 'e1',
      companyId: 'company-demo',
      slotKey: 'tax.fodec',
      valueLabel: '1 %',
      rateBps: 100,
      amountMilli: null,
      lawRef: 'Expert note 2026',
      expertValidatedAt: new Date('2026-09-08T00:00:00.000Z'),
      notes: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    prisma.setExpertise.create.mockResolvedValue(saved);
    prisma.setExpertise.findMany.mockResolvedValue([saved]);

    const item = await service.upsertExpertise(
      'company-demo',
      'tax.fodec',
      {
        valueLabel: '1 %',
        lawRef: 'Expert note 2026',
        expertValidatedAt: '2026-09-08T00:00:00.000Z',
        rateBps: 100,
      },
      'user-demo',
    );

    expect(item.status).toBe('VALIDATED');
    expect(item.valueSummary).toBe('1 %');
    expect(item.lawRef).toBe('Expert note 2026');
    expect(item.rateBps).toBe(100);
  });

  it('rejects writing TVA via preferences (Tax Engine only)', async () => {
    await expect(
      service.upsertExpertise(
        'company-demo',
        'tax.vat',
        {
          valueLabel: '19%',
          lawRef: 'x',
          expertValidatedAt: '2026-09-08T00:00:00.000Z',
        },
        'user-demo',
      ),
    ).rejects.toMatchObject({ code: 'SET.EXPERTISE_READONLY' });
  });

  describe('Envois value types (D146/D147)', () => {
    function mockWritableDef(key: string, valueType: string) {
      prisma.setDef.findUnique.mockResolvedValue({
        key,
        valueType,
        defaultJson: valueType === 'boolean' ? false : valueType === 'number' ? 0 : '',
        description: key,
        isPrefOnly: true,
      });
      prisma.setValue.findUnique.mockResolvedValue(null);
      prisma.setValue.create.mockResolvedValue({
        id: 'sv-1',
        defKey: key,
        scopeKey: 'company:company-demo',
        valueJson: null,
      });
      prisma.setDef.findMany.mockResolvedValue([
        {
          key,
          valueType,
          defaultJson: valueType === 'boolean' ? false : valueType === 'number' ? 0 : '',
          description: key,
          isPrefOnly: true,
        },
      ]);
      prisma.setValue.findMany.mockResolvedValue([]);
    }

    it('accepts number for identity.invite.ttl_days', async () => {
      mockWritableDef('identity.invite.ttl_days', 'number');
      prisma.setValue.findMany.mockResolvedValue([
        {
          defKey: 'identity.invite.ttl_days',
          scopeKey: 'company:company-demo',
          valueJson: 10,
          level: SetLevel.COMPANY,
        },
      ]);
      const row = await service.upsertValue({
        context: { userId: 'admin-1', companyId: 'company-demo' },
        key: 'identity.invite.ttl_days',
        value: 10,
        level: 'COMPANY',
        actorUserId: 'admin-1',
        actorIsSuperAdmin: false,
      });
      expect(row.value).toBe(10);
      expect(prisma.setValue.create).toHaveBeenCalled();
    });

    it('accepts boolean for identity.invite.auto_send', async () => {
      mockWritableDef('identity.invite.auto_send', 'boolean');
      prisma.setValue.findMany.mockResolvedValue([
        {
          defKey: 'identity.invite.auto_send',
          scopeKey: 'company:company-demo',
          valueJson: true,
          level: SetLevel.COMPANY,
        },
      ]);
      const row = await service.upsertValue({
        context: { userId: 'admin-1', companyId: 'company-demo' },
        key: 'identity.invite.auto_send',
        value: true,
        level: 'COMPANY',
        actorUserId: 'admin-1',
        actorIsSuperAdmin: false,
      });
      expect(row.value).toBe(true);
    });

    it('accepts empty string for identity.smtp.host', async () => {
      mockWritableDef('identity.smtp.host', 'string');
      prisma.setValue.findMany.mockResolvedValue([
        {
          defKey: 'identity.smtp.host',
          scopeKey: 'company:company-demo',
          valueJson: '',
          level: SetLevel.COMPANY,
        },
      ]);
      const row = await service.upsertValue({
        context: { userId: 'admin-1', companyId: 'company-demo' },
        key: 'identity.smtp.host',
        value: '',
        level: 'COMPANY',
        actorUserId: 'admin-1',
        actorIsSuperAdmin: false,
      });
      expect(row.value).toBe('');
    });

    it('rejects non-number for number settings', async () => {
      mockWritableDef('identity.invite.ttl_days', 'number');
      await expect(
        service.upsertValue({
          context: { userId: 'admin-1', companyId: 'company-demo' },
          key: 'identity.invite.ttl_days',
          value: '10',
          level: 'COMPANY',
          actorUserId: 'admin-1',
        actorIsSuperAdmin: false,
        }),
      ).rejects.toMatchObject({ code: 'SET.INVALID' });
    });
  });

  describe('SMTP pass write-only (D137/D148)', () => {
    it('redacts identity.smtp.pass in getEffective and sets secretSet', async () => {
      prisma.setDef.findMany.mockResolvedValue([
        {
          key: 'identity.smtp.pass',
          valueType: 'string',
          defaultJson: '',
          description: 'SMTP pass',
          isPrefOnly: true,
        },
      ]);
      prisma.setValue.findMany.mockResolvedValue([
        {
          defKey: 'identity.smtp.pass',
          scopeKey: 'company:company-demo',
          valueJson: 'super-secret',
          level: SetLevel.COMPANY,
        },
      ]);

      const result = await service.getEffective({
        userId: 'admin-1',
        companyId: 'company-demo',
      });
      const row = result.settings.find((s) => s.key === 'identity.smtp.pass');
      expect(row?.value).toBe('');
      expect(row?.secretSet).toBe(true);
      expect(JSON.stringify(result)).not.toContain('super-secret');
    });

    it('empty PUT keeps previous smtp.pass', async () => {
      prisma.setDef.findUnique.mockResolvedValue({
        key: 'identity.smtp.pass',
        valueType: 'string',
        defaultJson: '',
        description: 'SMTP pass',
        isPrefOnly: true,
      });
      prisma.setValue.findUnique.mockResolvedValue({
        id: 'sv-pass',
        defKey: 'identity.smtp.pass',
        scopeKey: 'company:company-demo',
        valueJson: 'kept-secret',
      });
      prisma.setDef.findMany.mockResolvedValue([
        {
          key: 'identity.smtp.pass',
          valueType: 'string',
          defaultJson: '',
          description: 'SMTP pass',
          isPrefOnly: true,
        },
      ]);
      prisma.setValue.findMany.mockResolvedValue([
        {
          defKey: 'identity.smtp.pass',
          scopeKey: 'company:company-demo',
          valueJson: 'kept-secret',
          level: SetLevel.COMPANY,
        },
      ]);

      const row = await service.upsertValue({
        context: { userId: 'admin-1', companyId: 'company-demo' },
        key: 'identity.smtp.pass',
        value: '',
        level: 'COMPANY',
        actorUserId: 'admin-1',
        actorIsSuperAdmin: false,
      });
      expect(row.value).toBe('');
      expect(row.secretSet).toBe(true);
      expect(prisma.setValue.create).not.toHaveBeenCalled();
      expect(prisma.setValue.update).not.toHaveBeenCalled();
    });
  });

  describe('sendSmtpTest (D154)', () => {
    const actor = {
      companyId: 'company-demo',
      actorUserId: 'admin-1',
        actorIsSuperAdmin: false,
      actorEmail: 'demo@authority.local',
    };
    const smtp = {
      host: 'smtp.test',
      port: 587,
      secure: false,
      user: 'u',
      pass: 'p',
      from: 'noreply@test.tn',
    };

    it('rejects when SMTP not configured', async () => {
      inviteSettings.resolve.mockResolvedValue({ smtp: { host: '' } });
      mail.isConfigured.mockReturnValue(false);
      await expect(service.sendSmtpTest(actor)).rejects.toBeInstanceOf(
        SettingsException,
      );
      expect(mail.send).not.toHaveBeenCalled();
      expect(auditService.append).not.toHaveBeenCalled();
    });

    it('sends and audits test_sent', async () => {
      inviteSettings.resolve.mockResolvedValue({ smtp });
      mail.isConfigured.mockReturnValue(true);
      mail.send.mockResolvedValue(undefined);
      const res = await service.sendSmtpTest(actor);
      expect(res).toEqual({
        ok: true,
        to: 'demo@authority.local',
        from: 'noreply@test.tn',
      });
      expect(mail.send).toHaveBeenCalled();
      expect(auditService.append).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTIONS.settingsMailTestSent,
          companyId: 'company-demo',
          actorUserId: 'admin-1',
          afterJson: expect.objectContaining({
            to: 'demo@authority.local',
            from: 'noreply@test.tn',
            via: 'smtp',
          }),
        }),
      );
    });

    it('audits test_failed then throws on SMTP error', async () => {
      inviteSettings.resolve.mockResolvedValue({ smtp });
      mail.isConfigured.mockReturnValue(true);
      mail.send.mockRejectedValue(new Error('relay denied'));
      await expect(service.sendSmtpTest(actor)).rejects.toBeInstanceOf(
        SettingsException,
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AUDIT_ACTIONS.settingsMailTestFailed,
          afterJson: expect.objectContaining({
            error: 'relay denied',
            via: 'smtp',
          }),
        }),
      );
    });
  });
});

