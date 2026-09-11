import { HttpStatus } from '@nestjs/common';
import { assertPositiveApAmount } from './ap-payment.service';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { FinanceException } from './finance.exception';

describe('assertPositiveApAmount', () => {
  it('accepts a positive TND amount', () => {
    expect(() => assertPositiveApAmount(12.5)).not.toThrow();
  });

  it('rejects zero and negative', () => {
    for (const n of [0, -1, Number.NaN]) {
      try {
        assertPositiveApAmount(n);
        fail(`expected throw for ${n}`);
      } catch (error) {
        expect(error).toBeInstanceOf(FinanceException);
        const ex = error as FinanceException;
        expect(ex.code).toBe(FINANCE_ERROR_CODES.INVALID_AMOUNT);
        expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    }
  });
});
