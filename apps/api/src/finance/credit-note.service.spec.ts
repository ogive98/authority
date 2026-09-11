import { HttpStatus } from '@nestjs/common';
import { CreditNoteService } from './credit-note.service';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { FinanceException } from './finance.exception';

describe('CreditNoteService.assertAmountCap', () => {
  it('allows CN within remaining invoice TTC', () => {
    expect(() =>
      CreditNoteService.assertAmountCap(119, 50, 69),
    ).not.toThrow();
  });

  it('allows exact full remaining', () => {
    expect(() =>
      CreditNoteService.assertAmountCap(100, 40, 60),
    ).not.toThrow();
  });

  it('rejects when issued sum + this CN exceeds invoice TTC', () => {
    try {
      CreditNoteService.assertAmountCap(100, 60, 50);
      fail('expected FinanceException');
    } catch (error) {
      expect(error).toBeInstanceOf(FinanceException);
      const ex = error as FinanceException;
      expect(ex.code).toBe(FINANCE_ERROR_CODES.CREDIT_NOTE_OVER_CAP);
      expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });
});
