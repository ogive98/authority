/**
 * Finance dunning channel settings (D194/D201) — dedicated SMTP + WA Cloud templates.
 * Siège Préférences → Relances. Empty until human; never invent secrets or template names.
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
  WA_TEMPLATE_NAME: 'finance.dunning.wa.template_name',
  WA_TEMPLATE_LANGUAGE: 'finance.dunning.wa.template_language',
  WA_TEMPLATE_BODY_PARAMS: 'finance.dunning.wa.template_body_params',
  WA_VERIFY_TOKEN: 'finance.dunning.wa.verify_token',
  WA_APP_SECRET: 'finance.dunning.wa.app_secret',
} as const;

export type DunningSettingKey =
  (typeof DUNNING_SETTING_KEYS)[keyof typeof DUNNING_SETTING_KEYS];

/** Ordered Meta template body {{n}} sources — human picks order in Prefs. */
export const WA_TEMPLATE_BODY_PARAM_KEYS = [
  'customer_name',
  'open_item_number',
  'amount_open',
  'currency',
  'due_date',
  'days_past_due',
  'subject',
  'body',
] as const;

export type WaTemplateBodyParamKey =
  (typeof WA_TEMPLATE_BODY_PARAM_KEYS)[number];

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
  [DUNNING_SETTING_KEYS.WA_TEMPLATE_NAME]: '',
  [DUNNING_SETTING_KEYS.WA_TEMPLATE_LANGUAGE]: '',
  [DUNNING_SETTING_KEYS.WA_TEMPLATE_BODY_PARAMS]: [] as string[],
  [DUNNING_SETTING_KEYS.WA_VERIFY_TOKEN]: '',
  [DUNNING_SETTING_KEYS.WA_APP_SECRET]: '',
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
  [DUNNING_SETTING_KEYS.WA_TEMPLATE_NAME]:
    'Meta approved template name (empty until human — D201)',
  [DUNNING_SETTING_KEYS.WA_TEMPLATE_LANGUAGE]:
    'Meta template language code e.g. fr (empty until human)',
  [DUNNING_SETTING_KEYS.WA_TEMPLATE_BODY_PARAMS]:
    'Ordered JSON array of body {{n}} keys (customer_name, open_item_number, …)',
  [DUNNING_SETTING_KEYS.WA_VERIFY_TOKEN]:
    'Meta webhook verify token (empty until human — D206)',
  [DUNNING_SETTING_KEYS.WA_APP_SECRET]:
    'Meta app secret for X-Hub-Signature-256 (write-only — D206)',
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
    templateName: string;
    templateLanguage: string;
    /** Ordered keys for Meta template body parameters. */
    templateBodyParams: WaTemplateBodyParamKey[];
    verifyToken: string;
    appSecret: string;
  };
};

export function isDunningSmtpConfigured(
  smtp: DunningChannelRuntimeConfig['smtp'],
): boolean {
  return Boolean(smtp.host?.trim());
}

/** Cloud credentials + template name/language required (D201 — no free-text send). */
export function isDunningWaConfigured(
  wa: DunningChannelRuntimeConfig['wa'],
): boolean {
  return Boolean(
    wa.phoneNumberId?.trim() &&
      wa.accessToken?.trim() &&
      wa.templateName?.trim() &&
      wa.templateLanguage?.trim(),
  );
}

const ALLOWED_BODY = new Set<string>(WA_TEMPLATE_BODY_PARAM_KEYS);

export function parseWaTemplateBodyParams(
  raw: unknown,
): WaTemplateBodyParamKey[] {
  if (!Array.isArray(raw)) return [];
  const out: WaTemplateBodyParamKey[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const key = item.trim();
    if (!ALLOWED_BODY.has(key)) continue;
    out.push(key as WaTemplateBodyParamKey);
  }
  return out;
}

export type WaTemplateParamContext = {
  customerName: string | null;
  openItemNumber: string;
  amountOpen: string;
  currency: string;
  dueDate: string | null;
  daysPastDue: number | null;
  subject: string;
  body: string;
};

export function resolveWaTemplateBodyTexts(
  keys: WaTemplateBodyParamKey[],
  ctx: WaTemplateParamContext,
): string[] {
  return keys.map((key) => {
    switch (key) {
      case 'customer_name':
        return (ctx.customerName ?? '').slice(0, 1024);
      case 'open_item_number':
        return ctx.openItemNumber.slice(0, 1024);
      case 'amount_open':
        return ctx.amountOpen.slice(0, 1024);
      case 'currency':
        return ctx.currency.slice(0, 1024);
      case 'due_date':
        return (ctx.dueDate ?? '').slice(0, 1024);
      case 'days_past_due':
        return ctx.daysPastDue != null ? String(ctx.daysPastDue) : '';
      case 'subject':
        return ctx.subject.slice(0, 1024);
      case 'body':
        return ctx.body.slice(0, 1024);
      default:
        return '';
    }
  });
}
