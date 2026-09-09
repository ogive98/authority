import { Prisma } from '@prisma/client';
import { pickFefoSlices, sortFefo } from './inventory.fefo';

function lot(input: {
  id: string;
  lotCode: string;
  dlc?: string | null;
  onHand: string;
  reserved?: string;
}) {
  return {
    id: input.id,
    lotCode: input.lotCode,
    dlc: input.dlc ? new Date(input.dlc) : null,
    qtyOnHand: new Prisma.Decimal(input.onHand),
    qtyReserved: new Prisma.Decimal(input.reserved ?? '0'),
  };
}

describe('pickFefoSlices', () => {
  it('picks earliest DLC first and splits across lots', () => {
    const slices = pickFefoSlices(
      [
        lot({ id: 'late', lotCode: 'L-2', dlc: '2026-12-01', onHand: '10' }),
        lot({ id: 'soon', lotCode: 'L-1', dlc: '2026-10-01', onHand: '4' }),
      ],
      new Prisma.Decimal(6),
    );
    expect(slices?.map((s) => ({ lotId: s.lotId, qty: s.qty.toString() }))).toEqual(
      [
        { lotId: 'soon', qty: '4' },
        { lotId: 'late', qty: '2' },
      ],
    );
  });

  it('puts null DLC after dated lots', () => {
    const ordered = sortFefo([
      lot({ id: 'none', lotCode: 'Z', dlc: null, onHand: '5' }),
      lot({ id: 'dated', lotCode: 'A', dlc: '2027-01-01', onHand: '5' }),
    ]);
    expect(ordered.map((l) => l.id)).toEqual(['dated', 'none']);
  });

  it('skips lots with no available qty (reserved/quarantine leftover)', () => {
    const slices = pickFefoSlices(
      [
        lot({
          id: 'full',
          lotCode: 'A',
          dlc: '2026-09-01',
          onHand: '5',
          reserved: '5',
        }),
        lot({ id: 'open', lotCode: 'B', dlc: '2026-10-01', onHand: '8' }),
      ],
      new Prisma.Decimal(3),
    );
    expect(slices?.map((s) => ({ lotId: s.lotId, qty: s.qty.toString() }))).toEqual(
      [{ lotId: 'open', qty: '3' }],
    );
  });

  it('returns null when lots cannot cover qty', () => {
    expect(
      pickFefoSlices(
        [lot({ id: 'a', lotCode: 'A', dlc: '2026-10-01', onHand: '2' })],
        new Prisma.Decimal(5),
      ),
    ).toBeNull();
  });
});
