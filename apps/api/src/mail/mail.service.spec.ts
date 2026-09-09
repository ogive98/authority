import { MailService } from './mail.service';

describe('MailService', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.SMTP_HOST = prev.SMTP_HOST;
    process.env.SMTP_PORT = prev.SMTP_PORT;
    process.env.SMTP_FROM = prev.SMTP_FROM;
    process.env.SMTP_USER = prev.SMTP_USER;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_USER;
    if (prev.SMTP_HOST !== undefined) process.env.SMTP_HOST = prev.SMTP_HOST;
    if (prev.SMTP_PORT !== undefined) process.env.SMTP_PORT = prev.SMTP_PORT;
    if (prev.SMTP_FROM !== undefined) process.env.SMTP_FROM = prev.SMTP_FROM;
    if (prev.SMTP_USER !== undefined) process.env.SMTP_USER = prev.SMTP_USER;
  });

  it('status reports not configured without SMTP_HOST', () => {
    delete process.env.SMTP_HOST;
    const mail = new MailService();
    expect(mail.isConfigured()).toBe(false);
    expect(mail.status()).toEqual({
      configured: false,
      host: null,
      port: null,
      from: null,
    });
  });

  it('status exposes host/port/from without secrets', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_FROM = 'AUTHORITY <noreply@example.com>';
    process.env.SMTP_PASS = 'secret-should-not-leak';
    const mail = new MailService();
    expect(mail.isConfigured()).toBe(true);
    const s = mail.status();
    expect(s).toEqual({
      configured: true,
      host: 'smtp.example.com',
      port: 587,
      from: 'AUTHORITY <noreply@example.com>',
    });
    expect(JSON.stringify(s)).not.toContain('secret');
  });
});
