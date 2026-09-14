/**
 * Tunisian RIB (BBAN) — structural checksum only (D232).
 * Format: 20 digits = bank(2) + agency(3) + account(13) + key(2).
 * Valid when the 20-digit integer ≡ 0 (mod 97).
 * Also accepts IBAN `TN` + 22 digits (ISO 7064) and normalizes to RIB digits.
 *
 * Does NOT invent bank directories or prove the account exists at the bank.
 */

export type TunisianRibParts = {
  /** Compact 20 digits */
  digits: string;
  bankCode: string;
  agencyCode: string;
  accountNumber: string;
  key: string;
  /** Spaced display: BB GGG CCCCCCCCCCCCC KK */
  formatted: string;
};

export class TunisianRibError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TunisianRibError';
  }
}

/** Strip spaces / dashes; uppercase for IBAN. */
export function normalizeRibInput(raw: string): string {
  return raw.replace(/[\s\-_.]/g, '').toUpperCase();
}

/**
 * Normalize to 20-digit RIB or throw.
 * Accepts: 20 digits, or TN + 22 char IBAN (IBAN check + RIB mod 97).
 */
export function assertTunisianRib(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    throw new TunisianRibError('RIB is required.');
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    throw new TunisianRibError('RIB is required.');
  }
  const normalized = normalizeRibInput(trimmed);

  if (/^TN\d{22}$/.test(normalized)) {
    if (!isValidTunisianIban(normalized)) {
      throw new TunisianRibError('IBAN TN checksum is invalid.');
    }
    const bban = normalized.slice(4);
    if (!isValidTunisianRibDigits(bban)) {
      throw new TunisianRibError('RIB key (mod 97) is invalid.');
    }
    return bban;
  }

  if (!/^\d{20}$/.test(normalized)) {
    throw new TunisianRibError(
      'RIB must be 20 digits (or IBAN TN + 22 characters).',
    );
  }
  if (!isValidTunisianRibDigits(normalized)) {
    throw new TunisianRibError('RIB key (mod 97) is invalid.');
  }
  return normalized;
}

/** Empty → null; otherwise assert + return compact 20 digits. */
export function normalizeOptionalTunisianRib(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return assertTunisianRib(trimmed);
}

export function parseTunisianRib(digits20: string): TunisianRibParts {
  const digits = assertTunisianRib(digits20);
  return {
    digits,
    bankCode: digits.slice(0, 2),
    agencyCode: digits.slice(2, 5),
    accountNumber: digits.slice(5, 18),
    key: digits.slice(18, 20),
    formatted: `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 18)} ${digits.slice(18, 20)}`,
  };
}

/** 20-digit RIB is valid iff number ≡ 0 (mod 97). */
export function isValidTunisianRibDigits(digits20: string): boolean {
  if (!/^\d{20}$/.test(digits20)) return false;
  return BigInt(digits20) % 97n === 0n;
}

/** Key for first 18 digits so that full RIB ≡ 0 (mod 97). */
export function computeTunisianRibKey(first18: string): string {
  if (!/^\d{18}$/.test(first18)) {
    throw new TunisianRibError('RIB body must be 18 digits.');
  }
  const rem = Number((BigInt(first18) * 100n) % 97n);
  const key = (97 - rem) % 97;
  return String(key).padStart(2, '0');
}

/** ISO 7064 mod-97-10 for IBAN. */
export function isValidTunisianIban(iban: string): boolean {
  const n = normalizeRibInput(iban);
  if (!/^TN\d{22}$/.test(n)) return false;
  const rearranged = `${n.slice(4)}${n.slice(0, 4)}`;
  let expanded = '';
  for (const ch of rearranged) {
    if (ch >= 'A' && ch <= 'Z') {
      expanded += String(ch.charCodeAt(0) - 55);
    } else {
      expanded += ch;
    }
  }
  return BigInt(expanded) % 97n === 1n;
}

/**
 * Build IBAN TN + check + 20-digit RIB (ISO 7064).
 * Does not invent BIC or prove the account exists.
 */
export function toTunisianIban(ribRaw: string | null | undefined): string {
  const bban = assertTunisianRib(ribRaw);
  const rearr = `${bban}TN00`;
  let expanded = '';
  for (const ch of rearr) {
    if (ch >= 'A' && ch <= 'Z') {
      expanded += String(ch.charCodeAt(0) - 55);
    } else {
      expanded += ch;
    }
  }
  const rem = Number(BigInt(expanded) % 97n);
  const check = String(98 - rem).padStart(2, '0');
  const iban = `TN${check}${bban}`;
  if (!isValidTunisianIban(iban)) {
    throw new TunisianRibError('Failed to compute Tunisian IBAN checksum.');
  }
  return iban;
}
