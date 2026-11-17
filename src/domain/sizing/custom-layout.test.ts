import { describe, expect, it } from "vitest";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { evaluateSizing } from "./engine";
import { createDefaultCustomLayout, evaluateCustomLayout } from "./custom-layout";

const verifiedDatasheet = {
  ...demoPvModules[0].datasheet,
  verificationStatus: "verified" as const,
  verifiedAt: "2026-11-17T00:00:00.000Z",
};

const result = evaluateSizing({
  pvModule: { ...demoPvModules[0], datasheet: verifiedDatasheet },
  inverter: {
    ...demoInverters[0],
    datasheet: { ...verifiedDatasheet, revisionId: demoInverters[0].datasheet.revisionId },
  },
  assumptions: {
    tcellMinC: -10,
    tcellMaxC: 70,
    currentSafetyFactor: 1.25,
    targetDcPowerWp: 11_000,
  },
}, {
  calculationId: "custom-layout-test",
  calculatedAt: "2026-11-17T00:00:00.000Z",
});

describe("custom layout", () => {
  it("builds MPPTs and string inputs from the selected inverter spec", () => {
    const layout = createDefaultCustomLayout(result);

    expect(layout).toHaveLength(2);
    expect(layout.map((tracker) => tracker.seriesModules.length)).toEqual([2, 2]);
    expect(layout.map((tracker) => tracker.trackerIndex)).toEqual([1, 2]);
  });

  it("passes a custom layout that satisfies power, current and voltage limits", () => {
    const evaluation = evaluateCustomLayout(result, [
      { trackerIndex: 1, seriesModules: [11, 0] },
      { trackerIndex: 2, seriesModules: [11, 0] },
    ]);

    expect(evaluation.totalModules).toBe(22);
    expect(evaluation.dcAcRatio).toBe(1.21);
    expect(evaluation.overallStatus).toBe("PASS");
    expect(evaluation.trackers.every((tracker) => tracker.activeStrings === 1)).toBe(true);
  });

  it("sums parallel-string current per MPPT and rejects an over-current layout", () => {
    const evaluation = evaluateCustomLayout(result, [
      { trackerIndex: 1, seriesModules: [6, 6] },
      { trackerIndex: 2, seriesModules: [11, 0] },
    ]);
    const firstTracker = evaluation.trackers[0];

    expect(firstTracker.activeStrings).toBe(2);
    expect(firstTracker.operatingA).toBe(26.22);
    expect(firstTracker.operatingStatus).toBe("FAIL");
    expect(firstTracker.shortCircuitStatus).toBe("FAIL");
    expect(evaluation.overallStatus).toBe("FAIL");
  });

  it("rejects unequal series counts on strings connected to the same MPPT", () => {
    const evaluation = evaluateCustomLayout(result, [
      { trackerIndex: 1, seriesModules: [6, 7] },
      { trackerIndex: 2, seriesModules: [11, 0] },
    ]);

    expect(evaluation.trackers[0].balancedStatus).toBe("FAIL");
    expect(evaluation.overallStatus).toBe("FAIL");
  });

  it("checks every active string against its MPPT series range", () => {
    const evaluation = evaluateCustomLayout(result, [
      { trackerIndex: 1, seriesModules: [5, 0] },
      { trackerIndex: 2, seriesModules: [11, 0] },
    ]);

    expect(evaluation.trackers[0].strings[0].seriesStatus).toBe("FAIL");
    expect(evaluation.trackers[0].strings[0].vmpStatus).toBe("FAIL");
  });

  it("does not report an overall pass when source data is unverified", () => {
    const unverifiedResult = evaluateSizing({
      pvModule: demoPvModules[0],
      inverter: demoInverters[0],
      assumptions: result.assumptions,
    }, {
      calculationId: "unverified-custom-layout-test",
      calculatedAt: "2026-11-17T00:00:00.000Z",
    });
    const evaluation = evaluateCustomLayout(unverifiedResult, [
      { trackerIndex: 1, seriesModules: [11, 0] },
      { trackerIndex: 2, seriesModules: [11, 0] },
    ]);

    expect(evaluation.dataStatus).toBe("INCOMPLETE");
    expect(evaluation.overallStatus).toBe("INCOMPLETE");
  });
});
