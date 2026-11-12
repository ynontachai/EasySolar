import { describe, expect, it } from "vitest";
import { sizingRequestSchema } from "./schemas";

const validRequest = {
  assumptions: {
    currentSafetyFactor: 1.25,
    targetDcPowerWp: 11_000,
    tcellMaxC: 70,
    tcellMinC: -10,
  },
  inverterId: "inverter",
  pvModuleId: "module",
};

describe("sizing request safety policy", () => {
  it("accepts the minimum approved Isc design factor", () => {
    expect(sizingRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("rejects a factor below 1.25", () => {
    expect(sizingRequestSchema.safeParse({
      ...validRequest,
      assumptions: { ...validRequest.assumptions, currentSafetyFactor: 1.24 },
    }).success).toBe(false);
  });

  it("accepts explicit missing-value and complete bifacial overrides", () => {
    expect(sizingRequestSchema.safeParse({
      ...validRequest,
      overrides: {
        betaVmpPerC: -0.0031,
        maxDcPowerWp: 19_200,
        bifacial: {
          impA: 18.1,
          iscA: 18.96,
          mode: "USER_DESIGN_CASE",
          pmaxWp: 808,
          rearGainFraction: 0.25,
          vmpV: 44.66,
          vocV: 53.8,
        },
      },
    }).success).toBe(true);
  });

  it("rejects an incomplete or electrically inconsistent bifacial override", () => {
    expect(sizingRequestSchema.safeParse({
      ...validRequest,
      overrides: {
        bifacial: {
          impA: 20,
          iscA: 19,
          mode: "USER_DESIGN_CASE",
          pmaxWp: 808,
          rearGainFraction: 0.25,
          vmpV: 54,
          vocV: 53,
        },
      },
    }).success).toBe(false);
  });
});
