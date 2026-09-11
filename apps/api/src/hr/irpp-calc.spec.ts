import {
  applyAnnualProgressive,
  computeIrppAmounts,
  validateIrppBrackets,
} from './irpp-calc';

describe('irpp-calc', () => {
  it('requires wageBase, CNSS salarié, VALIDATED slot, and brackets', () => {
    const r = computeIrppAmounts({
      wageBase: 0,
      cnssEmployeeAmount: null,
      cnssReady: false,
      irppSlotValidated: false,
      brackets: [],
      irppLawRef: null,
    });
    expect(r.ready).toBe(false);
    expect(r.pending).toContain('wageBase');
  });

  it('applies annual progressive then /12 (fixture brackets only)', () => {
    // Fixture bands — not Tunisian law (never invent/seed product defaults).
    const brackets = [
      { upToMilli: 5_000_000, rateBps: 0 }, // 0–5000 TND
      { upToMilli: 20_000_000, rateBps: 1000 }, // next to 20000 @ 10%
      { upToMilli: null, rateBps: 2000 }, // above @ 20%
    ];
    expect(validateIrppBrackets(brackets)).toBeNull();

    // taxable monthly 2000 → annual 24000
    // 0–5000 @0 + 5000–20000 @10% = 1500 + 4000–24000 @20% = 800 → annual 2300
    // monthly = 2300/12
    const annual = applyAnnualProgressive(24_000, brackets);
    expect(annual).toBe(2300);

    const r = computeIrppAmounts({
      wageBase: 2200,
      cnssEmployeeAmount: 200,
      cnssReady: true,
      irppSlotValidated: true,
      brackets,
      irppLawRef: 'expert-fixture',
    });
    expect(r.ready).toBe(true);
    expect(r.taxableMonthly).toBe(2000);
    expect(r.annualTaxable).toBe(24_000);
    expect(r.annualIrpp).toBe(2300);
    expect(r.monthlyIrpp).toBe(191.667);
    expect(r.methodNote).toBe('annual_brackets_div_12');
  });

  it('rejects malformed brackets', () => {
    expect(
      validateIrppBrackets([{ upToMilli: 1000, rateBps: 100 }]),
    ).toMatch(/open-ended/);
  });
});
