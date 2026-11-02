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
 * Trackers are collapsed to their most restrictive limits so one set of numbers
 * is valid for every MPPT; the engine still evaluates each tracker separately.
 */
export function buildWalkthrough(
  pvModule: PvModuleSpec,
  inverter: InverterSpec,
  assumptions: SizingAssumptions,
): SizingWalkthrough {
  const trackers = inverter.trackers;
  const mpptMinV = Math.max(...trackers.map((tracker) => tracker.mpptMinV));
  const mpptMaxV = Math.min(...trackers.map((tracker) => tracker.mpptMaxV));
  const maxOperatingCurrentA = Math.min(...trackers.map((tracker) => tracker.maxOperatingCurrentA));
  const maxShortCircuitCurrentA = Math.min(...trackers.map((tracker) => tracker.maxShortCircuitCurrentA));
  const inputsPerMppt = Math.max(...trackers.map((tracker) => tracker.inputCount));

  const powerLimitWp = inverter.maxRecommendedPvWp ?? inverter.maxDcPowerWp;
  const maxModules = powerLimitWp === null ? null : Math.floor(powerLimitWp / pvModule.pmaxWp);

  const { betaVocPerC, betaVmpPerC } = pvModule;
  const temperature =
    betaVocPerC === null || betaVmpPerC === null
      ? null
      : {
          vmpHotV: adjusted(pvModule.vmpV, betaVmpPerC, assumptions.tcellMaxC),
          vocColdV: adjusted(pvModule.vocV, betaVocPerC, assumptions.tcellMinC),
          vmpColdV: adjusted(pvModule.vmpV, betaVmpPerC, assumptions.tcellMinC),
        };

  const voltageCeilingV = Math.min(inverter.maxDcVoltageV, pvModule.maxSystemVoltageV);
  const seriesRange = temperature
    ? {
        maxModules: Math.floor(voltageCeilingV / temperature.vocColdV),
        minModules: Math.ceil(mpptMinV / temperature.vmpHotV),
        voltageCeilingV,
      }
    : null;

  const designIscA = pvModule.iscA * assumptions.currentSafetyFactor;
  const stringRows = Array.from({ length: inputsPerMppt }, (_, index) => {
    const strings = index + 1;
    const operatingA = strings * pvModule.impA;
    const shortCircuitA = strings * designIscA;
    return {
      strings,
      operatingA: round(operatingA),
      shortCircuitA: round(shortCircuitA),
      pass: operatingA <= maxOperatingCurrentA && shortCircuitA <= maxShortCircuitCurrentA,
    };
  });

  return {
    pvModule: {
      pmaxWp: pvModule.pmaxWp,
      vocV: pvModule.vocV,
      vmpV: pvModule.vmpV,
      iscA: pvModule.iscA,
      impA: pvModule.impA,
      betaVocPerC,
      betaVmpPerC,
    },
    inverterLimits: {
      inputsPerMppt,
      maxDcPowerWp: inverter.maxDcPowerWp,
      maxDcVoltageV: inverter.maxDcVoltageV,
      maxOperatingCurrentA,
      maxRecommendedPvWp: inverter.maxRecommendedPvWp,
      maxShortCircuitCurrentA,
      mpptMaxV,
      mpptMinV,
      trackerCount: trackers.length,
    },
    maxModules: maxModules === null || powerLimitWp === null ? null : { limitWp: powerLimitWp, modules: maxModules },
    temperature: temperature && {
      vmpHotV: round(temperature.vmpHotV),
      vocColdV: round(temperature.vocColdV),
      vmpColdV: round(temperature.vmpColdV),
    },
    seriesRange: seriesRange && { ...seriesRange, voltageCeilingV: round(seriesRange.voltageCeilingV) },
    currents: {
      designIscA: round(designIscA),
      impA: pvModule.impA,
      safetyFactor: assumptions.currentSafetyFactor,
      stringRows,
    },
  };
}
