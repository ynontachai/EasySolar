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
});
