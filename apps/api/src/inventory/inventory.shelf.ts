/**
 * Pack date + shelf life → DLC (calendar days).
 * Pack date = emballage (Tunis calendar day).
 */
export function computeDlcIso(
  packDateIso: string,
  shelfLifeDays: number,
): string {
  if (!Number.isInteger(shelfLifeDays) || shelfLifeDays < 1) {
    throw new Error('shelfLifeDays must be a positive integer');
  }
  return addCalendarDaysIso(packDateIso, shelfLifeDays);
}

/**
 * Date Production = emballage − offset (jours).
 * Offset 0/null → même jour (frais, ex. mozzarella).
 * Offset 30 → modèle Word fromages affinés (prod 10/08, emballage 09/09).
 */
export function computeProductionDateIso(
  packDateIso: string,
  productionOffsetDays?: number | null,
): string {
  const offset = Math.trunc(Number(productionOffsetDays ?? 0));
  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error('productionOffsetDays must be >= 0');
  }
  if (offset === 0) return packDateIso.trim().slice(0, 10);
  return addCalendarDaysIso(packDateIso, -offset);
}

function addCalendarDaysIso(iso: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    throw new Error('date must be YYYY-MM-DD');
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = Date.UTC(y, mo - 1, d);
  const next = new Date(utc + deltaDays * 24 * 60 * 60 * 1000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Lot code for 1 lot / cheese type / pack day. */
export function dailyLotCode(sku: string, packDateIso: string): string {
  const skuPart = sku.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  return `${skuPart}-${packDateIso.replace(/-/g, '')}`;
}

export type TunisClock = { date: string; hour: number };

/** Calendar date + hour in Africa/Tunis (D100/D101). */
export function tunisClock(now = new Date()): TunisClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  return { date: `${year}-${month}-${day}`, hour };
}

/** True when Tunis clock is in the generation hour window (default 0 = midnight). */
export function shouldRunDailyGen(
  clock: TunisClock,
  hourTunis: number,
  lastRunDate: string | null,
): boolean {
  const hour = Math.trunc(hourTunis);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return false;
  if (clock.hour !== hour) return false;
  return lastRunDate !== clock.date;
}
