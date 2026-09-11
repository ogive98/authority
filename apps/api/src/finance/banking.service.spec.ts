import { FinanceException } from './finance.exception';
import { Prisma } from '@prisma/client';
import { assertMatchSide, assertXorMatchTarget } from './banking.service';
import { FINANCE_ERROR_CODES } from './finance.constants';

describe('assertXorMatchTarget', () => {
  it('accepts payment only', () => {
    expect(() => assertXorMatchTarget({ paymentId: 'p1' })).not.toThrow();
  });

  it('accepts instrument only', () => {
    expect(() => assertXorMatchTarget({ instrumentId: 'i1' })).not.toThrow();
  });

  it('accepts AP disbursement only', () => {
    expect(() => assertXorMatchTarget({ apPaymentId: 'a1' })).not.toThrow();
  });

  it('rejects both AR targets', () => {
    expect(() =>
      assertXorMatchTarget({ paymentId: 'p1', instrumentId: 'i1' }),
    ).toThrow(FinanceException);
  });

  it('rejects AR + AP', () => {
    expect(() =>
      assertXorMatchTarget({ paymentId: 'p1', apPaymentId: 'a1' }),
    ).toThrow(FinanceException);
  });

  it('rejects neither', () => {
    expect(() => assertXorMatchTarget({})).toThrow(FinanceException);
  });
});

describe('assertMatchSide', () => {
  it('allows AP on debit', () => {
    expect(() =>
      assertMatchSide({
        lineAmount: new Prisma.Decimal('-10.000'),
        wantsAp: true,
      }),
    ).not.toThrow();
  });

  it('allows AR on credit', () => {
    expect(() =>
      assertMatchSide({
        lineAmount: new Prisma.Decimal('10.000'),
        wantsAp: false,
      }),
    ).not.toThrow();
  });

  it('rejects AP on credit', () => {
    try {
      assertMatchSide({
        lineAmount: new Prisma.Decimal('10.000'),
        wantsAp: true,
      });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(FinanceException);
      expect((error as FinanceException).code).toBe(
        FINANCE_ERROR_CODES.BANK_MATCH_SIDE,
      );
    }
  });

  it('rejects AR on debit', () => {
    try {
      assertMatchSide({
        lineAmount: new Prisma.Decimal('-10.000'),
        wantsAp: false,
      });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(FinanceException);
      expect((error as FinanceException).code).toBe(
        FINANCE_ERROR_CODES.BANK_MATCH_SIDE,
      );
    }
  });
});
