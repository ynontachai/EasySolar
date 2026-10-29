import { describe, expect, it } from "vitest";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { evaluateSizing } from "./engine";

const assumptions = {
  tcellMinC: -10,
  tcellMaxC: 70,
  currentSafetyFactor: 1.25,
  targetDcPowerWp: 11000,
};

const context = {
  calculationId: "test-calculation",
  calculatedAt: "2026-10-27T00:00:00.000Z",
};

describe("evaluateSizing", () => {
  it("never returns a compatible verdict for unverified demo data", () => {
    const result = evaluateSizing({
      pvModule: demoPvModules[0],
      inverter: demoInverters[0],
      assumptions,
    }, context);

    expect(result.overallStatus).toBe("INSUFFICIENT_DATA");
    expect(result.candidates[0].totalDcPowerWp).toBe(11000);
    expect(
      result.candidates[0].findings.some(
        (finding) =>
          finding.ruleId === "R10_INPUT_QUALITY" &&
          finding.status === "INCOMPLETE",
      ),
    ).toBe(true);
  });

  it("returns the same ranked engineering candidates for the same input", () => {
    const input = {
      pvModule: demoPvModules[0],
      inverter: demoInverters[0],
      assumptions,
    };

    const first = evaluateSizing(input, context);
    const second = evaluateSizing(input, context);

    expect(first.candidates).toEqual(second.candidates);
  });

  it("can issue preliminary compatible only when both revisions are verified", () => {
    const pvModule = {
      ...demoPvModules[0],
      datasheet: {
        ...demoPvModules[0].datasheet,
        verificationStatus: "verified" as const,
        verifiedAt: "2026-10-27T00:00:00.000Z",
      },
    };
    const inverter = {
      ...demoInverters[0],
      datasheet: {
        ...demoInverters[0].datasheet,
        verificationStatus: "verified" as const,
        verifiedAt: "2026-10-27T00:00:00.000Z",
      },
    };

    const result = evaluateSizing({ pvModule, inverter, assumptions }, context);

    expect(result.overallStatus).toBe("PRELIMINARY_COMPATIBLE");
  });

  it("returns incompatible when no voltage-safe configuration can start", () => {
    const inverter = {
      ...demoInverters[0],
      maxDcVoltageV: 190,
    };

    const result = evaluateSizing({
      pvModule: demoPvModules[0],
      inverter,
      assumptions,
    }, context);

    expect(result.candidates).toHaveLength(0);
    expect(result.overallStatus).toBe("INCOMPATIBLE");
  });

  it("keeps verified bifacial data incomplete without a rear-side current model", () => {
    const pvModule = {
      ...demoPvModules[0],
      isBifacial: true,
      datasheet: {
        ...demoPvModules[0].datasheet,
        verificationStatus: "verified" as const,
        verifiedAt: "2026-10-27T00:00:00.000Z",
      },
    };
    const inverter = {
      ...demoInverters[0],
      datasheet: {
        ...demoInverters[0].datasheet,
        verificationStatus: "verified" as const,
        verifiedAt: "2026-10-27T00:00:00.000Z",
      },
    };

    const result = evaluateSizing({ pvModule, inverter, assumptions }, context);

    expect(result.overallStatus).toBe("INSUFFICIENT_DATA");
  });
});
