import { Prisma } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import { SALES_ERROR_CODES } from './sales.constants';
import { SalesException } from './sales.exception';
import {
  normalizeSalesLines,
  sumNormalizedLineTotals,
} from './sales-lines.util';

describe('normalizeSalesLines (D316)', () => {
  it('applies discountPct to lineTotal', () => {
    const lines = normalizeSalesLines([
      { productId: '11111111-1111-1111-1111-111111111111', qty: 10, unitPrice: 5, discountPct: 10 },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].discountPct.toString()).toBe('10');
    expect(lines[0].lineTotal.toString()).toBe('45');
    expect(sumNormalizedLineTotals(lines).toString()).toBe('45');
  });

  it('defaults discountPct to 0', () => {
    const lines = normalizeSalesLines([
      { productId: '11111111-1111-1111-1111-111111111111', qty: 2, unitPrice: 3 },
    ]);
    expect(lines[0].discountPct.equals(new Prisma.Decimal(0))).toBe(true);
    expect(lines[0].lineTotal.toString()).toBe('6');
  });

  it('rejects discountPct > 100', () => {
    try {
      normalizeSalesLines([
        {
          productId: '11111111-1111-1111-1111-111111111111',
          qty: 1,
          unitPrice: 10,
          discountPct: 101,
        },
      ]);
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SalesException);
      const ex = e as SalesException;
      expect(ex.code).toBe(SALES_ERROR_CODES.INVALID_LINE);
      expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('rejects empty lines', () => {
    try {
      normalizeSalesLines([]);
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SalesException);
      expect((e as SalesException).code).toBe(SALES_ERROR_CODES.EMPTY_LINES);
    }
  });
});
