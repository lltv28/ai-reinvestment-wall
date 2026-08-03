export const AI_TRIAGER_NODE_ID = "hub-0";
export const AI_BRAIN_NODE_ID = "center";

export const PROFIT_PER_AD_USD = 8;
export const PAYMENT_PARTICLE_COUNT = 5;
export const REINVESTMENT_VALUE_USD = PROFIT_PER_AD_USD * PAYMENT_PARTICLE_COUNT;
export const GENERATED_LEAD_COUNT = 0;

export const REINVESTMENT_TIMING = {
  focusEnd: 2_000,
  phoneReveal: 2_150,
  collectEnd: 7_000,
  aggregateEnd: 9_000,
  brainEnd: 11_000,
  adsEnd: 13_000,
  growEnd: 15_000,
} as const;

export type ReinvestmentPhase =
  | "idle"
  | "focus"
  | "collect"
  | "aggregate"
  | "brain"
  | "ads"
  | "grow"
  | "complete";

export interface ReinvestmentFrame {
  phase: ReinvestmentPhase;
  elapsedMs: number;
  phaseProgress: number;
  collectedUsd: number;
  collectedPayments: number;
  generatedLeads: number;
  cycle: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function progressBetween(elapsedMs: number, startMs: number, endMs: number): number {
  return clamp01((elapsedMs - startMs) / (endMs - startMs));
}

export function easeInOutCubic(value: number): number {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function reinvestmentFrame(elapsedMs: number, cycle: number): ReinvestmentFrame {
  if (elapsedMs < 0) {
    return {
      phase: "idle",
      elapsedMs: 0,
      phaseProgress: 0,
      collectedUsd: 0,
      collectedPayments: 0,
      generatedLeads: 0,
      cycle,
    };
  }

  let phase: ReinvestmentPhase;
  let phaseProgress: number;
  if (elapsedMs < REINVESTMENT_TIMING.focusEnd) {
    phase = "focus";
    phaseProgress = progressBetween(elapsedMs, 0, REINVESTMENT_TIMING.focusEnd);
  } else if (elapsedMs < REINVESTMENT_TIMING.collectEnd) {
    phase = "collect";
    phaseProgress = progressBetween(
      elapsedMs,
      REINVESTMENT_TIMING.focusEnd,
      REINVESTMENT_TIMING.collectEnd,
    );
  } else if (elapsedMs < REINVESTMENT_TIMING.aggregateEnd) {
    phase = "aggregate";
    phaseProgress = progressBetween(
      elapsedMs,
      REINVESTMENT_TIMING.collectEnd,
      REINVESTMENT_TIMING.aggregateEnd,
    );
  } else if (elapsedMs < REINVESTMENT_TIMING.brainEnd) {
    phase = "brain";
    phaseProgress = progressBetween(
      elapsedMs,
      REINVESTMENT_TIMING.aggregateEnd,
      REINVESTMENT_TIMING.brainEnd,
    );
  } else if (elapsedMs < REINVESTMENT_TIMING.adsEnd) {
    phase = "ads";
    phaseProgress = progressBetween(
      elapsedMs,
      REINVESTMENT_TIMING.brainEnd,
      REINVESTMENT_TIMING.adsEnd,
    );
  } else if (elapsedMs < REINVESTMENT_TIMING.growEnd) {
    phase = "grow";
    phaseProgress = progressBetween(
      elapsedMs,
      REINVESTMENT_TIMING.adsEnd,
      REINVESTMENT_TIMING.growEnd,
    );
  } else {
    phase = "complete";
    phaseProgress = 1;
  }

  const collectionProgress = progressBetween(
    elapsedMs,
    REINVESTMENT_TIMING.focusEnd,
    REINVESTMENT_TIMING.collectEnd,
  );
  const collectedPayments = Math.round(collectionProgress * PAYMENT_PARTICLE_COUNT);
  const collectedUsd = Math.round(collectionProgress * REINVESTMENT_VALUE_USD);
  const generatedLeads = Math.round(
    progressBetween(elapsedMs, REINVESTMENT_TIMING.adsEnd, REINVESTMENT_TIMING.growEnd) *
      GENERATED_LEAD_COUNT,
  );

  return {
    phase,
    elapsedMs: Math.max(0, elapsedMs),
    phaseProgress,
    collectedUsd,
    collectedPayments,
    generatedLeads,
    cycle,
  };
}

export function triagerRevenueUsd(frame: ReinvestmentFrame): number {
  if (frame.elapsedMs < REINVESTMENT_TIMING.brainEnd) return 0;
  if (frame.elapsedMs >= REINVESTMENT_TIMING.adsEnd) return REINVESTMENT_VALUE_USD;

  const completedReturns = Array.from({ length: PAYMENT_PARTICLE_COUNT }, (_, index) => {
    const localProgress = clamp01((frame.phaseProgress - index * 0.09) / 0.6);
    return localProgress >= 1 ? 1 : 0;
  }).reduce<number>((total, completed) => total + completed, 0);

  return completedReturns * PROFIT_PER_AD_USD;
}

export const IDLE_REINVESTMENT_FRAME: ReinvestmentFrame = reinvestmentFrame(-1, 0);
