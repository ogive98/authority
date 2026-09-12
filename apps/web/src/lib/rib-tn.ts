/**
 * Tunisian RIB client helpers (D232) — mirror of API `rib-tn.ts`.
 * Structural checksum only; does not invent bank directories.
 */

export function normalizeRibInput(raw: string): string {
  return raw.replace(/[\s\-_.]/g, "").toUpperCase();
}

export function isValidTunisianRibDigits(digits20: string): boolean {
  if (!/^\d{20}$/.test(digits20)) return false;
  try {
    return BigInt(digits20) % 97n === 0n;
  } catch {
    return false;
  }
}

export function isValidTunisianIban(iban: string): boolean {
  const n = normalizeRibInput(iban);
  if (!/^TN\d{22}$/.test(n)) return false;
  const rearranged = `${n.slice(4)}${n.slice(0, 4)}`;
  let expanded = "";
  for (const ch of rearranged) {
    if (ch >= "A" && ch <= "Z") {
      expanded += String(ch.charCodeAt(0) - 55);
    } else {
      expanded += ch;
    }
  }
  try {
    return BigInt(expanded) % 97n === 1n;
  } catch {
    return false;
  }
}

/** Live field hint — empty is OK (optional until transfer). */
export function ribFieldHint(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = normalizeRibInput(trimmed);
  if (/^TN\d{22}$/.test(n)) {
    if (!isValidTunisianIban(n)) return "IBAN TN : clé de contrôle invalide";
    const bban = n.slice(4);
    if (!isValidTunisianRibDigits(bban)) return "RIB (BBAN) : clé mod 97 invalide";
    return null;
  }
  if (!/^\d{20}$/.test(n)) {
    return "20 chiffres (ou IBAN TN…) — espaces ignorés";
  }
  if (!isValidTunisianRibDigits(n)) return "Clé RIB (mod 97) invalide";
  return null;
}

export function formatRibDisplay(digits20: string): string {
  const d = normalizeRibInput(digits20);
  if (!/^\d{20}$/.test(d)) return digits20;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 18)} ${d.slice(18, 20)}`;
}
