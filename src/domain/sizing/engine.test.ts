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
    expect(result.candidates).toHaveLength(0);
    expect(result.blockingReasons).toContain("Datasheet แผงยังไม่ผ่านการตรวจสอบ");
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
      datasheet: {
        ...demoInverters[0].datasheet,
        verificationStatus: "verified" as const,
        verifiedAt: "2026-10-27T00:00:00.000Z",
      },
    };
    const pvModule = {
      ...demoPvModules[0],
      datasheet: {
        ...demoPvModules[0].datasheet,
        verificationStatus: "verified" as const,
        verifiedAt: "2026-10-27T00:00:00.000Z",
      },
    };

    const result = evaluateSizing({
      pvModule,
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
    expect(result.candidates).toHaveLength(0);
  });

  it("allows calculation-scoped overrides for missing inverter power and a front-side-only bifacial basis", () => {
    const verifiedDatasheet = {
      ...demoPvModules[0].datasheet,
      verificationStatus: "verified" as const,
      verifiedAt: "2026-11-10T00:00:00.000Z",
    };
    const pvModule = {
      ...demoPvModules[0],
      isBifacial: true,
      bifacialDesignCase: null,
      datasheet: verifiedDatasheet,
    };
    const inverter = {
      ...demoInverters[0],
      maxDcPowerWp: null,
      datasheet: { ...verifiedDatasheet, revisionId: demoInverters[0].datasheet.revisionId },
    };

    const result = evaluateSizing({
      pvModule,
      inverter,
      assumptions,
      overrides: {
        bifacial: { acknowledged: true, mode: "FRONT_SIDE_ONLY" },
        maxDcPowerWp: 15_000,
      },
    }, context);

    expect(result.overallStatus).toBe("PRELIMINARY_COMPATIBLE");
    expect(result.blockingReasons).toEqual([]);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.walkthrough.designBasis).toBe("FRONT_SIDE_USER_OVERRIDE");
    expect(result.walkthrough.inverterLimits.maxDcPowerSource).toBe("USER_OVERRIDE");
    expect(result.candidates[0].findings).toContainEqual(expect.objectContaining({
      ruleId: "R11_USER_OVERRIDE",
      status: "WARNING",
    }));
  });

  it("uses a complete user-entered rear-side design case without changing catalog specs", () => {
    const verifiedDatasheet = {
      ...demoPvModules[0].datasheet,
      verificationStatus: "verified" as const,
      verifiedAt: "2026-11-10T00:00:00.000Z",
    };
    const pvModule = {
      ...demoPvModules[0],
      isBifacial: true,
      bifacialDesignCase: null,
      datasheet: verifiedDatasheet,
    };
    const inverter = {
      ...demoInverters[0],
      datasheet: { ...verifiedDatasheet, revisionId: demoInverters[0].datasheet.revisionId },
    };

    const result = evaluateSizing({
      pvModule,
      inverter,
      assumptions,
      overrides: {
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
    }, context);

    expect(result.blockingReasons).toEqual([]);
    expect(result.walkthrough.designBasis).toBe("USER_REAR_SIDE");
    expect(result.walkthrough.designElectricals?.source).toBe("USER_OVERRIDE");
    expect(result.walkthrough.currents.impA).toBe(18.1);
    expect(result.walkthrough.currents.designIscA).toBe(23.7);
    expect(pvModule.bifacialDesignCase).toBeNull();
  });

  it("ignores an override when the verified Datasheet value already exists", () => {
    const verifiedDatasheet = {
      ...demoPvModules[0].datasheet,
      verificationStatus: "verified" as const,
      verifiedAt: "2026-11-10T00:00:00.000Z",
    };
    const result = evaluateSizing({
      pvModule: { ...demoPvModules[0], datasheet: verifiedDatasheet },
      inverter: {
        ...demoInverters[0],
        datasheet: { ...verifiedDatasheet, revisionId: demoInverters[0].datasheet.revisionId },
      },
      assumptions,
      overrides: { maxDcPowerWp: 100 },
    }, context);

    expect(result.overrides).toBeNull();
    expect(result.walkthrough.inverterLimits.maxDcPowerWp).toBe(demoInverters[0].maxDcPowerWp);
    expect(result.walkthrough.inverterLimits.maxDcPowerSource).toBe("DATASHEET");
  });

  it("reproduces the engineering-approved LONGi and Deye golden calculation", () => {
    const verifiedDatasheet = {
      ...demoPvModules[0].datasheet,
      verificationStatus: "verified" as const,
      verifiedAt: "2026-11-09T00:00:00.000Z",
    };
    const pvModule = {
      ...demoPvModules[0],
      id: "98eaa963-a611-49e6-a8df-f0354f09be7a",
      manufacturer: "LONGi",
      model: "LR7-72HVD-645M",
      pmaxWp: 645,
      vocV: 53.7,
      vmpV: 44.56,
      iscA: 15.17,
      impA: 14.48,
      betaVocPerC: -0.002,
      betaVmpPerC: -0.0031,
      betaVmpSource: "derived" as const,
      isBifacial: true,
      bifacialDesignCase: {
        approvedAt: "2026-11-09T00:00:00.000Z",
        rearGainFraction: 0.25,
        pmaxWp: 808,
        vocV: 53.8,
        vmpV: 44.66,
        iscA: 18.96,
        impA: 18.1,
        sourcePage: "2",
      },
      datasheet: { ...verifiedDatasheet, revisionId: "d0aa8216-4bc4-419c-a597-9b9023aea741" },
    };
    const inverter = {
      ...demoInverters[0],
      id: "23c710e2-6612-4be5-a315-d8d45daad33e",
      manufacturer: "Deye",
      model: "SUN-12K-SG02LP1-EU-AM3",
      ratedAcKw: 12,
      maxDcVoltageV: 500,
      maxDcPowerWp: 19_200,
      maxRecommendedPvWp: 24_000,
      startupVoltageV: 125,
      trackers: [1, 2, 3].map((trackerIndex) => ({
        trackerIndex,
        mpptMinV: 150,
        mpptMaxV: 425,
        maxOperatingCurrentA: 26,
        maxShortCircuitCurrentA: 44,
        inputCount: 2,
      })),
      datasheet: { ...verifiedDatasheet, revisionId: "75e5da3f-264a-462c-96db-7647817add9b" },
    };

    const result = evaluateSizing({ pvModule, inverter, assumptions }, context);
    const best = result.candidates[0];

    expect(result.overallStatus).toBe("PRELIMINARY_COMPATIBLE");
    expect(result.blockingReasons).toEqual([]);
    expect(result.walkthrough.temperature).toEqual({
      vmpHotV: 38.43,
      vocColdV: 57.57,
      vmpColdV: 49.51,
    });
    expect(result.walkthrough.currents).toEqual({
      designIscA: 23.7,
      impA: 18.1,
      safetyFactor: 1.25,
    });
    expect(best.totalModules).toBe(17);
    expect(best.totalDcPowerWp).toBe(10_965);
    expect(best.designTotalDcPowerWp).toBe(13_736);
    expect(best.mpptConfigurations.map((item) => [item.seriesModules, item.parallelStrings])).toEqual([
      [6, 1],
      [6, 1],
      [5, 1],
    ]);
  });

  it("fails closed without temperature coefficients", () => {
    const result = evaluateSizing({
      pvModule: { ...demoPvModules[0], betaVmpPerC: null },
      inverter: demoInverters[0],
      assumptions,
    }, context);

    expect(result.overallStatus).toBe("INSUFFICIENT_DATA");
    expect(result.candidates).toHaveLength(0);
    expect(result.blockingReasons).toContain("Datasheet แผงไม่มี βVmp");
    expect(result.walkthrough.temperature.vocColdV).not.toBeNull();
    expect(result.walkthrough.temperature.vmpHotV).toBeNull();
    expect(result.walkthrough.trackers[0].seriesRange.maxModulesByColdVoc).not.toBeNull();
    expect(result.walkthrough.trackers[0].seriesRange.maxModules).toBeNull();
    expect(result.walkthrough.trackers[0].seriesRange.minModulesByMppt).toBeNull();
  });

  it("supports different series counts for asymmetric MPPT limits", () => {
    const verifiedDatasheet = {
      ...demoInverters[0].datasheet,
      verificationStatus: "verified" as const,
      verifiedAt: "2026-10-27T00:00:00.000Z",
    };
    const inverter = {
      ...demoInverters[0],
      datasheet: verifiedDatasheet,
      trackers: [
        { ...demoInverters[0].trackers[0], inputCount: 1, mpptMaxV: 400 },
        { ...demoInverters[0].trackers[1], mpptMinV: 600 },
      ],
    };
    const result = evaluateSizing({
      pvModule: {
        ...demoPvModules[0],
        datasheet: { ...verifiedDatasheet, revisionId: demoPvModules[0].datasheet.revisionId },
      },
      inverter,
      assumptions: { ...assumptions, targetDcPowerWp: 13_750 },
    }, context);

    expect(result.candidates[0].mpptConfigurations[0].seriesModules)
      .not.toBe(result.candidates[0].mpptConfigurations[1].seriesModules);
  });
});

describe("evaluateSizing walkthrough", () => {
  it("derives module cap, series range and per-string currents from the same specs", () => {
    const { walkthrough } = evaluateSizing({
      pvModule: demoPvModules[0],
      inverter: demoInverters[0],
      assumptions,
    }, context);

    expect(walkthrough.temperature?.vocColdV).toBeCloseTo(49.9 * (1 - 0.0025 * (-10 - 25)), 1);
    expect(walkthrough.trackers[0].seriesRange?.maxModules)
      .toBeGreaterThanOrEqual(walkthrough.trackers[0].seriesRange?.minModules ?? Infinity);
    expect(walkthrough.trackers[0].seriesRange.minModules).toBe(
      Math.max(
        walkthrough.trackers[0].seriesRange.minModulesByMppt ?? 0,
        walkthrough.trackers[0].seriesRange.minModulesByStartup ?? 0,
      ),
    );
    expect(walkthrough.trackers[0].stringRows[0].strings).toBe(1);
    expect(walkthrough.trackers[0].stringRows).toHaveLength(demoInverters[0].trackers[0].inputCount);
  });

  it("uses one approved bifacial design-current basis for Imp and Isc checks", () => {
    const pvModule = {
      ...demoPvModules[0],
      bifacialDesignCase: {
        approvedAt: "2026-11-09T00:00:00.000Z",
        impA: 18.1,
        iscA: 18.96,
        pmaxWp: 808,
        rearGainFraction: 0.25,
        sourcePage: "2",
        vmpV: 44.66,
        vocV: 53.8,
      },
    };

    const { walkthrough } = evaluateSizing({
      pvModule,
      inverter: demoInverters[0],
      assumptions,
    }, context);

    expect(walkthrough.trackers[0].stringRows[0].operatingA).toBe(18.1);
    expect(walkthrough.trackers[0].stringRows[0].shortCircuitA).toBe(23.7);
  });
});
