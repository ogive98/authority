import {
  applyAnnualProgressive,
  computeIrppAmounts,
  EMPTY_IRPP_ABATEMENT,
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
      abatement: EMPTY_IRPP_ABATEMENT,
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
      abatement: EMPTY_IRPP_ABATEMENT,
    });
    expect(r.ready).toBe(true);
    expect(r.taxableMonthly).toBe(2000);
    expect(r.annualTaxableBeforeAbat).toBe(24_000);
    expect(r.annualTaxable).toBe(24_000);
    expect(r.annualIrpp).toBe(2300);
    expect(r.monthlyIrpp).toBe(191.667);
    expect(r.methodNote).toBe('annual_brackets_div_12');
  });

  it('reduces annualTaxable by Prefs abatements before brackets (D202)', () => {
    const brackets = [
      { upToMilli: 5_000_000, rateBps: 0 },
      { upToMilli: 20_000_000, rateBps: 1000 },
      { upToMilli: null, rateBps: 2000 },
    ];
    // annual before abat 24000 − chef 1000 − 2×500 = 21500
    const r = computeIrppAmounts({
      wageBase: 2200,
      cnssEmployeeAmount: 200,
      cnssReady: true,
      irppSlotValidated: true,
      brackets,
      irppLawRef: 'expert-fixture',
      abatement: {
        chefSeatValidated: true,
        chefAmountAnnualTnd: 1000,
        chefLawRef: 'chef-fixture',
        enfantSeatValidated: true,
        enfantAmountAnnualTnd: 500,
        enfantLawRef: 'enfant-fixture',
        taxChefDeFamille: true,
        taxEnfantCount: 2,
      },
    });
    expect(r.ready).toBe(true);
    expect(r.annualTaxableBeforeAbat).toBe(24_000);
    expect(r.abatChefAnnual).toBe(1000);
    expect(r.abatEnfantAnnual).toBe(1000);
    expect(r.abatTotalAnnual).toBe(2000);
    expect(r.annualTaxable).toBe(22_000);
    expect(r.annualIrpp).toBe(applyAnnualProgressive(22_000, brackets));
  });

  it('blocks when abatement Prefs VALIDATED but family fields unset (5B)', () => {
    const r = computeIrppAmounts({
      wageBase: 2200,
      cnssEmployeeAmount: 200,
      cnssReady: true,
      irppSlotValidated: true,
      brackets: [
        { upToMilli: 5_000_000, rateBps: 0 },
        { upToMilli: null, rateBps: 1000 },
      ],
      irppLawRef: 'x',
      abatement: {
        chefSeatValidated: true,
        chefAmountAnnualTnd: 100,
        chefLawRef: null,
        enfantSeatValidated: false,
        enfantAmountAnnualTnd: null,
        enfantLawRef: null,
        taxChefDeFamille: null,
        taxEnfantCount: null,
      },
    });
    expect(r.ready).toBe(false);
    expect(r.pending).toContain('employee.tax_chef_de_famille');
  });

  it('rejects malformed brackets', () => {
    expect(
      validateIrppBrackets([{ upToMilli: 1000, rateBps: 100 }]),
    ).toMatch(/open-ended/);
  });
});
