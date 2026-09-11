import { round3 } from '../tax/tax.service';

/**
 * Pure IRPP V0 math (D196).
 * Annual progressive brackets from human Prefs table — never invent.
 * Monthly withholding = annualTax(taxableMonthly * 12) / 12.
 */

export type IrppBracketInput = {
  /** Annual upper bound in millimes; null = open-ended. */
  upToMilli: number | null;
  rateBps: number;
  lawRef?: string | null;
};

export type IrppCalcInput = {
  wageBase: number;
  /** CNSS salarié amount for the same wageBase — required (lock 2B). */
  cnssEmployeeAmount: number | null;
  cnssReady: boolean;
  irppSlotValidated: boolean;
  brackets: IrppBracketInput[];
  irppLawRef: string | null;
};

export type IrppCalcResult = {
  wageBase: number;
  cnssEmployeeAmount: number | null;
  taxableMonthly: number | null;
  annualTaxable: number | null;
  annualIrpp: number | null;
  monthlyIrpp: number | null;
  brackets: IrppBracketInput[];
  irppLawRef: string | null;
  methodNote: 'annual_brackets_div_12';
  ready: boolean;
  pending: string[];
};

/** Progressive tax on annual TND using annual millime ceilings. */
export function applyAnnualProgressive(
  annualTaxableTnd: number,
  brackets: IrppBracketInput[],
): number {
  if (!(annualTaxableTnd > 0) || brackets.length === 0) return 0;
  const incomeMilli = Math.round(round3(annualTaxableTnd) * 1000);
  const sorted = [...brackets].sort((a, b) => {
    if (a.upToMilli == null && b.upToMilli == null) return 0;
    if (a.upToMilli == null) return 1;
    if (b.upToMilli == null) return -1;
    return a.upToMilli - b.upToMilli;
  });

  let prev = 0;
  let taxMilli = 0;
  for (const band of sorted) {
    const upper =
      band.upToMilli == null ? Number.POSITIVE_INFINITY : band.upToMilli;
    if (incomeMilli <= prev) break;
    const slice = Math.min(incomeMilli, upper) - prev;
    if (slice > 0 && band.rateBps > 0) {
      taxMilli += (slice * band.rateBps) / 10_000;
    }
    if (upper === Number.POSITIVE_INFINITY) break;
    prev = upper;
    if (incomeMilli <= upper) break;
  }
  return round3(taxMilli / 1000);
}

export function computeIrppAmounts(input: IrppCalcInput): IrppCalcResult {
  const pending: string[] = [];
  const wageBase = round3(input.wageBase);
  const methodNote = 'annual_brackets_div_12' as const;

  if (!(wageBase > 0) || !Number.isFinite(wageBase)) {
    return {
      wageBase,
      cnssEmployeeAmount: null,
      taxableMonthly: null,
      annualTaxable: null,
      annualIrpp: null,
      monthlyIrpp: null,
      brackets: [],
      irppLawRef: input.irppLawRef,
      methodNote,
      ready: false,
      pending: ['wageBase'],
    };
  }

  if (!input.cnssReady || input.cnssEmployeeAmount == null) {
    pending.push('hr.cnss.employee');
  }
  if (!input.irppSlotValidated) {
    pending.push('hr.irpp');
  }
  if (!input.brackets.length) {
    pending.push('hr.irpp.brackets');
  }

  if (pending.length > 0) {
    return {
      wageBase,
      cnssEmployeeAmount: input.cnssEmployeeAmount,
      taxableMonthly: null,
      annualTaxable: null,
      annualIrpp: null,
      monthlyIrpp: null,
      brackets: input.brackets,
      irppLawRef: input.irppLawRef,
      methodNote,
      ready: false,
      pending,
    };
  }

  const cnssEmployeeAmount = round3(input.cnssEmployeeAmount!);
  const taxableMonthly = round3(Math.max(0, wageBase - cnssEmployeeAmount));
  const annualTaxable = round3(taxableMonthly * 12);
  const annualIrpp = applyAnnualProgressive(annualTaxable, input.brackets);
  const monthlyIrpp = round3(annualIrpp / 12);

  return {
    wageBase,
    cnssEmployeeAmount,
    taxableMonthly,
    annualTaxable,
    annualIrpp,
    monthlyIrpp,
    brackets: input.brackets,
    irppLawRef: input.irppLawRef,
    methodNote,
    ready: true,
    pending: [],
  };
}

/** Validate human bracket rows — structure only, no invented thresholds. */
export function validateIrppBrackets(
  rows: IrppBracketInput[],
): string | null {
  if (!rows.length) return 'At least one annual bracket is required.';
  const openCount = rows.filter((r) => r.upToMilli == null).length;
  if (openCount !== 1) {
    return 'Exactly one open-ended band (upToMilli null) is required.';
  }
  if (rows[rows.length - 1]?.upToMilli != null) {
    return 'The last bracket must be open-ended (upToMilli null).';
  }
  let prev = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (!Number.isInteger(r.rateBps) || r.rateBps < 0 || r.rateBps > 100_000) {
      return `Invalid rateBps at band ${i + 1}.`;
    }
    if (r.upToMilli == null) continue;
    if (!Number.isInteger(r.upToMilli) || r.upToMilli <= 0) {
      return `Invalid upToMilli at band ${i + 1}.`;
    }
    if (r.upToMilli <= prev) {
      return 'Annual upToMilli must be strictly increasing.';
    }
    prev = r.upToMilli;
  }
  return null;
}
