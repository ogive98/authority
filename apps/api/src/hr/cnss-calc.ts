import { round3, taxFromHt } from '../tax/tax.service';

/**
 * Pure CNSS preview math (D195).
 * Rates / ceiling must come from VALIDATED Prefs — never invent.
 */
export type CnssRateInput = {
  rateBps: number;
  lawRef: string | null;
} | null;

export type CnssCeilingInput = {
  /** TND ceiling (from amountMilli / 1000). */
  amountTnd: number;
  lawRef: string | null;
} | null;

export type CnssCalcInput = {
  wageBase: number;
  employee: CnssRateInput;
  employer: CnssRateInput;
  ceiling: CnssCeilingInput;
};

export type CnssCalcResult = {
  wageBase: number;
  assiette: number;
  ceilingApplied: boolean;
  ceilingAmount: number | null;
  employeeRateBps: number | null;
  employerRateBps: number | null;
  employeeAmount: number | null;
  employerAmount: number | null;
  employeeLawRef: string | null;
  employerLawRef: string | null;
  ceilingLawRef: string | null;
  ready: boolean;
  pending: string[];
};

export function computeCnssAmounts(input: CnssCalcInput): CnssCalcResult {
  const pending: string[] = [];
  const wageBase = round3(input.wageBase);
  if (!(wageBase > 0) || !Number.isFinite(wageBase)) {
    return {
      wageBase,
      assiette: 0,
      ceilingApplied: false,
      ceilingAmount: null,
      employeeRateBps: null,
      employerRateBps: null,
      employeeAmount: null,
      employerAmount: null,
      employeeLawRef: null,
      employerLawRef: null,
      ceilingLawRef: null,
      ready: false,
      pending: ['wageBase'],
    };
  }

  let assiette = wageBase;
  let ceilingApplied = false;
  let ceilingAmount: number | null = null;
  let ceilingLawRef: string | null = null;

  if (input.ceiling && input.ceiling.amountTnd > 0) {
    ceilingAmount = round3(input.ceiling.amountTnd);
    ceilingLawRef = input.ceiling.lawRef;
    if (assiette > ceilingAmount) {
      assiette = ceilingAmount;
      ceilingApplied = true;
    }
  } else {
    pending.push('hr.cnss.ceiling');
  }

  let employeeAmount: number | null = null;
  let employeeRateBps: number | null = null;
  let employeeLawRef: string | null = null;
  if (input.employee && input.employee.rateBps > 0) {
    employeeRateBps = input.employee.rateBps;
    employeeLawRef = input.employee.lawRef;
    employeeAmount = taxFromHt(assiette, employeeRateBps);
  } else {
    pending.push('hr.cnss.employee');
  }

  let employerAmount: number | null = null;
  let employerRateBps: number | null = null;
  let employerLawRef: string | null = null;
  if (input.employer && input.employer.rateBps > 0) {
    employerRateBps = input.employer.rateBps;
    employerLawRef = input.employer.lawRef;
    employerAmount = taxFromHt(assiette, employerRateBps);
  } else {
    pending.push('hr.cnss.employer');
  }

  const ready =
    employeeAmount != null &&
    employerAmount != null &&
    wageBase > 0;

  return {
    wageBase,
    assiette,
    ceilingApplied,
    ceilingAmount,
    employeeRateBps,
    employerRateBps,
    employeeAmount,
    employerAmount,
    employeeLawRef,
    employerLawRef,
    ceilingLawRef,
    ready,
    pending,
  };
}

/** YYYY-MM only. */
export function normalizePeriodYm(raw: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
}

export function currentPeriodYm(d = new Date()): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${mo}`;
}
