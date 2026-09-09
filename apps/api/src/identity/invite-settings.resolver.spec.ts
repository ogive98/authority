import { InviteSettingsResolver } from './invite-settings.resolver';
import { IDENTITY_SETTING_KEYS } from './identity-settings.constants';

describe('InviteSettingsResolver', () => {
  const prevEnv = { ...process.env };
  let prisma: {
    setValue: { findMany: jest.Mock };
    setDef: { findMany: jest.Mock };
  };
  let resolver: InviteSettingsResolver;

  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.AUTHORITY_WEB_ORIGIN;
    prisma = {
      setValue: { findMany: jest.fn().mockResolvedValue([]) },
      setDef: { findMany: jest.fn().mockResolvedValue([]) },
    };
    resolver = new InviteSettingsResolver(prisma as never);
  });

  afterEach(() => {
    process.env.SMTP_HOST = prevEnv.SMTP_HOST;
    process.env.SMTP_PORT = prevEnv.SMTP_PORT;
    process.env.SMTP_SECURE = prevEnv.SMTP_SECURE;
    process.env.SMTP_USER = prevEnv.SMTP_USER;
    process.env.SMTP_PASS = prevEnv.SMTP_PASS;
    process.env.SMTP_FROM = prevEnv.SMTP_FROM;
    process.env.AUTHORITY_WEB_ORIGIN = prevEnv.AUTHORITY_WEB_ORIGIN;
    if (prevEnv.SMTP_HOST === undefined) delete process.env.SMTP_HOST;
    if (prevEnv.SMTP_PORT === undefined) delete process.env.SMTP_PORT;
    if (prevEnv.SMTP_SECURE === undefined) delete process.env.SMTP_SECURE;
    if (prevEnv.SMTP_USER === undefined) delete process.env.SMTP_USER;
    if (prevEnv.SMTP_PASS === undefined) delete process.env.SMTP_PASS;
    if (prevEnv.SMTP_FROM === undefined) delete process.env.SMTP_FROM;
    if (prevEnv.AUTHORITY_WEB_ORIGIN === undefined) {
      delete process.env.AUTHORITY_WEB_ORIGIN;
    }
  });

  it('uses code defaults when no set_value / set_def', async () => {
    const cfg = await resolver.resolve('co-1');
    expect(cfg.ttlDays).toBe(7);
    expect(cfg.minPasswordLength).toBe(8);
    expect(cfg.autoSend).toBe(true);
    expect(cfg.emailSubject).toBe('Invitation AUTHORITY');
    expect(cfg.webOrigin).toBe('http://localhost:3000');
    expect(cfg.smtp.host).toBe('');
  });

  it('applies company set_value overrides', async () => {
    prisma.setValue.findMany.mockResolvedValue([
      {
        defKey: IDENTITY_SETTING_KEYS.INVITE_TTL_DAYS,
        valueJson: 14,
      },
      {
        defKey: IDENTITY_SETTING_KEYS.INVITE_MIN_PASSWORD_LENGTH,
        valueJson: 12,
      },
      {
        defKey: IDENTITY_SETTING_KEYS.INVITE_AUTO_SEND,
        valueJson: false,
      },
      {
        defKey: IDENTITY_SETTING_KEYS.INVITE_WEB_ORIGIN,
        valueJson: 'https://app.example.tn/',
      },
      {
        defKey: IDENTITY_SETTING_KEYS.SMTP_HOST,
        valueJson: 'smtp.company.tn',
      },
      {
        defKey: IDENTITY_SETTING_KEYS.SMTP_PORT,
        valueJson: 465,
      },
      {
        defKey: IDENTITY_SETTING_KEYS.SMTP_SECURE,
        valueJson: true,
      },
      {
        defKey: IDENTITY_SETTING_KEYS.SMTP_FROM,
        valueJson: 'noreply@company.tn',
      },
    ]);

    const cfg = await resolver.resolve('co-1');
    expect(cfg.ttlDays).toBe(14);
    expect(cfg.minPasswordLength).toBe(12);
    expect(cfg.autoSend).toBe(false);
    expect(cfg.webOrigin).toBe('https://app.example.tn');
    expect(cfg.smtp).toMatchObject({
      host: 'smtp.company.tn',
      port: 465,
      secure: true,
      from: 'noreply@company.tn',
    });
  });

  it('falls back to env SMTP when company host empty', async () => {
    process.env.SMTP_HOST = 'smtp.env.test';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_FROM = 'env@test';
    process.env.SMTP_USER = 'env-user';
    process.env.SMTP_PASS = 'env-pass';

    const cfg = await resolver.resolve('co-1');
    expect(cfg.smtp.host).toBe('smtp.env.test');
    expect(cfg.smtp.port).toBe(2525);
    expect(cfg.smtp.from).toBe('env@test');
    expect(cfg.smtp.user).toBe('env-user');
    expect(cfg.smtp.pass).toBe('env-pass');
  });

  it('prefers company SMTP over env', async () => {
    process.env.SMTP_HOST = 'smtp.env.test';
    process.env.SMTP_FROM = 'env@test';
    prisma.setValue.findMany.mockResolvedValue([
      {
        defKey: IDENTITY_SETTING_KEYS.SMTP_HOST,
        valueJson: 'smtp.company.tn',
      },
      {
        defKey: IDENTITY_SETTING_KEYS.SMTP_FROM,
        valueJson: 'company@test',
      },
    ]);

    const cfg = await resolver.resolve('co-1');
    expect(cfg.smtp.host).toBe('smtp.company.tn');
    expect(cfg.smtp.from).toBe('company@test');
  });
});
