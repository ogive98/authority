import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  IDENTITY_SETTING_DEFAULTS,
  IDENTITY_SETTING_KEYS,
  type InviteRuntimeConfig,
} from './identity-settings.constants';

/**
 * Resolve invite/SMTP company settings (D136).
 * Order: company set_value → set_def.defaultJson → code defaults → env (SMTP/origin only).
 */
@Injectable()
export class InviteSettingsResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(companyId: string): Promise<InviteRuntimeConfig> {
    const keys = Object.values(IDENTITY_SETTING_KEYS);
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [values, defs] = await Promise.all([
      this.prisma.setValue.findMany({
        where: {
          defKey: { in: keys },
          scopeKey,
          deletedAt: null,
        },
      }),
      this.prisma.setDef.findMany({ where: { key: { in: keys } } }),
    ]);
    const byKey = new Map(values.map((v) => [v.defKey, v.valueJson]));
    const defByKey = new Map(defs.map((d) => [d.key, d.defaultJson]));

    const read = (key: string): unknown => {
      if (byKey.has(key)) return byKey.get(key);
      if (defByKey.has(key)) return defByKey.get(key);
      return IDENTITY_SETTING_DEFAULTS[
        key as keyof typeof IDENTITY_SETTING_DEFAULTS
      ];
    };

    const asString = (key: string): string => {
      const raw = read(key);
      if (typeof raw === 'string') return raw;
      if (raw == null) return '';
      return String(raw);
    };

    const asNumber = (key: string, fallback: number): number => {
      const raw = read(key);
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
      if (typeof raw === 'string' && raw.trim()) {
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.trunc(n);
      }
      return fallback;
    };

    const asBool = (key: string, fallback: boolean): boolean => {
      const raw = read(key);
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      return fallback;
    };

    const ttlDays = Math.max(
      1,
      asNumber(
        IDENTITY_SETTING_KEYS.INVITE_TTL_DAYS,
        IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.INVITE_TTL_DAYS],
      ),
    );
    const minPasswordLength = Math.max(
      6,
      asNumber(
        IDENTITY_SETTING_KEYS.INVITE_MIN_PASSWORD_LENGTH,
        IDENTITY_SETTING_DEFAULTS[
          IDENTITY_SETTING_KEYS.INVITE_MIN_PASSWORD_LENGTH
        ],
      ),
    );

    let webOrigin = asString(IDENTITY_SETTING_KEYS.INVITE_WEB_ORIGIN).trim();
    if (!webOrigin) {
      webOrigin =
        process.env.AUTHORITY_WEB_ORIGIN?.replace(/\/$/, '') ||
        'http://localhost:3000';
    } else {
      webOrigin = webOrigin.replace(/\/$/, '');
    }

    let smtpHost = asString(IDENTITY_SETTING_KEYS.SMTP_HOST).trim();
    let smtpPort = asNumber(
      IDENTITY_SETTING_KEYS.SMTP_PORT,
      IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.SMTP_PORT],
    );
    let smtpSecure = asBool(
      IDENTITY_SETTING_KEYS.SMTP_SECURE,
      IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.SMTP_SECURE],
    );
    let smtpUser = asString(IDENTITY_SETTING_KEYS.SMTP_USER).trim();
    let smtpPass = asString(IDENTITY_SETTING_KEYS.SMTP_PASS);
    let smtpFrom = asString(IDENTITY_SETTING_KEYS.SMTP_FROM).trim();

    // Env fallback when company SMTP host empty (migration / single-tenant ops).
    if (!smtpHost && process.env.SMTP_HOST?.trim()) {
      smtpHost = process.env.SMTP_HOST.trim();
      smtpPort = Number(process.env.SMTP_PORT ?? smtpPort) || smtpPort;
      smtpSecure =
        process.env.SMTP_SECURE === 'true' ||
        process.env.SMTP_SECURE === '1' ||
        smtpPort === 465 ||
        smtpSecure;
      smtpUser = process.env.SMTP_USER?.trim() || smtpUser;
      smtpPass =
        process.env.SMTP_PASS !== undefined ? process.env.SMTP_PASS : smtpPass;
      smtpFrom =
        process.env.SMTP_FROM?.trim() ||
        process.env.SMTP_USER?.trim() ||
        smtpFrom;
    }

    return {
      ttlDays,
      minPasswordLength,
      autoSend: asBool(
        IDENTITY_SETTING_KEYS.INVITE_AUTO_SEND,
        IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.INVITE_AUTO_SEND],
      ),
      emailSubject:
        asString(IDENTITY_SETTING_KEYS.INVITE_EMAIL_SUBJECT).trim() ||
        IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.INVITE_EMAIL_SUBJECT],
      emailBodyText:
        asString(IDENTITY_SETTING_KEYS.INVITE_EMAIL_BODY_TEXT).trim() ||
        IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.INVITE_EMAIL_BODY_TEXT],
      emailBodyHtml:
        asString(IDENTITY_SETTING_KEYS.INVITE_EMAIL_BODY_HTML).trim() ||
        IDENTITY_SETTING_DEFAULTS[IDENTITY_SETTING_KEYS.INVITE_EMAIL_BODY_HTML],
      webOrigin,
      smtp: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure || smtpPort === 465,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom,
      },
    };
  }
}
