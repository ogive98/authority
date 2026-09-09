import { Prisma } from '@prisma/client';

export type FefoLot = {
  id: string;
  lotCode: string;
  dlc: Date | null;
  qtyOnHand: Prisma.Decimal;
  qtyReserved: Prisma.Decimal;
};

export type FefoSlice = { lotId: string; qty: Prisma.Decimal };

export function lotAvailable(lot: FefoLot): Prisma.Decimal {
  return lot.qtyOnHand.sub(lot.qtyReserved);
}

/** OPEN lots only — caller filters status. Dated DLC first, null DLC last, then lotCode. */
export function sortFefo(lots: FefoLot[]): FefoLot[] {
  return [...lots].sort((a, b) => {
    if (a.dlc && b.dlc) {
      const delta = a.dlc.getTime() - b.dlc.getTime();
      if (delta !== 0) return delta;
    } else if (a.dlc && !b.dlc) {
      return -1;
    } else if (!a.dlc && b.dlc) {
      return 1;
    }
    return a.lotCode.localeCompare(b.lotCode);
  });
}

/** Returns slices covering qtyNeeded, or null if available lots are short. */
export function pickFefoSlices(
  lots: FefoLot[],
  qtyNeeded: Prisma.Decimal,
): FefoSlice[] | null {
  if (qtyNeeded.lte(0)) return [];
  const slices: FefoSlice[] = [];
  let remaining = qtyNeeded;
  for (const lot of sortFefo(lots)) {
    const avail = lotAvailable(lot);
    if (avail.lte(0)) continue;
    const take = avail.lt(remaining) ? avail : remaining;
    slices.push({ lotId: lot.id, qty: take });
    remaining = remaining.sub(take);
    if (remaining.lte(0)) return slices;
  }
  return null;
}

export function sumDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, v) => acc.add(v), new Prisma.Decimal(0));
}
