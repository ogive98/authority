import { round3 } from '../tax/tax.service';

/**
 * Pure TFP / FOPROLOS employer levy math (D207).
 * rateBps must come from VALIDATED Prefs — never invent.
 * No ceiling: do not invent a wage cap.
 */
export type LevyRateInput = {
  rateBps: number;
  lawRef: string | null;
} | null;

export type LevyLineResult = {
  slotKey: string;
  rateBps: number | null;
  amount: number | null;
  lawRef: string | null;
  pending: string[];
  ready: boolean;
};

export type HrLeviesCalcResult = {
  wageBase: number;
  tfp: LevyLineResult;
  foprolos: LevyLineResult;
  ready: boolean;
  pending: string[];
};

export function computeEmployerLevy(input: {
  wageBase: number;
  slotKey: string;
  rate: LevyRateInput;
}): LevyLineResult {
  const wageBase = round3(input.wageBase);
  if (!(wageBase > 0) || !Number.isFinite(wageBase)) {
    return {
      slotKey: input.slotKey,
      rateBps: input.rate?.rateBps ?? null,
      amount: null,
      lawRef: input.rate?.lawRef ?? null,
      pending: ['wageBase', input.slotKey],
      ready: false,
    };
  }

  if (
    input.rate == null ||
    input.rate.rateBps == null ||
    !Number.isFinite(input.rate.rateBps) ||
    input.rate.rateBps < 0
  ) {
    return {
      slotKey: input.slotKey,
      rateBps: null,
      amount: null,
      lawRef: null,
      pending: [input.slotKey],
      ready: false,
    };
  }

  const rateBps = input.rate.rateBps;
  return {
    slotKey: input.slotKey,
    rateBps,
    amount: round3((wageBase * rateBps) / 10000),
    lawRef: input.rate.lawRef,
    pending: [],
    ready: true,
  };
}

export function computeHrLevies(input: {
  wageBase: number;
  tfp: LevyRateInput;
  foprolos: LevyRateInput;
}): HrLeviesCalcResult {
  const tfp = computeEmployerLevy({
    wageBase: input.wageBase,
    slotKey: 'hr.tfp',
    rate: input.tfp,
  });
  const foprolos = computeEmployerLevy({
    wageBase: input.wageBase,
    slotKey: 'hr.foprolos',
    rate: input.foprolos,
  });
  const pending = [...new Set([...tfp.pending, ...foprolos.pending])];
  return {
    wageBase: round3(input.wageBase) || 0,
    tfp,
    foprolos,
    ready: tfp.ready && foprolos.ready,
    pending,
  };
}
