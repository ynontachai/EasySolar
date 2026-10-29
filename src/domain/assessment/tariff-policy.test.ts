import { describe, expect, it } from "vitest";
import { createTariffInsight } from "./tariff-policy";
import type { SolarAssessmentDraft } from "./schema";

function createDraft(
  overrides: Partial<SolarAssessmentDraft> = {},
): SolarAssessmentDraft {
  return {
    acUsage: {
      morning: { enabled: false, hours: 0, unitCount: 0 },
      daytime: { enabled: false, hours: 0, unitCount: 0 },
      evening: { enabled: false, hours: 0, unitCount: 0 },
      night: { enabled: false, hours: 0, unitCount: 0 },
    },
    bills: [
      { amountThb: 3200, energyKwh: 650 },
      { amountThb: 3300, energyKwh: 670 },
      { amountThb: 3100, energyKwh: 630 },
    ],
    exportIntent: "interested",
    occupancy: { daytime: 2, evening: 4, morning: 3, night: 4 },
    tariff: "normal",
    ...overrides,
  };
}

describe("createTariffInsight", () => {
  it("uses the residential marginal tier plus Ft and VAT", () => {
    const insight = createTariffInsight(createDraft());

    expect(insight.method).toBe("normal-marginal");
    expect(insight.estimatedDaylightSelfUseValueBahtPerKwh).toBeCloseTo(4.837, 3);
    expect(insight.exportValueBahtPerKwh).toBe(2.2);
  });

  it("does not invent a normal marginal rate without complete kWh data", () => {
    const insight = createTariffInsight(
      createDraft({
        bills: [
          { amountThb: 3200, energyKwh: null },
          { amountThb: 3300, energyKwh: null },
          { amountThb: 3100, energyKwh: null },
        ],
      }),
    );

    expect(insight.method).toBe("insufficient-data");
    expect(insight.estimatedDaylightSelfUseValueBahtPerKwh).toBeNull();
  });

  it("uses a weekday/weekend daylight blend for TOU", () => {
    const insight = createTariffInsight(createDraft({ tariff: "tou" }));

    expect(insight.method).toBe("tou-weekday-weekend");
    expect(insight.estimatedDaylightSelfUseValueBahtPerKwh).toBeCloseTo(5.4113, 4);
  });
});
