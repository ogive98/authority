import {
  isDunningSmtpConfigured,
  isDunningWaConfigured,
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

  it('requires wa phone id and token', () => {
    expect(
      isDunningWaConfigured({
        phoneNumberId: '123',
        accessToken: '',
        apiVersion: 'v21.0',
      }),
    ).toBe(false);
    expect(
      isDunningWaConfigured({
        phoneNumberId: '123',
        accessToken: 'tok',
        apiVersion: 'v21.0',
      }),
    ).toBe(true);
  });
});
