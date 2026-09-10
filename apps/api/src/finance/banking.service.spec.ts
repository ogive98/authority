import { FinanceException } from './finance.exception';
import { assertXorMatchTarget } from './banking.service';

describe('assertXorMatchTarget', () => {
  it('accepts payment only', () => {
    expect(() => assertXorMatchTarget({ paymentId: 'p1' })).not.toThrow();
  });

  it('accepts instrument only', () => {
    expect(() => assertXorMatchTarget({ instrumentId: 'i1' })).not.toThrow();
  });

  it('rejects both', () => {
    expect(() =>
      assertXorMatchTarget({ paymentId: 'p1', instrumentId: 'i1' }),
    ).toThrow(FinanceException);
  });

  it('rejects neither', () => {
    expect(() => assertXorMatchTarget({})).toThrow(FinanceException);
  });
});
