import {
  assertTunisianRib,
  computeTunisianRibKey,
  isValidTunisianIban,
  isValidTunisianRibDigits,
  normalizeOptionalTunisianRib,
  parseTunisianRib,
  toTunisianIban,
} from './rib-tn';

describe('rib-tn (D232)', () => {
  const amen = '07040005810111129653';

  it('accepts known valid Amen RIB', () => {
    expect(assertTunisianRib(amen)).toBe(amen);
    expect(assertTunisianRib('07 040 0058101111296 53')).toBe(amen);
    expect(isValidTunisianRibDigits(amen)).toBe(true);
  });

  it('rejects bad length and bad key', () => {
    expect(() => assertTunisianRib('123')).toThrow(/20 digits/);
    expect(() => assertTunisianRib('07040005810111129600')).toThrow(/mod 97/);
  });

  it('normalizes empty optional to null', () => {
    expect(normalizeOptionalTunisianRib('')).toBeNull();
    expect(normalizeOptionalTunisianRib('  ')).toBeNull();
    expect(normalizeOptionalTunisianRib(null)).toBeNull();
  });

  it('computes key so full RIB % 97 === 0', () => {
    const body = '200060001234567890';
    const key = computeTunisianRibKey(body);
    expect(isValidTunisianRibDigits(body + key)).toBe(true);
  });

  it('parses parts', () => {
    const p = parseTunisianRib(amen);
    expect(p.bankCode).toBe('07');
    expect(p.agencyCode).toBe('040');
    expect(p.accountNumber).toBe('0058101111296');
    expect(p.key).toBe('53');
  });

  it('accepts valid TN IBAN for Amen RIB', () => {
    const iban = toTunisianIban(amen);
    expect(isValidTunisianIban(iban)).toBe(true);
    expect(assertTunisianRib(iban)).toBe(amen);
  });

  it('toTunisianIban is stable and round-trips', () => {
    const iban = toTunisianIban(amen);
    expect(iban).toMatch(/^TN\d{22}$/);
    expect(toTunisianIban(iban)).toBe(iban);
  });
});
