const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();
const defs = [
  ['identity.invite.ttl_days', 'number', 7, 'Durée lien invite (jours)'],
  [
    'identity.invite.min_password_length',
    'number',
    8,
    'MDP min accept invite',
  ],
  ['identity.invite.auto_send', 'boolean', true, 'Envoi SMTP auto'],
  [
    'identity.invite.email_subject',
    'string',
    'Invitation AUTHORITY',
    'Objet invite',
  ],
  [
    'identity.invite.email_body_text',
    'string',
    'Bonjour {{displayName}},\n\nVous êtes invité(e) sur AUTHORITY.\nDéfinissez votre mot de passe via ce lien (valide {{ttlDays}} jours) :\n{{inviteUrl}}\n\n— AUTHORITY',
    'Corps texte',
  ],
  [
    'identity.invite.email_body_html',
    'string',
    '<p>Bonjour {{displayName}},</p><p>Vous êtes invité(e) sur <strong>AUTHORITY</strong>.</p><p><a href="{{inviteUrl}}">Définir mon mot de passe</a> (valide {{ttlDays}} jours).</p><p>— AUTHORITY</p>',
    'Corps HTML',
  ],
  ['identity.invite.web_origin', 'string', '', 'URL publique liens'],
  ['identity.smtp.host', 'string', '', 'SMTP host'],
  ['identity.smtp.port', 'number', 587, 'SMTP port'],
  ['identity.smtp.secure', 'boolean', false, 'SMTP secure'],
  ['identity.smtp.user', 'string', '', 'SMTP user'],
  ['identity.smtp.pass', 'string', '', 'SMTP pass'],
  ['identity.smtp.from', 'string', '', 'SMTP from'],
  [
    'salubrita.outlook.from_email',
    'string',
    '',
    'Adresse expéditeur Outlook/mailto pour certificats',
  ],
  [
    'salubrita.whatsapp.default_prefix',
    'string',
    '',
    'Préfixe téléphone WhatsApp (ex. 216)',
  ],
];

(async () => {
  for (const [key, valueType, defaultJson, description] of defs) {
    await p.setDef.upsert({
      where: { key },
      create: { key, valueType, defaultJson, description, isPrefOnly: true },
      update: { valueType, defaultJson, description, isPrefOnly: true },
    });
    console.log('ok', key);
  }
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
