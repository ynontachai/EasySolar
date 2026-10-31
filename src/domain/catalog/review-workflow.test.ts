import { describe, expect, it } from "vitest";
import {
  canPerform,
  evaluateFourEyes,
  evaluatePublishGates,
  evaluateVerifyGates,
} from "./review-workflow";
import { inverterSpecInputSchema, pvSpecInputSchema } from "./spec-schemas";

const pvPages = { impA: "2", iscA: "2", maxSystemVoltageV: "3", pmaxWp: "1", vmpV: "2", vocV: "2" };

const validPv = {
  impA: "13.11",
  iscA: "13.98",
  maxSystemVoltageV: "1500",
  pmaxWp: "550",
  sourcePages: pvPages,
  vmpV: "41.96",
  vocV: "49.9",
};

describe("role and state permissions", () => {
  it("lets an Account Admin do the whole review flow", () => {
    expect(canPerform("enter_spec", "draft", ["account_admin"])).toBe(true);
    expect(canPerform("verify", "extracted_unverified", ["account_admin"])).toBe(true);
    expect(canPerform("reject", "verified", ["account_admin"])).toBe(true);
    expect(canPerform("publish", "verified", ["account_admin"])).toBe(true);
    expect(canPerform("recall", "published", ["account_admin"])).toBe(true);
  });

  it("lets a Reviewer verify and publish but not recall", () => {
    expect(canPerform("verify", "extracted_unverified", ["reviewer"])).toBe(true);
    expect(canPerform("publish", "verified", ["reviewer"])).toBe(true);
    expect(canPerform("recall", "published", ["reviewer"])).toBe(false);
  });

  it("blocks edits to a verified or published revision", () => {
    expect(canPerform("enter_spec", "verified", ["super_admin"])).toBe(false);
    expect(canPerform("enter_spec", "published", ["super_admin"])).toBe(false);
  });

  it("only publishes a verified revision and only recalls a published one", () => {
    expect(canPerform("publish", "extracted_unverified", ["super_admin"])).toBe(false);
    expect(canPerform("recall", "verified", ["super_admin"])).toBe(false);
    expect(canPerform("recall", "published", ["super_admin"])).toBe(true);
  });
});

describe("four-eyes", () => {
  it("allows a different person to verify", () => {
    expect(evaluateFourEyes({ actorId: "b", specEnteredBy: "a" })).toEqual({
      allowed: true,
      overrideRequired: false,
    });
  });

  it("blocks the spec author without a reason", () => {
    expect(evaluateFourEyes({ actorId: "a", specEnteredBy: "a" })).toEqual({
      allowed: false,
      overrideRequired: true,
    });
    expect(evaluateFourEyes({ actorId: "a", overrideReason: "สั้น", specEnteredBy: "a" }).allowed).toBe(false);
  });

  it("lets the spec author verify with a logged reason", () => {
    expect(
      evaluateFourEyes({
        actorId: "a",
        overrideReason: "ทีมมีผู้ดูแลคนเดียว ตรวจกับ datasheet แล้ว",
        specEnteredBy: "a",
      }),
    ).toEqual({ allowed: true, overrideRequired: true });
  });
});

describe("verify and publish gates", () => {
  it("requires every critical field to be confirmed and sourced", () => {
    const result = evaluateVerifyGates({
      category: "pv_module",
      confirmedFields: ["pmaxWp"],
      sourcePages: { pmaxWp: "1" },
      state: "extracted_unverified",
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toHaveLength(2);
  });

  it("passes when all fields are confirmed with pages", () => {
    const result = evaluateVerifyGates({
      category: "pv_module",
      confirmedFields: ["pmaxWp", "vocV", "vmpV", "iscA", "impA", "maxSystemVoltageV"],
      sourcePages: pvPages,
      state: "extracted_unverified",
    });
    expect(result.ready).toBe(true);
  });

  it("blocks publish without a scanned file or official source URL", () => {
    expect(evaluatePublishGates({ hasAvailableFile: false, hasSourceUrl: false, state: "verified" }).ready).toBe(false);
    expect(evaluatePublishGates({ hasAvailableFile: false, hasSourceUrl: true, state: "verified" }).ready).toBe(true);
    expect(evaluatePublishGates({ hasAvailableFile: true, hasSourceUrl: false, state: "verified" }).ready).toBe(true);
  });

  it("blocks publish from an unverified revision", () => {
    expect(evaluatePublishGates({ hasAvailableFile: true, hasSourceUrl: true, state: "extracted_unverified" }).ready).toBe(false);
  });
});

describe("PV spec schema", () => {
  it("accepts a complete spec and converts nothing silently", () => {
    const parsed = pvSpecInputSchema.parse(validPv);
    expect(parsed.pmaxWp).toBe(550);
    expect(parsed.betaVocPercentPerC).toBeNull();
    expect(parsed.sourceUrl).toBeNull();
  });

  it("rejects Vmp above Voc and Imp above Isc", () => {
    const result = pvSpecInputSchema.safeParse({ ...validPv, impA: "14", vmpV: "50" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining(["Vmp ต้องน้อยกว่า Voc", "Imp ต้องน้อยกว่า Isc"]),
    );
  });

  it("rejects a missing source page", () => {
    const result = pvSpecInputSchema.safeParse({ ...validPv, sourcePages: { ...pvPages, vocV: "" } });
    expect(result.success).toBe(false);
  });

  it("requires an https source URL when provided", () => {
    expect(pvSpecInputSchema.safeParse({ ...validPv, sourceUrl: "http://example.com/ds.pdf" }).success).toBe(false);
    expect(pvSpecInputSchema.safeParse({ ...validPv, sourceUrl: "https://example.com/ds.pdf" }).success).toBe(true);
  });
});

describe("inverter spec schema", () => {
  const tracker = {
    inputCount: "2",
    maxOperatingCurrentA: "26",
    maxShortCircuitCurrentA: "32",
    mpptMaxV: "1000",
    mpptMinV: "200",
  };
  const valid = {
    inverterType: "string",
    maxDcVoltageV: "1100",
    ratedAcKw: "10",
    sourcePages: { maxDcVoltageV: "1", mpptCurrent: "1", mpptRange: "1", ratedAcKw: "1" },
    trackers: [tracker],
  };

  it("accepts a complete spec", () => {
    expect(inverterSpecInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an MPPT range with min above max", () => {
    const result = inverterSpecInputSchema.safeParse({
      ...valid,
      trackers: [{ ...tracker, mpptMinV: "1200" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one tracker", () => {
    expect(inverterSpecInputSchema.safeParse({ ...valid, trackers: [] }).success).toBe(false);
  });
});
