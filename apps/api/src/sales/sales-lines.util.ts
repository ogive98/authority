import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SALES_ERROR_CODES } from './sales.constants';
import { SalesException } from './sales.exception';

export type SalesLineInput = {
  productId: string;
  qty: number;
  unitPrice: number;
  discountPct?: number;
};

export type NormalizedSalesLine = {
  productId: string;
  qty: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountPct: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

/** Shared line math for orders + quotes (D316). discountPct clamped 0–100. */
export function normalizeSalesLines(
  lines: SalesLineInput[],
): NormalizedSalesLine[] {
  if (!lines.length) {
    throw new SalesException(
      SALES_ERROR_CODES.EMPTY_LINES,
      'At least one line is required.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return lines.map((l) => {
    const qty = new Prisma.Decimal(l.qty);
    const unitPrice = new Prisma.Decimal(l.unitPrice);
    const discountPct = new Prisma.Decimal(l.discountPct ?? 0);
    if (
      qty.lte(0) ||
      unitPrice.lt(0) ||
      discountPct.lt(0) ||
      discountPct.gt(100)
    ) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_LINE,
        'Invalid line quantity, price, or discount.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const lineTotal = qty
      .mul(unitPrice)
      .mul(new Prisma.Decimal(1).sub(discountPct.div(100)));
    return {
      productId: l.productId,
      qty,
      unitPrice,
      discountPct,
      lineTotal,
    };
  });
}

export function sumNormalizedLineTotals(
  lines: Array<{ lineTotal: Prisma.Decimal }>,
): Prisma.Decimal {
  return lines.reduce(
    (acc, l) => acc.add(l.lineTotal),
    new Prisma.Decimal(0),
  );
}
