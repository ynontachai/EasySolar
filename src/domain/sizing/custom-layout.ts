import {
  MAX_RECOMMENDED_DC_AC_RATIO,
  MIN_RECOMMENDED_DC_AC_RATIO,
} from "./constants";
import type { SizingResult } from "./types";

export type CustomCheckStatus = "PASS" | "FAIL" | "INCOMPLETE";

export interface CustomTrackerLayout {
  seriesModules: number[];
  trackerIndex: number;
}

export interface CustomStringEvaluation {
  seriesModules: number;
  seriesStatus: CustomCheckStatus;
  stringIndex: number;
  vmpColdV: number | null;
  vmpHotV: number | null;
  vmpStatus: CustomCheckStatus;
  vocColdV: number | null;
  vocStatus: CustomCheckStatus;
}

export interface CustomTrackerEvaluation {
  activeStrings: number;
  balancedStatus: CustomCheckStatus;
  inputCount: number;
  maxOperatingCurrentA: number;
  maxShortCircuitCurrentA: number;
  mpptMaxV: number;
  mpptMinV: number;
  operatingA: number;
  operatingStatus: CustomCheckStatus;
  shortCircuitA: number;
  shortCircuitStatus: CustomCheckStatus;
  seriesMaxModules: number | null;
  seriesMinModules: number | null;
  strings: CustomStringEvaluation[];
  topologyStatus: CustomCheckStatus;
  trackerIndex: number;
  voltageCeilingV: number;
}

export interface CustomLayoutEvaluation {
  blockingReasons: string[];
  dataStatus: CustomCheckStatus;
  dcAcRatio: number;
  dcAcStatus: CustomCheckStatus;
  maxDcPowerWp: number | null;
  maxModules: number | null;
  moduleCountStatus: CustomCheckStatus;
  overallStatus: CustomCheckStatus;
  powerStatus: CustomCheckStatus;
  totalDesignDcPowerWp: number;
  totalModules: number;
  trackers: CustomTrackerEvaluation[];
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function statusFor(value: boolean | null): CustomCheckStatus {
  if (value === null) return "INCOMPLETE";
  return value ? "PASS" : "FAIL";
}

function combineStatuses(statuses: CustomCheckStatus[]): CustomCheckStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("INCOMPLETE")) return "INCOMPLETE";
  return "PASS";
}

export function createDefaultCustomLayout(result: SizingResult): CustomTrackerLayout[] {
  const recommended = result.candidates[0];

  return result.walkthrough.trackers.map((tracker) => {
    const configuration = recommended?.mpptConfigurations.find(
      (candidate) => candidate.trackerIndex === tracker.trackerIndex,
    );
    const defaultModules = configuration?.seriesModules ?? tracker.seriesRange.minModules ?? 0;
    const activeStrings = configuration?.parallelStrings ?? (defaultModules > 0 ? 1 : 0);

    return {
      trackerIndex: tracker.trackerIndex,
      seriesModules: Array.from(
        { length: tracker.inputCount },
        (_, index) => index < activeStrings ? defaultModules : 0,
      ),
    };
  });
}

export function evaluateCustomLayout(
  result: SizingResult,
  layout: CustomTrackerLayout[],
): CustomLayoutEvaluation {
  const walkthrough = result.walkthrough;
  const designPmaxWp = walkthrough.designElectricals?.pmaxWp ?? walkthrough.pvModule.pmaxWp;
  const totalModules = layout.reduce(
    (total, tracker) => total + tracker.seriesModules.reduce(
      (trackerTotal, modules) => trackerTotal + (Number.isInteger(modules) && modules > 0 ? modules : 0),
      0,
    ),
    0,
  );
  const totalDesignDcPowerWp = round(totalModules * designPmaxWp);
  const dcAcRatio = round(
    totalDesignDcPowerWp / (walkthrough.inverterLimits.ratedAcKw * 1000),
    3,
  );
  const dcAcStatus = statusFor(
    dcAcRatio >= MIN_RECOMMENDED_DC_AC_RATIO &&
    dcAcRatio <= MAX_RECOMMENDED_DC_AC_RATIO,
  );
  const dataStatus: CustomCheckStatus = result.blockingReasons.length > 0 ? "INCOMPLETE" : "PASS";
  const powerStatus = statusFor(
    walkthrough.inverterLimits.maxDcPowerWp === null
      ? null
      : totalDesignDcPowerWp <= walkthrough.inverterLimits.maxDcPowerWp,
  );
  const moduleCountStatus = statusFor(
    walkthrough.maxModules === null
      ? null
      : totalModules <= walkthrough.maxModules.modules,
  );

  const trackers = walkthrough.trackers.map((tracker): CustomTrackerEvaluation => {
    const trackerLayout = layout.find((item) => item.trackerIndex === tracker.trackerIndex);
    const configuredStrings = trackerLayout?.seriesModules ?? [];
    const activeEntries = configuredStrings
      .map((seriesModules, index) => ({ seriesModules, stringIndex: index + 1 }))
      .filter(({ seriesModules }) => Number.isInteger(seriesModules) && seriesModules > 0);
    const activeStrings = activeEntries.length;
    const operatingA = round(activeStrings * walkthrough.currents.impA);
    const shortCircuitA = round(activeStrings * walkthrough.currents.designIscA);
    const topologyStatus = statusFor(activeStrings >= 1 && activeStrings <= tracker.inputCount);
    const balancedStatus = statusFor(
      activeStrings === 0
        ? false
        : activeEntries.every(({ seriesModules }) => seriesModules === activeEntries[0].seriesModules),
    );
    const operatingStatus = statusFor(operatingA <= tracker.maxOperatingCurrentA);
    const shortCircuitStatus = statusFor(shortCircuitA <= tracker.maxShortCircuitCurrentA);

    const strings = activeEntries.map(({ seriesModules, stringIndex }): CustomStringEvaluation => {
      const vocColdV = walkthrough.temperature.vocColdV === null
        ? null
        : round(seriesModules * walkthrough.temperature.vocColdV);
      const vmpHotV = walkthrough.temperature.vmpHotV === null
        ? null
        : round(seriesModules * walkthrough.temperature.vmpHotV);
      const vmpColdV = walkthrough.temperature.vmpColdV === null
        ? null
        : round(seriesModules * walkthrough.temperature.vmpColdV);
      const seriesStatus = statusFor(
        tracker.seriesRange.minModules === null || tracker.seriesRange.maxModules === null
          ? null
          : seriesModules >= tracker.seriesRange.minModules &&
            seriesModules <= tracker.seriesRange.maxModules,
      );
      const vocStatus = statusFor(
        vocColdV === null ? null : vocColdV <= tracker.seriesRange.voltageCeilingV,
      );
      const vmpStatus = statusFor(
        vmpHotV === null || vmpColdV === null
          ? null
          : vmpHotV >= tracker.mpptMinV && vmpColdV <= tracker.mpptMaxV,
      );

      return {
        seriesModules,
        seriesStatus,
        stringIndex,
        vmpColdV,
        vmpHotV,
        vmpStatus,
        vocColdV,
        vocStatus,
      };
    });

    return {
      activeStrings,
      balancedStatus,
      inputCount: tracker.inputCount,
      maxOperatingCurrentA: tracker.maxOperatingCurrentA,
      maxShortCircuitCurrentA: tracker.maxShortCircuitCurrentA,
      mpptMaxV: tracker.mpptMaxV,
      mpptMinV: tracker.mpptMinV,
      operatingA,
      operatingStatus,
      shortCircuitA,
      shortCircuitStatus,
      seriesMaxModules: tracker.seriesRange.maxModules,
      seriesMinModules: tracker.seriesRange.minModules,
      strings,
      topologyStatus,
      trackerIndex: tracker.trackerIndex,
      voltageCeilingV: tracker.seriesRange.voltageCeilingV,
    };
  });

  const overallStatus = combineStatuses([
    dataStatus,
    dcAcStatus,
    powerStatus,
    moduleCountStatus,
    ...trackers.flatMap((tracker) => [
      tracker.topologyStatus,
      tracker.balancedStatus,
      tracker.operatingStatus,
      tracker.shortCircuitStatus,
      ...tracker.strings.flatMap((string) => [
        string.seriesStatus,
        string.vocStatus,
        string.vmpStatus,
      ]),
    ]),
  ]);

  return {
    blockingReasons: result.blockingReasons,
    dataStatus,
    dcAcRatio,
    dcAcStatus,
    maxDcPowerWp: walkthrough.inverterLimits.maxDcPowerWp,
    maxModules: walkthrough.maxModules?.modules ?? null,
    moduleCountStatus,
    overallStatus,
    powerStatus,
    totalDesignDcPowerWp,
    totalModules,
    trackers,
  };
}
