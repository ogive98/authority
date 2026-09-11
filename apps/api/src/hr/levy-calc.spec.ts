import { computeEmployerLevy, computeHrLevies } from './levy-calc';

describe('computeHrLevies', () => {
  it('does not invent rates when Prefs seats are empty', () => {
    const r = computeHrLevies({
      wageBase: 1000,
      tfp: null,
      foprolos: null,
    });
    expect(r.ready).toBe(false);
    expect(r.tfp.amount).toBeNull();
    expect(r.foprolos.amount).toBeNull();
    expect(r.pending).toEqual(
      expect.arrayContaining(['hr.tfp', 'hr.foprolos']),
    );
  });

  it('applies VALIDATED fixture rateBps only (not Tunisian law defaults)', () => {
    const r = computeHrLevies({
      wageBase: 1000,
      tfp: { rateBps: 200, lawRef: 'expert-tfp' },
      foprolos: { rateBps: 100, lawRef: 'expert-fop' },
    });
    expect(r.ready).toBe(true);
    expect(r.tfp.amount).toBe(20);
    expect(r.foprolos.amount).toBe(10);
    expect(r.pending).toEqual([]);
  });

  it('treats validated 0 bps as zero levy, not missing', () => {
    const line = computeEmployerLevy({
      wageBase: 1000,
      slotKey: 'hr.tfp',
      rate: { rateBps: 0, lawRef: 'expert-zero' },
    });
    expect(line.ready).toBe(true);
    expect(line.amount).toBe(0);
  });

  it('does not invent a ceiling — full wageBase × rate', () => {
    const line = computeEmployerLevy({
      wageBase: 9000,
      slotKey: 'hr.foprolos',
      rate: { rateBps: 100, lawRef: 'expert' },
    });
    expect(line.amount).toBe(90);
  });
});
