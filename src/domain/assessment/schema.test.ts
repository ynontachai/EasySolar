import { describe, expect, it } from "vitest";
import {
  billStepSchema,
  solarAssessmentDraftSchema,
  summarizeAssessmentDraft,
  type SolarAssessmentDraft,
} from "./schema";

const validDraft: SolarAssessmentDraft = {
  bills: [
    { amountThb: 3000, energyKwh: 500 },
    { amountThb: 3300, energyKwh: 550 },
    { amountThb: 3600, energyKwh: 600 },
  ],
  occupancy: { morning: 2, daytime: 1, evening: 3, night: 3 },
  acUsage: {
    morning: { enabled: false, hours: 0, unitCount: 0 },
    daytime: { enabled: true, hours: 3, unitCount: 1 },
    evening: { enabled: true, hours: 4, unitCount: 2 },
    night: { enabled: false, hours: 0, unitCount: 0 },
  },
  exportIntent: "interested",
  tariff: "normal",
};

describe("solar assessment draft", () => {
  it("accepts a complete five-step draft", () => {
    expect(solarAssessmentDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it("allows the bill step to continue without selecting billing months", () => {
    expect(billStepSchema.safeParse({ bills: validDraft.bills }).success).toBe(true);
  });

  it("still requires three positive bill amounts", () => {
    const bills = validDraft.bills.map((bill, index) =>
      index === 1 ? { ...bill, amountThb: 0 } : bill,
    );

    expect(billStepSchema.safeParse({ bills }).success).toBe(false);
  });

  it("requires usage details when an AC period is enabled", () => {
    const result = solarAssessmentDraftSchema.safeParse({
      ...validDraft,
      acUsage: {
        ...validDraft.acUsage,
        daytime: { enabled: true, hours: 0, unitCount: 0 },
      },
    });

    expect(result.success).toBe(false);
  });

  it("summarizes only values supplied by the user", () => {
    expect(summarizeAssessmentDraft(validDraft)).toEqual({
      averageBillThb: 3300,
      averageEnergyKwh: 550,
      daylightAverageOccupancy: 1.4,
      daylightOccupancyPersonHours: 14,
      enabledAcPeriods: 2,
      estimatedAcHours: 11,
    });
  });

  it("time-weights daylight occupancy instead of adding headcounts", () => {
    const summary = summarizeAssessmentDraft({
      ...validDraft,
      occupancy: { morning: 4, daytime: 2, evening: 3, night: 4 },
    });

    expect(summary.daylightOccupancyPersonHours).toBe(28);
    expect(summary.daylightAverageOccupancy).toBe(2.8);
  });
});
