/**
 * Finance dunning channel settings (D194) — dedicated SMTP + WA Cloud.
 * Siège Préférences → Relances. Empty until human; never invent secrets.
 */

export const DUNNING_SETTING_KEYS = {
  SMTP_HOST: 'finance.dunning.smtp.host',
  SMTP_PORT: 'finance.dunning.smtp.port',
  SMTP_SECURE: 'finance.dunning.smtp.secure',
  SMTP_USER: 'finance.dunning.smtp.user',
  SMTP_PASS: 'finance.dunning.smtp.pass',
  SMTP_FROM: 'finance.dunning.smtp.from',
  WA_PHONE_NUMBER_ID: 'finance.dunning.wa.phone_number_id',
  WA_ACCESS_TOKEN: 'finance.dunning.wa.access_token',
  WA_API_VERSION: 'finance.dunning.wa.api_version',
} as const;

export type DunningSettingKey =
  (typeof DUNNING_SETTING_KEYS)[keyof typeof DUNNING_SETTING_KEYS];

export const DUNNING_SETTING_DEFAULTS = {
  [DUNNING_SETTING_KEYS.SMTP_HOST]: '',
  [DUNNING_SETTING_KEYS.SMTP_PORT]: 587,
  [DUNNING_SETTING_KEYS.SMTP_SECURE]: false,
  [DUNNING_SETTING_KEYS.SMTP_USER]: '',
  [DUNNING_SETTING_KEYS.SMTP_PASS]: '',
  [DUNNING_SETTING_KEYS.SMTP_FROM]: '',
  [DUNNING_SETTING_KEYS.WA_PHONE_NUMBER_ID]: '',
  [DUNNING_SETTING_KEYS.WA_ACCESS_TOKEN]: '',
  [DUNNING_SETTING_KEYS.WA_API_VERSION]: 'v21.0',
} as const;

export const DUNNING_SETTING_META: Record<DunningSettingKey, string> = {
  [DUNNING_SETTING_KEYS.SMTP_HOST]:
    'Dunning SMTP host (finance-dedicated — empty until human)',
  [DUNNING_SETTING_KEYS.SMTP_PORT]: 'Dunning SMTP port',
  [DUNNING_SETTING_KEYS.SMTP_SECURE]: 'Dunning SMTP TLS (true for 465)',
  [DUNNING_SETTING_KEYS.SMTP_USER]: 'Dunning SMTP user',
  [DUNNING_SETTING_KEYS.SMTP_PASS]:
    'Dunning SMTP password (write-only secret)',
  [DUNNING_SETTING_KEYS.SMTP_FROM]: 'Dunning SMTP From header',
  [DUNNING_SETTING_KEYS.WA_PHONE_NUMBER_ID]:
    'WhatsApp Cloud API phone number id (empty until human)',
  [DUNNING_SETTING_KEYS.WA_ACCESS_TOKEN]:
    'WhatsApp Cloud API access token (write-only secret)',
  [DUNNING_SETTING_KEYS.WA_API_VERSION]:
    'WhatsApp Graph API version (e.g. v21.0)',
};

export type DunningChannelRuntimeConfig = {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  wa: {
    phoneNumberId: string;
    accessToken: string;
    apiVersion: string;
  };
};

export function isDunningSmtpConfigured(
  smtp: DunningChannelRuntimeConfig['smtp'],
): boolean {
  return Boolean(smtp.host?.trim());
}

export function isDunningWaConfigured(
  wa: DunningChannelRuntimeConfig['wa'],
): boolean {
  return Boolean(wa.phoneNumberId?.trim() && wa.accessToken?.trim());
}
