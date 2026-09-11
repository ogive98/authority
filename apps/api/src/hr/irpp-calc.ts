/**
 * Pure IRPP math (D196/D202).
 * Annual progressive brackets from human Prefs — never invent.
 * Abatements (Prefs VALIDATED amounts) reduce annualTaxable before brackets (lock 2A).
 * Monthly withholding = annualTax(annualTaxable) / 12.
 */

import { round3 } from '../tax/tax.service';

export type IrppBracketInput = {
  /** Annual upper bound in millimes; null = open-ended. */
  upToMilli: number | null;
  rateBps: number;
  lawRef?: string | null;
};

export type IrppAbatementInput = {
  chefSeatValidated: boolean;
  /** Annual chef abatement TND from Prefs amountMilli/1000 — null if unset. */
  chefAmountAnnualTnd: number | null;
  chefLawRef: string | null;
  enfantSeatValidated: boolean;
  /** Annual per-child abatement TND from Prefs — null if unset. */
  enfantAmountAnnualTnd: number | null;
  enfantLawRef: string | null;
  /** Employee defaults — null = not set (gate 5B when seat VALIDATED). */
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
};

export type IrppCalcInput = {
  wageBase: number;
  /** CNSS salarié amount for the same wageBase — required (lock 2B). */
  cnssEmployeeAmount: number | null;
  cnssReady: boolean;
  irppSlotValidated: boolean;
  brackets: IrppBracketInput[];
  irppLawRef: string | null;
  abatement: IrppAbatementInput;
};

export type IrppCalcResult = {
  wageBase: number;
  cnssEmployeeAmount: number | null;
  taxableMonthly: number | null;
  annualTaxableBeforeAbat: number | null;
  annualTaxable: number | null;
  annualIrpp: number | null;
  monthlyIrpp: number | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  abatChefAnnual: number;
  abatEnfantAnnual: number;
  abatTotalAnnual: number;
  abatChefLawRef: string | null;
  abatEnfantLawRef: string | null;
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

function emptyPending(
  input: IrppCalcInput,
  pending: string[],
  wageBase: number,
): IrppCalcResult {
  return {
    wageBase,
    cnssEmployeeAmount: input.cnssEmployeeAmount,
    taxableMonthly: null,
    annualTaxableBeforeAbat: null,
    annualTaxable: null,
    annualIrpp: null,
    monthlyIrpp: null,
    taxChefDeFamille: input.abatement.taxChefDeFamille,
    taxEnfantCount: input.abatement.taxEnfantCount,
    abatChefAnnual: 0,
    abatEnfantAnnual: 0,
    abatTotalAnnual: 0,
    abatChefLawRef: input.abatement.chefLawRef,
    abatEnfantLawRef: input.abatement.enfantLawRef,
    brackets: input.brackets,
    irppLawRef: input.irppLawRef,
    methodNote: 'annual_brackets_div_12',
    ready: false,
    pending,
  };
}

export function computeIrppAmounts(input: IrppCalcInput): IrppCalcResult {
  const pending: string[] = [];
  const wageBase = round3(input.wageBase);
  const ab = input.abatement;

  if (!(wageBase > 0) || !Number.isFinite(wageBase)) {
    return emptyPending(input, ['wageBase'], wageBase);
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

  // Gate 5B — when Prefs abatement seat VALIDATED, family fields must be set.
  if (ab.chefSeatValidated && ab.taxChefDeFamille == null) {
    pending.push('employee.tax_chef_de_famille');
  }
  if (ab.enfantSeatValidated && ab.taxEnfantCount == null) {
    pending.push('employee.tax_enfant_count');
  }
  if (
    ab.chefSeatValidated &&
    (ab.chefAmountAnnualTnd == null || !(ab.chefAmountAnnualTnd >= 0))
  ) {
    pending.push('hr.irpp.abat.chef');
  }
  if (
    ab.enfantSeatValidated &&
    (ab.enfantAmountAnnualTnd == null || !(ab.enfantAmountAnnualTnd >= 0))
  ) {
    pending.push('hr.irpp.abat.enfant');
  }

  if (pending.length > 0) {
    return emptyPending(input, pending, wageBase);
  }

  const cnssEmployeeAmount = round3(input.cnssEmployeeAmount!);
  const taxableMonthly = round3(Math.max(0, wageBase - cnssEmployeeAmount));
  const annualTaxableBeforeAbat = round3(taxableMonthly * 12);

  let abatChefAnnual = 0;
  let abatEnfantAnnual = 0;
  if (ab.chefSeatValidated && ab.taxChefDeFamille === true) {
    abatChefAnnual = round3(ab.chefAmountAnnualTnd ?? 0);
  }
  if (
    ab.enfantSeatValidated &&
    ab.taxEnfantCount != null &&
    ab.taxEnfantCount > 0
  ) {
    abatEnfantAnnual = round3(
      (ab.enfantAmountAnnualTnd ?? 0) * ab.taxEnfantCount,
    );
  }
  const abatTotalAnnual = round3(abatChefAnnual + abatEnfantAnnual);
  const annualTaxable = round3(
    Math.max(0, annualTaxableBeforeAbat - abatTotalAnnual),
  );
  const annualIrpp = applyAnnualProgressive(annualTaxable, input.brackets);
  const monthlyIrpp = round3(annualIrpp / 12);

  return {
    wageBase,
    cnssEmployeeAmount,
    taxableMonthly,
    annualTaxableBeforeAbat,
    annualTaxable,
    annualIrpp,
    monthlyIrpp,
    taxChefDeFamille: ab.taxChefDeFamille,
    taxEnfantCount: ab.taxEnfantCount,
    abatChefAnnual,
    abatEnfantAnnual,
    abatTotalAnnual,
    abatChefLawRef: ab.chefLawRef,
    abatEnfantLawRef: ab.enfantLawRef,
    brackets: input.brackets,
    irppLawRef: input.irppLawRef,
    methodNote: 'annual_brackets_div_12',
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

export const EMPTY_IRPP_ABATEMENT: IrppAbatementInput = {
  chefSeatValidated: false,
  chefAmountAnnualTnd: null,
  chefLawRef: null,
  enfantSeatValidated: false,
  enfantAmountAnnualTnd: null,
  enfantLawRef: null,
  taxChefDeFamille: null,
  taxEnfantCount: null,
};
