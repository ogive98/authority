import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  DUNNING_SETTING_DEFAULTS,
  DUNNING_SETTING_KEYS,
  DUNNING_SETTING_META,
  parseWaTemplateBodyParams,
  type DunningChannelRuntimeConfig,
  type DunningSettingKey,
} from './dunning-settings.constants';

/**
 * Resolve finance-dedicated dunning SMTP / WA Cloud prefs (D194/D201).
 * No env fallback — empty until human Prefs.
 */
@Injectable()
export class DunningSettingsResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinitions(): Promise<void> {
    for (const key of Object.values(DUNNING_SETTING_KEYS)) {
      const valueType =
        key === DUNNING_SETTING_KEYS.SMTP_PORT
          ? 'number'
          : key === DUNNING_SETTING_KEYS.SMTP_SECURE
            ? 'boolean'
            : key === DUNNING_SETTING_KEYS.WA_TEMPLATE_BODY_PARAMS
              ? 'json'
              : 'string';
      await this.prisma.setDef.upsert({
        where: { key },
        update: {
          valueType,
          defaultJson: DUNNING_SETTING_DEFAULTS[key],
          description: DUNNING_SETTING_META[key],
          isPrefOnly: true,
        },
        create: {
          key,
          valueType,
          defaultJson: DUNNING_SETTING_DEFAULTS[key],
          description: DUNNING_SETTING_META[key],
          isPrefOnly: true,
        },
      });
    }
  }

  async resolve(companyId: string): Promise<DunningChannelRuntimeConfig> {
    await this.ensureDefinitions();
    const keys = Object.values(DUNNING_SETTING_KEYS);
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [values, defs] = await Promise.all([
      this.prisma.setValue.findMany({
        where: { defKey: { in: keys }, scopeKey, deletedAt: null },
      }),
      this.prisma.setDef.findMany({ where: { key: { in: keys } } }),
    ]);
    const byKey = new Map(values.map((v) => [v.defKey, v.valueJson]));
    const defByKey = new Map(defs.map((d) => [d.key, d.defaultJson]));

    const read = (key: DunningSettingKey): unknown => {
      if (byKey.has(key)) return byKey.get(key);
      if (defByKey.has(key)) return defByKey.get(key);
      return DUNNING_SETTING_DEFAULTS[key];
    };

    const asString = (key: DunningSettingKey): string => {
      const raw = read(key);
      if (typeof raw === 'string') return raw;
      if (raw == null) return '';
      return String(raw);
    };

    const asNumber = (key: DunningSettingKey, fallback: number): number => {
      const raw = read(key);
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
      if (typeof raw === 'string' && raw.trim()) {
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.trunc(n);
      }
      return fallback;
    };

    const asBool = (key: DunningSettingKey, fallback: boolean): boolean => {
      const raw = read(key);
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      return fallback;
    };

    const port = asNumber(
      DUNNING_SETTING_KEYS.SMTP_PORT,
      DUNNING_SETTING_DEFAULTS[DUNNING_SETTING_KEYS.SMTP_PORT],
    );

    return {
      smtp: {
        host: asString(DUNNING_SETTING_KEYS.SMTP_HOST).trim(),
        port,
        secure:
          asBool(
            DUNNING_SETTING_KEYS.SMTP_SECURE,
            DUNNING_SETTING_DEFAULTS[DUNNING_SETTING_KEYS.SMTP_SECURE],
          ) || port === 465,
        user: asString(DUNNING_SETTING_KEYS.SMTP_USER).trim(),
        pass: asString(DUNNING_SETTING_KEYS.SMTP_PASS),
        from: asString(DUNNING_SETTING_KEYS.SMTP_FROM).trim(),
      },
      wa: {
        phoneNumberId: asString(
          DUNNING_SETTING_KEYS.WA_PHONE_NUMBER_ID,
        ).trim(),
        accessToken: asString(DUNNING_SETTING_KEYS.WA_ACCESS_TOKEN),
        apiVersion:
          asString(DUNNING_SETTING_KEYS.WA_API_VERSION).trim() ||
          DUNNING_SETTING_DEFAULTS[DUNNING_SETTING_KEYS.WA_API_VERSION],
        templateName: asString(DUNNING_SETTING_KEYS.WA_TEMPLATE_NAME).trim(),
        templateLanguage: asString(
          DUNNING_SETTING_KEYS.WA_TEMPLATE_LANGUAGE,
        ).trim(),
        templateBodyParams: parseWaTemplateBodyParams(
          read(DUNNING_SETTING_KEYS.WA_TEMPLATE_BODY_PARAMS),
        ),
      },
    };
  }
}
