import { describe, expect, it } from "vitest";
import type { SolarAssessmentDraft } from "./schema";
import { createSolarRecommendation } from "./solar-recommendation";

function createDraft(
  overrides: Partial<SolarAssessmentDraft> = {},
): SolarAssessmentDraft {
  return {
    bills: [
      { amountThb: 3150, energyKwh: 580 },
      { amountThb: 3500, energyKwh: 620 },
      { amountThb: 3200, energyKwh: 600 },
    ],
    occupancy: { morning: 4, daytime: 2, evening: 3, night: 4 },
    acUsage: {
      morning: { enabled: false, hours: 0, unitCount: 0 },
      daytime: { enabled: true, hours: 4, unitCount: 1 },
      evening: { enabled: true, hours: 3, unitCount: 1 },
      night: { enabled: false, hours: 0, unitCount: 0 },
    },
    exportIntent: "interested",
    tariff: "tou",
    ...overrides,
  };
}

describe("createSolarRecommendation", () => {
  it("recommends one of the supported package sizes", () => {
    const recommendation = createSolarRecommendation(createDraft());

    expect([3, 5, 8, 10]).toContain(
      recommendation.recommendedSystemSizeKw,
    );
    expect(recommendation.energy.monthlyGenerationKwh).toBeGreaterThan(0);
  });

  it("estimates more export when peak-time occupancy and AC load are lower", () => {
    const lowDaytimeLoad = createSolarRecommendation(
      createDraft({
        occupancy: { morning: 1, daytime: 0, evening: 4, night: 4 },
        acUsage: {
          morning: { enabled: false, hours: 0, unitCount: 0 },
          daytime: { enabled: false, hours: 0, unitCount: 0 },
          evening: { enabled: true, hours: 5, unitCount: 2 },
          night: { enabled: false, hours: 0, unitCount: 0 },
        },
      }),
      { systemSizeKw: 5 },
    );
    const highDaytimeLoad = createSolarRecommendation(createDraft(), {
      systemSizeKw: 5,
    });

    expect(lowDaytimeLoad.energy.peakWindow.loadKwh).toBeLessThan(
      highDaytimeLoad.energy.peakWindow.loadKwh,
    );
    expect(lowDaytimeLoad.energy.monthlyExportKwh).toBeGreaterThan(
      highDaytimeLoad.energy.monthlyExportKwh,
    );
  });

  it("does not show payback until a package price is supplied", () => {
    const recommendation = createSolarRecommendation(createDraft());

    expect(recommendation.confirmedPayback).toBeNull();
    expect(recommendation.potentialPayback).toBeNull();
    expect(recommendation.investmentScore).toBeNull();
  });

  it("keeps uncontracted export out of the confirmed payback", () => {
    const recommendation = createSolarRecommendation(createDraft(), {
      packagePriceThb: 220_000,
      systemSizeKw: 5,
    });

    expect(recommendation.confirmedPayback).not.toBeNull();
    expect(recommendation.potentialPayback).not.toBeNull();
    expect(recommendation.confirmedPayback?.fastestYears).toBeGreaterThan(
      recommendation.potentialPayback?.fastestYears ?? 0,
    );
    expect(recommendation.investmentScore?.score).toBeGreaterThanOrEqual(0);
    expect(recommendation.investmentScore?.score).toBeLessThanOrEqual(100);
    expect(recommendation.investmentScore?.score).toBe(
      (recommendation.investmentScore?.paybackPoints ?? 0) +
        (recommendation.investmentScore?.selfUsePoints ?? 0) +
        (recommendation.investmentScore?.confidencePoints ?? 0),
    );
  });

  it("does not let uncontracted export inflate the investment score", () => {
    const interested = createSolarRecommendation(createDraft(), {
      packagePriceThb: 220_000,
      systemSizeKw: 5,
    });
    const noExport = createSolarRecommendation(
      createDraft({ exportIntent: "none" }),
      { packagePriceThb: 220_000, systemSizeKw: 5 },
    );

    expect(interested.investmentScore?.score).toBe(noExport.investmentScore?.score);
    expect(interested.confirmedPayback).toEqual(noExport.confirmedPayback);
  });

  it("counts export income as confirmed only when a contract is declared", () => {
    const interested = createSolarRecommendation(createDraft(), {
      packagePriceThb: 220_000,
      systemSizeKw: 5,
    });
    const contracted = createSolarRecommendation(
      createDraft({ exportIntent: "contracted" }),
      { packagePriceThb: 220_000, systemSizeKw: 5 },
    );

    expect(contracted.annualConfirmedValueThb).toBeGreaterThan(
      interested.annualConfirmedValueThb,
    );
  });
});
