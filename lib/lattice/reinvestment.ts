export const AI_TRIAGER_NODE_ID = "hub-0";
export const AI_BRAIN_NODE_ID = "center";

export const PROFIT_PER_AD_USD = 8;
export const PAYMENT_PARTICLE_COUNT = 5;
export const REINVESTMENT_VALUE_USD = PROFIT_PER_AD_USD * PAYMENT_PARTICLE_COUNT;
export const GENERATED_LEAD_COUNT = 0;
export const AI_TRIAGER_COUNT = 16;
export const TRIAGER_PHONE_COUNT = 9;
export const TRIAGER_CONNECTION_DURATION_MS = 1_250;
export const TRIAGER_SALE_ARRIVAL_MS = 1_050;
export const TRIAGER_RETURN_DURATION_MS = 900;
export const BUDGET_IMPACT_DURATION_MS = 560;

export type ReinvestmentMode = "ads" | "direct";

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
  connectionElapsedMs: number;
  phaseProgress: number;
  collectedUsd: number;
  collectedPayments: number;
  generatedLeads: number;
  cycle: number;
}

export type AssessmentPhoneScreen =
  | "landing"
  | "question"
  | "plan"
  | "checkout"
  | "paid"
  | "funding"
  | "ready";

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
      connectionElapsedMs: 0,
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
    connectionElapsedMs: 0,
    phaseProgress,
    collectedUsd,
    collectedPayments,
    generatedLeads,
    cycle,
  };
}

export function triagerConnectionAt(connectionElapsedMs: number): {
  triagerIndex: number;
  phoneIndex: number;
  progress: number;
} {
  const elapsedMs = Math.max(0, connectionElapsedMs);
  const absoluteIndex = Math.floor(elapsedMs / TRIAGER_CONNECTION_DURATION_MS);
  const triagerIndex = absoluteIndex % AI_TRIAGER_COUNT;

  return {
    triagerIndex,
    phoneIndex: triagerIndex % TRIAGER_PHONE_COUNT,
    progress: (elapsedMs % TRIAGER_CONNECTION_DURATION_MS) / TRIAGER_CONNECTION_DURATION_MS,
  };
}

export function directBudgetImpactAt(connectionElapsedMs: number): {
  active: boolean;
  progress: number;
  scale: number;
} {
  const elapsedMs = Math.max(0, connectionElapsedMs);
  if (elapsedMs < TRIAGER_SALE_ARRIVAL_MS) {
    return { active: false, progress: 0, scale: 1 };
  }

  const cycleElapsedMs = elapsedMs % TRIAGER_CONNECTION_DURATION_MS;
  const ageMs =
    cycleElapsedMs >= TRIAGER_SALE_ARRIVAL_MS
      ? cycleElapsedMs - TRIAGER_SALE_ARRIVAL_MS
      : cycleElapsedMs + TRIAGER_CONNECTION_DURATION_MS - TRIAGER_SALE_ARRIVAL_MS;
  if (ageMs >= BUDGET_IMPACT_DURATION_MS) {
    return { active: false, progress: 1, scale: 1 };
  }

  const progress = ageMs / BUDGET_IMPACT_DURATION_MS;
  const pulseProgress = clamp01(ageMs / 480);
  return {
    active: true,
    progress,
    scale: 1 + Math.sin(Math.PI * pulseProgress) * 0.018,
  };
}

export function assessmentPhoneScreen(frame: ReinvestmentFrame): AssessmentPhoneScreen {
  if (frame.phase === "focus" || frame.phase === "idle") return "landing";
  if (frame.phase === "collect") {
    if (frame.phaseProgress < 0.2) return "landing";
    return frame.phaseProgress < 0.58 ? "question" : "plan";
  }
  if (frame.phase === "aggregate") return "checkout";
  if (frame.phase === "brain") return "paid";
  if (frame.phase === "ads") return "funding";
  return "ready";
}

export function triagerRevenueUsd(
  frame: ReinvestmentFrame,
  mode: ReinvestmentMode = "ads",
): number {
  const firstReturnCompleteMs =
    mode === "direct"
      ? TRIAGER_SALE_ARRIVAL_MS
      : TRIAGER_SALE_ARRIVAL_MS + TRIAGER_RETURN_DURATION_MS;
  if (frame.connectionElapsedMs < firstReturnCompleteMs) return 0;
  const completedReturns =
    Math.floor(
      (frame.connectionElapsedMs - firstReturnCompleteMs) /
        TRIAGER_CONNECTION_DURATION_MS,
    ) + 1;
  return completedReturns * PROFIT_PER_AD_USD;
}

export const IDLE_REINVESTMENT_FRAME: ReinvestmentFrame = reinvestmentFrame(-1, 0);
