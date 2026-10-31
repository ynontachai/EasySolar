import { describe, expect, it } from "vitest";
import { communityInterestSchema } from "./schema";

const validInput = {
  consentDemandMatching: "on",
  consentNotifications: null,
  decisionRole: "owner",
  district: "เมืองเชียงใหม่",
  email: "buyer@example.com",
  fullName: "ผู้สนใจโซลาร์",
  honeypot: "",
  installationWindow: "3_6_months",
  investmentScore: "72",
  latitude: "18.7883",
  longitude: "98.9853",
  packagePriceThb: "220000",
  phone: "0812345678",
  postalCode: "50000",
  preferredRadiusKm: "15",
  propertyType: "detached_home",
  province: "เชียงใหม่",
  selectedSystemSizeKw: "5",
  subdistrict: "ศรีภูมิ",
};

describe("communityInterestSchema", () => {
  it("accepts a complete community interest", () => {
    const result = communityInterestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("requires latitude and longitude as a pair", () => {
    const result = communityInterestSchema.safeParse({ ...validInput, longitude: "" });
    expect(result.success).toBe(false);
  });

  it("rejects unsupported matching radii", () => {
    const result = communityInterestSchema.safeParse({ ...validInput, preferredRadiusKm: "25" });
    expect(result.success).toBe(false);
  });
});
