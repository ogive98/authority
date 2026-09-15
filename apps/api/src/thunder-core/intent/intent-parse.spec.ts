import { parseIntentCommand } from './intent-parse';
import { routeForIntentAction } from './intent-action-map';

describe('parseIntentCommand', () => {
  it('parses Ahmed 1000 DT', () => {
    const p = parseIntentCommand('Ahmed 1000 DT');
    expect(p.personToken).toBe('Ahmed');
    expect(p.amount).toBe(1000);
    expect(p.currency).toBe('TND');
  });

  it('parses spaced thousands', () => {
    const p = parseIntentCommand('1 000 dinars');
    expect(p.amount).toBe(1000);
    expect(p.personToken).toBeNull();
  });
});

describe('routeForIntentAction', () => {
  it('opens customer fiche with uuid only', () => {
    expect(
      routeForIntentAction(
        'open_entity',
        'customer',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ),
    ).toBe('/customers/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(routeForIntentAction('open_entity', 'customer', 'abc')).toBe(
      '/customers',
    );
  });

  it('ap_payment prefill query', () => {
    expect(
      routeForIntentAction('ap_payment', 'supplier', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', {
        amount: 1000,
        label: 'Ahmed',
      }),
    ).toBe(
      '/finance/ap-bills?source=authority_x&create=1&supplierId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&amount=1000&vendorName=Ahmed',
    );
  });
});
