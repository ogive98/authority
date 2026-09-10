import {
  evaluateCreditPressure,
  normalizeWarnRatio,
} from './credit-pressure.resolver';

describe('CreditPressureResolver helpers (D185)', () => {
  it('normalizes warn ratio into (0.05, 1]', () => {
    expect(normalizeWarnRatio(0.8)).toBe(0.8);
    expect(normalizeWarnRatio('0.9')).toBe(0.9);
    expect(normalizeWarnRatio(0)).toBe(0.05);
    expect(normalizeWarnRatio(2)).toBe(1);
    expect(normalizeWarnRatio('x')).toBe(0.8);
  });

  it('returns null level when no credit limit', () => {
    const r = evaluateCreditPressure({
      outstanding: 500,
      creditLimit: null,
      warnRatio: 0.8,
    });
    expect(r.level).toBeNull();
    expect(r.ratio).toBeNull();
  });

  it('warns and breaches against as-recorded outstanding', () => {
    expect(
      evaluateCreditPressure({
        outstanding: 700,
        creditLimit: 1000,
        warnRatio: 0.8,
      }).level,
    ).toBe('ok');
    expect(
      evaluateCreditPressure({
        outstanding: 850,
        creditLimit: 1000,
        warnRatio: 0.8,
      }).level,
    ).toBe('warn');
    expect(
      evaluateCreditPressure({
        outstanding: 1000,
        creditLimit: 1000,
        warnRatio: 0.8,
      }).level,
    ).toBe('breach');
  });
});
