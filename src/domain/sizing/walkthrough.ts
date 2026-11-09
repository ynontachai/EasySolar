import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";
import type { SizingAssumptions, SizingWalkthrough } from "./types";

const STC_REFERENCE_TEMPERATURE_C = 25;

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function adjusted(stc: number, beta: number, cellTemperatureC: number) {
  return stc * (1 + beta * (cellTemperatureC - STC_REFERENCE_TEMPERATURE_C));
}

/**
 * Step-by-step numbers behind the checker, shown to the user as formulas.
 * Every tracker remains separate. Collapsing asymmetric MPPT limits can make a
 * valid limit look applicable to a tracker that has fewer inputs or lower current.
 */
export function buildWalkthrough(
  pvModule: PvModuleSpec,
  inverter: InverterSpec,
  assumptions: SizingAssumptions,
): SizingWalkthrough {
  const trackers = inverter.trackers;
  const design = pvModule.bifacialDesignCase;
  const designPmaxWp = design?.pmaxWp ?? pvModule.pmaxWp;
  const powerLimits = [inverter.maxRecommendedPvWp, inverter.maxDcPowerWp].filter(
    (value): value is number => value !== null,
  );
  const powerLimitWp = powerLimits.length ? Math.min(...powerLimits) : null;
  const maxModules = powerLimitWp === null ? null : Math.floor(powerLimitWp / designPmaxWp);

  const { betaVocPerC, betaVmpPerC } = pvModule;
  const temperature =
    betaVocPerC === null || betaVmpPerC === null
      ? null
      : {
          vmpHotV: adjusted(design?.vmpV ?? pvModule.vmpV, betaVmpPerC, assumptions.tcellMaxC),
          vocColdV: adjusted(design?.vocV ?? pvModule.vocV, betaVocPerC, assumptions.tcellMinC),
          vmpColdV: adjusted(design?.vmpV ?? pvModule.vmpV, betaVmpPerC, assumptions.tcellMinC),
        };

  const voltageCeilingV = Math.min(inverter.maxDcVoltageV, pvModule.maxSystemVoltageV);
  const calculationIscA = design?.iscA ?? pvModule.iscA;
  const calculationImpA = design?.impA ?? pvModule.impA;
  const designIscA = calculationIscA * assumptions.currentSafetyFactor;

  return {
    pvModule: {
      pmaxWp: pvModule.pmaxWp,
      vocV: pvModule.vocV,
      vmpV: pvModule.vmpV,
      iscA: pvModule.iscA,
      impA: pvModule.impA,
      betaVocPerC,
      betaVmpPerC,
      betaVmpSource: pvModule.betaVmpSource,
    },
    designElectricals: design
      ? {
          impA: design.impA,
          iscA: design.iscA,
          pmaxWp: design.pmaxWp,
          rearGainPercent: design.rearGainFraction * 100,
          sourcePage: design.sourcePage,
          vmpV: design.vmpV,
          vocV: design.vocV,
        }
      : null,
    inverterLimits: {
      maxDcPowerWp: inverter.maxDcPowerWp,
      maxDcVoltageV: inverter.maxDcVoltageV,
      maxRecommendedPvWp: inverter.maxRecommendedPvWp,
      trackerCount: trackers.length,
    },
    maxModules:
      maxModules === null || powerLimitWp === null
        ? null
        : { limitWp: powerLimitWp, modulePowerWp: designPmaxWp, modules: maxModules },
    temperature: temperature && {
      vmpHotV: round(temperature.vmpHotV),
      vocColdV: round(temperature.vocColdV),
      vmpColdV: round(temperature.vmpColdV),
    },
    currents: {
      designIscA: round(designIscA),
      impA: calculationImpA,
      safetyFactor: assumptions.currentSafetyFactor,
    },
    trackers: trackers.map((tracker) => ({
      inputCount: tracker.inputCount,
      maxOperatingCurrentA: tracker.maxOperatingCurrentA,
      maxShortCircuitCurrentA: tracker.maxShortCircuitCurrentA,
      mpptMaxV: tracker.mpptMaxV,
      mpptMinV: tracker.mpptMinV,
      seriesRange: temperature
        ? (() => {
            const maxModulesByColdVoc = Math.floor(voltageCeilingV / temperature.vocColdV);
            const maxModulesByColdVmp = Math.floor(tracker.mpptMaxV / temperature.vmpColdV);
            return {
              maxModules: Math.min(maxModulesByColdVoc, maxModulesByColdVmp),
              maxModulesByColdVmp,
              maxModulesByColdVoc,
              minModules: Math.ceil(tracker.mpptMinV / temperature.vmpHotV),
              voltageCeilingV: round(voltageCeilingV),
            };
          })()
        : null,
      stringRows: Array.from({ length: tracker.inputCount }, (_, index) => {
        const strings = index + 1;
        const operatingA = strings * pvModule.impA;
        const shortCircuitA = strings * designIscA;
        const operatingPass = operatingA <= tracker.maxOperatingCurrentA;
        const shortCircuitPass = shortCircuitA <= tracker.maxShortCircuitCurrentA;
        const topologyPass = strings <= tracker.inputCount;
        return {
          operatingA: round(operatingA),
          operatingPass,
          pass: operatingPass && shortCircuitPass && topologyPass,
          shortCircuitA: round(shortCircuitA),
          shortCircuitPass,
          strings,
          topologyPass,
        };
      }),
      trackerIndex: tracker.trackerIndex,
    })),
  };
}
