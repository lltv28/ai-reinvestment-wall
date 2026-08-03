import { describe, expect, it } from "vitest";
import {
  GENERATED_LEAD_COUNT,
  PAYMENT_PARTICLE_COUNT,
  REINVESTMENT_TIMING,
  REINVESTMENT_VALUE_USD,
  easeInOutCubic,
  reinvestmentFrame,
} from "./reinvestment";

describe("reinvestmentFrame", () => {
  it("walks through the approved 15 second sequence", () => {
    expect(reinvestmentFrame(0, 1).phase).toBe("focus");
    expect(reinvestmentFrame(2_500, 1).phase).toBe("collect");
    expect(reinvestmentFrame(7_500, 1).phase).toBe("aggregate");
    expect(reinvestmentFrame(9_500, 1).phase).toBe("brain");
    expect(reinvestmentFrame(11_500, 1).phase).toBe("ads");
    expect(reinvestmentFrame(13_500, 1).phase).toBe("grow");
    expect(reinvestmentFrame(REINVESTMENT_TIMING.growEnd, 1).phase).toBe("complete");
  });

  it("finishes with five $8 ad credits collected", () => {
    const frame = reinvestmentFrame(REINVESTMENT_TIMING.growEnd, 2);
    expect(frame.collectedUsd).toBe(REINVESTMENT_VALUE_USD);
    expect(frame.collectedPayments).toBe(PAYMENT_PARTICLE_COUNT);
    expect(frame.generatedLeads).toBe(GENERATED_LEAD_COUNT);
    expect(frame.cycle).toBe(2);
  });

  it("keeps easing bounded", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(2)).toBe(1);
  });
});
