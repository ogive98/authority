import {
  computeCnssAmounts,
  currentPeriodYm,
  normalizePeriodYm,
} from './cnss-calc';

describe('computeCnssAmounts', () => {
  it('does not invent rates when seats missing', () => {
    const r = computeCnssAmounts({
      wageBase: 1000,
      employee: null,
      employer: null,
      ceiling: null,
    });
    expect(r.ready).toBe(false);
    expect(r.employeeAmount).toBeNull();
    expect(r.employerAmount).toBeNull();
    expect(r.pending).toEqual(
      expect.arrayContaining([
        'hr.cnss.employee',
        'hr.cnss.employer',
        'hr.cnss.ceiling',
      ]),
    );
  });

  it('applies VALIDATED fixture rates and optional ceiling', () => {
    // Fixture bps only — not Tunisian law rates (never invent/seed product defaults).
    const r = computeCnssAmounts({
      wageBase: 5000,
      employee: { rateBps: 1000, lawRef: 'expert-sal' },
      employer: { rateBps: 2000, lawRef: 'expert-emp' },
      ceiling: { amountTnd: 4000, lawRef: 'expert-plaf' },
    });
    expect(r.ceilingApplied).toBe(true);
    expect(r.assiette).toBe(4000);
    expect(r.employeeAmount).toBe(400); // 10%
    expect(r.employerAmount).toBe(800); // 20%
    expect(r.ready).toBe(true);
  });

  it('normalizes periodYm', () => {
    expect(normalizePeriodYm('2026-09')).toBe('2026-09');
    expect(normalizePeriodYm('2026-13')).toBeNull();
    expect(currentPeriodYm(new Date('2026-09-11T00:00:00Z'))).toBe('2026-09');
  });
});
