/**
 * Company settings for invitations + SMTP (D136).
 * Siège = Préférences → Envois. Defaults live here + set_def — not scattered magic.
 */

export const IDENTITY_SETTING_KEYS = {
  INVITE_TTL_DAYS: 'identity.invite.ttl_days',
  INVITE_MIN_PASSWORD_LENGTH: 'identity.invite.min_password_length',
  INVITE_AUTO_SEND: 'identity.invite.auto_send',
  INVITE_EMAIL_SUBJECT: 'identity.invite.email_subject',
  INVITE_EMAIL_BODY_TEXT: 'identity.invite.email_body_text',
  INVITE_EMAIL_BODY_HTML: 'identity.invite.email_body_html',
  INVITE_WEB_ORIGIN: 'identity.invite.web_origin',
  SMTP_HOST: 'identity.smtp.host',
  SMTP_PORT: 'identity.smtp.port',
  SMTP_SECURE: 'identity.smtp.secure',
  SMTP_USER: 'identity.smtp.user',
  SMTP_PASS: 'identity.smtp.pass',
  SMTP_FROM: 'identity.smtp.from',
} as const;

export type IdentitySettingKey =
  (typeof IDENTITY_SETTING_KEYS)[keyof typeof IDENTITY_SETTING_KEYS];

const DEFAULT_BODY_TEXT = `Bonjour {{displayName}},

Vous êtes invité(e) sur AUTHORITY.
Définissez votre mot de passe via ce lien (valide {{ttlDays}} jours) :
{{inviteUrl}}

— AUTHORITY`;

const DEFAULT_BODY_HTML = `<p>Bonjour {{displayName}},</p><p>Vous êtes invité(e) sur <strong>AUTHORITY</strong>.</p><p><a href="{{inviteUrl}}">Définir mon mot de passe</a> (valide {{ttlDays}} jours).</p><p>— AUTHORITY</p>`;

export const IDENTITY_SETTING_DEFAULTS = {
  [IDENTITY_SETTING_KEYS.INVITE_TTL_DAYS]: 7,
  [IDENTITY_SETTING_KEYS.INVITE_MIN_PASSWORD_LENGTH]: 8,
  [IDENTITY_SETTING_KEYS.INVITE_AUTO_SEND]: true,
  [IDENTITY_SETTING_KEYS.INVITE_EMAIL_SUBJECT]: 'Invitation AUTHORITY',
  [IDENTITY_SETTING_KEYS.INVITE_EMAIL_BODY_TEXT]: DEFAULT_BODY_TEXT,
  [IDENTITY_SETTING_KEYS.INVITE_EMAIL_BODY_HTML]: DEFAULT_BODY_HTML,
  [IDENTITY_SETTING_KEYS.INVITE_WEB_ORIGIN]: '',
  [IDENTITY_SETTING_KEYS.SMTP_HOST]: '',
  [IDENTITY_SETTING_KEYS.SMTP_PORT]: 587,
  [IDENTITY_SETTING_KEYS.SMTP_SECURE]: false,
  [IDENTITY_SETTING_KEYS.SMTP_USER]: '',
  [IDENTITY_SETTING_KEYS.SMTP_PASS]: '',
  [IDENTITY_SETTING_KEYS.SMTP_FROM]: '',
} as const;

export type InviteRuntimeConfig = {
  ttlDays: number;
  minPasswordLength: number;
  autoSend: boolean;
  emailSubject: string;
  emailBodyText: string;
  emailBodyHtml: string;
  webOrigin: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
};

export function renderInviteTemplate(
  template: string,
  vars: {
    displayName: string;
    inviteUrl: string;
    ttlDays: number;
    email?: string;
  },
): string {
  const safeName = vars.displayName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return template
    .replaceAll('{{displayName}}', vars.displayName)
    .replaceAll('{{displayNameHtml}}', safeName)
    .replaceAll('{{inviteUrl}}', vars.inviteUrl)
    .replaceAll('{{ttlDays}}', String(vars.ttlDays))
    .replaceAll('{{email}}', vars.email ?? '');
}

/** HTML templates should use {{displayName}} escaped via render — escape name for HTML. */
export function renderInviteHtml(
  template: string,
  vars: {
    displayName: string;
    inviteUrl: string;
    ttlDays: number;
    email?: string;
  },
): string {
  const safeName = vars.displayName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return template
    .replaceAll('{{displayName}}', safeName)
    .replaceAll('{{inviteUrl}}', vars.inviteUrl)
    .replaceAll('{{ttlDays}}', String(vars.ttlDays))
    .replaceAll('{{email}}', vars.email ?? '');
}
