import { describe, expect, it } from "vitest";
import {
  solarAssessmentDraftSchema,
  summarizeAssessmentDraft,
  type SolarAssessmentDraft,
} from "./schema";

const validDraft: SolarAssessmentDraft = {
  bills: [
    { amountThb: 3000, energyKwh: 500, month: "2026-01" },
    { amountThb: 3300, energyKwh: 550, month: "2026-02" },
    { amountThb: 3600, energyKwh: 600, month: "2026-03" },
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

  it("rejects duplicate billing months", () => {
    const result = solarAssessmentDraftSchema.safeParse({
      ...validDraft,
      bills: validDraft.bills.map((bill) => ({ ...bill, month: "2026-01" })),
    });

    expect(result.success).toBe(false);
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
      daytimeOccupancy: 3,
      enabledAcPeriods: 2,
      estimatedAcHours: 11,
    });
  });
});
