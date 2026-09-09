import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Runtime SMTP (company Préférences and/or env) — D129/D136. */
export type SmtpRuntimeConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
};

/**
 * Optional SMTP. Prefer company settings via InviteSettingsResolver; env is fallback.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporterCache = new Map<string, Transporter>();

  isConfigured(smtp?: SmtpRuntimeConfig | null): boolean {
    if (smtp) return Boolean(smtp.host?.trim());
    return Boolean(process.env.SMTP_HOST?.trim());
  }

  /** Safe status for admin UI — no secrets (D131). */
  status(smtp?: SmtpRuntimeConfig | null): {
    configured: boolean;
    host: string | null;
    port: number | null;
    from: string | null;
  } {
    if (smtp?.host?.trim()) {
      return {
        configured: true,
        host: smtp.host.trim(),
        port: smtp.port,
        from: smtp.from?.trim() || smtp.user?.trim() || null,
      };
    }
    const host = process.env.SMTP_HOST?.trim() || null;
    if (!host) {
      return { configured: false, host: null, port: null, from: null };
    }
    const port = Number(process.env.SMTP_PORT ?? '587');
    const from =
      process.env.SMTP_FROM?.trim() ||
      process.env.SMTP_USER?.trim() ||
      null;
    return {
      configured: true,
      host,
      port: Number.isFinite(port) ? port : 587,
      from,
    };
  }

  private cacheKey(smtp: SmtpRuntimeConfig): string {
    return JSON.stringify({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user ?? '',
    });
  }

  private getTransporter(smtp: SmtpRuntimeConfig): Transporter {
    const host = smtp.host?.trim();
    if (!host) throw new Error('SMTP host is not set');
    const key = this.cacheKey(smtp);
    const cached = this.transporterCache.get(key);
    if (cached) return cached;
    const transport = nodemailer.createTransport({
      host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? '' } : undefined,
    });
    this.transporterCache.set(key, transport);
    return transport;
  }

  private envSmtp(): SmtpRuntimeConfig | null {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) return null;
    const port = Number(process.env.SMTP_PORT ?? '587');
    return {
      host,
      port: Number.isFinite(port) ? port : 587,
      secure:
        process.env.SMTP_SECURE === 'true' ||
        process.env.SMTP_SECURE === '1' ||
        port === 465,
      user: process.env.SMTP_USER?.trim(),
      pass: process.env.SMTP_PASS ?? '',
      from:
        process.env.SMTP_FROM?.trim() ||
        process.env.SMTP_USER?.trim() ||
        undefined,
    };
  }

  async send(
    input: SendMailInput,
    smtp?: SmtpRuntimeConfig | null,
  ): Promise<void> {
    const cfg = smtp?.host?.trim() ? smtp : this.envSmtp();
    if (!cfg?.host?.trim()) {
      throw new Error('SMTP host is not set');
    }
    const from =
      cfg.from?.trim() ||
      cfg.user?.trim() ||
      'AUTHORITY <noreply@localhost>';
    const transport = this.getTransporter(cfg);
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    this.logger.log(`Mail sent to ${input.to} (${input.subject})`);
  }
}
