import {
  isDunningSmtpConfigured,
  isDunningWaConfigured,
  parseWaTemplateBodyParams,
  resolveWaTemplateBodyTexts,
} from './dunning-settings.constants';

describe('dunning channel config helpers', () => {
  it('requires smtp host', () => {
    expect(
      isDunningSmtpConfigured({
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: '',
      }),
    ).toBe(false);
    expect(
      isDunningSmtpConfigured({
        host: 'smtp.relances.tn',
        port: 587,
        secure: false,
        user: 'u',
        pass: 'p',
        from: '',
      }),
    ).toBe(true);
  });

  it('requires wa credentials and template name/language (D201)', () => {
    expect(
      isDunningWaConfigured({
        phoneNumberId: '123',
        accessToken: 'tok',
        apiVersion: 'v21.0',
        templateName: '',
        templateLanguage: 'fr',
        templateBodyParams: [],
        verifyToken: '',
        appSecret: '',
      }),
    ).toBe(false);
    expect(
      isDunningWaConfigured({
        phoneNumberId: '123',
        accessToken: 'tok',
        apiVersion: 'v21.0',
        templateName: 'relance_creance',
        templateLanguage: 'fr',
        templateBodyParams: ['customer_name'],
        verifyToken: '',
        appSecret: '',
      }),
    ).toBe(true);
  });

  it('parses and resolves template body params', () => {
    expect(
      parseWaTemplateBodyParams([
        'customer_name',
        'bogus',
        'amount_open',
        1,
        'currency',
      ]),
    ).toEqual(['customer_name', 'amount_open', 'currency']);
    expect(
      resolveWaTemplateBodyTexts(
        ['customer_name', 'open_item_number', 'amount_open', 'days_past_due'],
        {
          customerName: 'Fromagerie X',
          openItemNumber: 'OI-1',
          amountOpen: '100.000',
          currency: 'TND',
          dueDate: '2026-01-01',
          daysPastDue: 12,
          subject: 'Relance',
          body: '…',
        },
      ),
    ).toEqual(['Fromagerie X', 'OI-1', '100.000', '12']);
  });
});
