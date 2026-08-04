import { describe, expect, it } from "vitest";
import {
  AI_TRIAGER_COUNT,
  GENERATED_LEAD_COUNT,
  PAYMENT_PARTICLE_COUNT,
  REINVESTMENT_TIMING,
  REINVESTMENT_VALUE_USD,
  TRIAGER_CONNECTION_DURATION_MS,
  TRIAGER_RETURN_DURATION_MS,
  TRIAGER_SALE_ARRIVAL_MS,
  assessmentPhoneScreen,
  directBudgetImpactAt,
  easeInOutCubic,
  reinvestmentFrame,
  triagerConnectionAt,
  triagerRevenueUsd,
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

  it("increments the AI Triagers revenue by $8 as each synced return arrives", () => {
    const firstArrival = TRIAGER_SALE_ARRIVAL_MS + TRIAGER_RETURN_DURATION_MS;
    const frameAt = (connectionElapsedMs: number) => ({
      ...reinvestmentFrame(5_000, 1),
      connectionElapsedMs,
    });

    expect(triagerRevenueUsd(frameAt(firstArrival - 1))).toBe(0);
    expect(triagerRevenueUsd(frameAt(firstArrival))).toBe(8);
    expect(
      triagerRevenueUsd(frameAt(firstArrival + TRIAGER_CONNECTION_DURATION_MS)),
    ).toBe(16);
  });

  it("increments direct-return revenue as soon as the triager dot arrives", () => {
    const frameAt = (connectionElapsedMs: number) => ({
      ...reinvestmentFrame(5_000, 1),
      connectionElapsedMs,
    });

    expect(triagerRevenueUsd(frameAt(TRIAGER_SALE_ARRIVAL_MS - 1), "direct")).toBe(0);
    expect(triagerRevenueUsd(frameAt(TRIAGER_SALE_ARRIVAL_MS), "direct")).toBe(8);
  });

  it("pulses the ad budget when each direct-return dot arrives", () => {
    expect(directBudgetImpactAt(TRIAGER_SALE_ARRIVAL_MS - 1).active).toBe(false);

    const impact = directBudgetImpactAt(TRIAGER_SALE_ARRIVAL_MS + 130);
    expect(impact.active).toBe(true);
    expect(impact.scale).toBeCloseTo(1.04);

    const continuedImpact = directBudgetImpactAt(TRIAGER_CONNECTION_DURATION_MS + 20);
    expect(continuedImpact.active).toBe(true);
    expect(continuedImpact.progress).toBeGreaterThan(0.5);
  });

  it("advances the phone through each screen at its intended moment", () => {
    expect(assessmentPhoneScreen(reinvestmentFrame(REINVESTMENT_TIMING.phoneReveal, 1))).toBe(
      "landing",
    );
    expect(assessmentPhoneScreen(reinvestmentFrame(3_000, 1))).toBe("question");
    expect(assessmentPhoneScreen(reinvestmentFrame(4_900, 1))).toBe("plan");
    expect(assessmentPhoneScreen(reinvestmentFrame(7_000, 1))).toBe("checkout");
    expect(assessmentPhoneScreen(reinvestmentFrame(9_000, 1))).toBe("paid");
    expect(assessmentPhoneScreen(reinvestmentFrame(11_000, 1))).toBe("funding");
    expect(assessmentPhoneScreen(reinvestmentFrame(13_000, 1))).toBe("ready");
  });

  it("rotates through every AI Triager before repeating", () => {
    const connections = Array.from({ length: AI_TRIAGER_COUNT }, (_, index) =>
      triagerConnectionAt(index * TRIAGER_CONNECTION_DURATION_MS),
    );

    expect(connections.map((connection) => connection.triagerIndex)).toEqual(
      Array.from({ length: AI_TRIAGER_COUNT }, (_, index) => index),
    );
    expect(connections.map((connection) => connection.phoneIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(
      triagerConnectionAt(AI_TRIAGER_COUNT * TRIAGER_CONNECTION_DURATION_MS).triagerIndex,
    ).toBe(0);
  });
});
