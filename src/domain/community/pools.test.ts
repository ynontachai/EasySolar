import { describe, expect, it } from "vitest";
import { PILOT_TENDER_HOUSEHOLDS, PILOT_TENDER_KWP, poolReadiness } from "./pools";

describe("poolReadiness", () => {
  it("is ready when either household or kWp threshold is reached", () => {
    expect(poolReadiness({ estimatedKwp: 10, qualifiedHouseholdCount: PILOT_TENDER_HOUSEHOLDS })).toEqual({
      percent: 100,
      ready: true,
    });
    expect(poolReadiness({ estimatedKwp: PILOT_TENDER_KWP, qualifiedHouseholdCount: 1 })).toEqual({
      percent: 100,
      ready: true,
    });
  });

  it("uses the closer of the two thresholds and caps at 100", () => {
    expect(poolReadiness({ estimatedKwp: 50, qualifiedHouseholdCount: 5 })).toEqual({ percent: 50, ready: false });
    expect(poolReadiness({ estimatedKwp: 300, qualifiedHouseholdCount: 40 })).toEqual({ percent: 100, ready: true });
  });
});
