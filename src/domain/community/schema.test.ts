import { describe, expect, it } from "vitest";
import { communityInterestSchema, communityReferralCodeSchema } from "./schema";

const validInput = {
  consentDemandMatching: "on",
  consentNotifications: null,
  decisionRole: "owner",
  district: "เมืองเชียงใหม่",
  email: "buyer@example.com",
  fullName: "ผู้สนใจ โซลาร์",
  honeypot: "",
  installationWindow: "3_6_months",
  investmentScore: "72",
  latitude: "18.7883",
  longitude: "98.9853",
  packagePriceThb: "220000",
  phone: "0812345678",
  postalCode: "50200",
  preferredRadiusKm: "15",
  propertyType: "detached_home",
  province: "เชียงใหม่",
  referralCode: "ES-FRIEND01",
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

  it("rejects an address whose postal code does not match the subdistrict", () => {
    const result = communityInterestSchema.safeParse({ ...validInput, postalCode: "50000" });
    expect(result.success).toBe(false);
  });

  it("normalizes a referral code", () => {
    const result = communityInterestSchema.safeParse({ ...validInput, referralCode: " es-friend01 " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.referralCode).toBe("ES-FRIEND01");
  });

  it("rejects an invalid referral code before registration", () => {
    expect(communityReferralCodeSchema.safeParse("not-a-code").success).toBe(false);
  });

  it("requires both first and last name", () => {
    const result = communityInterestSchema.safeParse({ ...validInput, fullName: "สมชาย" });
    expect(result.success).toBe(false);
  });

  it("requires a phone number", () => {
    const result = communityInterestSchema.safeParse({ ...validInput, phone: "" });
    expect(result.success).toBe(false);
  });
});
