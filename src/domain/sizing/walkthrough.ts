import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";
import type { SizingAssumptions, SizingOverrides, SizingWalkthrough } from "./types";

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
  overrides?: SizingOverrides,
): SizingWalkthrough {
  const trackers = inverter.trackers;
  const design = pvModule.bifacialDesignCase;
  const designPmaxWp = design?.pmaxWp ?? pvModule.pmaxWp;
  const powerLimitCandidates = [
    inverter.maxDcPowerWp === null
      ? null
      : { basis: "MAX_DC_POWER" as const, limitWp: inverter.maxDcPowerWp },
    inverter.maxRecommendedPvWp === null
      ? null
      : { basis: "MAX_RECOMMENDED_PV" as const, limitWp: inverter.maxRecommendedPvWp },
  ].filter((value): value is NonNullable<typeof value> => value !== null);
  const selectedPowerLimit = powerLimitCandidates.sort(
    (left, right) => left.limitWp - right.limitWp,
  )[0] ?? null;
  const powerLimitWp = selectedPowerLimit?.limitWp ?? null;
  const maxModules = powerLimitWp === null ? null : Math.floor(powerLimitWp / designPmaxWp);

  const { betaVocPerC, betaVmpPerC } = pvModule;
  const temperature = {
    vmpHotV:
      betaVmpPerC === null
        ? null
        : adjusted(design?.vmpV ?? pvModule.vmpV, betaVmpPerC, assumptions.tcellMaxC),
    vocColdV:
      betaVocPerC === null
        ? null
        : adjusted(design?.vocV ?? pvModule.vocV, betaVocPerC, assumptions.tcellMinC),
    vmpColdV:
      betaVmpPerC === null
        ? null
        : adjusted(design?.vmpV ?? pvModule.vmpV, betaVmpPerC, assumptions.tcellMinC),
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
      betaVocInputSource: overrides?.betaVocPerC !== undefined
        ? "USER_OVERRIDE"
        : betaVocPerC === null
          ? "MISSING"
          : "DATASHEET",
      betaVmpInputSource: overrides?.betaVmpPerC !== undefined
        ? "USER_OVERRIDE"
        : betaVmpPerC === null
          ? "MISSING"
          : pvModule.betaVmpSource === "derived"
            ? "DERIVED"
            : "DATASHEET",
      isBifacial: pvModule.isBifacial,
    },
    designBasis: overrides?.bifacial?.mode === "USER_DESIGN_CASE"
      ? "USER_REAR_SIDE"
      : overrides?.bifacial?.mode === "FRONT_SIDE_ONLY"
        ? "FRONT_SIDE_USER_OVERRIDE"
        : design
          ? "APPROVED_REAR_SIDE"
          : pvModule.isBifacial
            ? "FRONT_SIDE_SYSTEM_OVERRIDE"
            : "FRONT_SIDE",
    designElectricals: design
      ? {
          impA: design.impA,
          iscA: design.iscA,
          pmaxWp: design.pmaxWp,
          rearGainPercent: design.rearGainFraction * 100,
          sourcePage: design.sourcePage,
          vmpV: design.vmpV,
          vocV: design.vocV,
          source: overrides?.bifacial?.mode === "USER_DESIGN_CASE" ? "USER_OVERRIDE" : "DATASHEET",
        }
      : null,
    inverterLimits: {
      maxDcPowerWp: inverter.maxDcPowerWp,
      maxDcPowerSource: overrides?.maxDcPowerWp !== undefined
        ? "USER_OVERRIDE"
        : inverter.maxDcPowerWp === null
          ? "MISSING"
          : "DATASHEET",
      maxDcVoltageV: inverter.maxDcVoltageV,
      maxRecommendedPvWp: inverter.maxRecommendedPvWp,
      ratedAcKw: inverter.ratedAcKw,
      startupVoltageV: inverter.startupVoltageV,
      startupVoltageSource: overrides?.startupVoltageV !== undefined
        ? "USER_OVERRIDE"
        : inverter.startupVoltageV === null
          ? "MISSING"
          : "DATASHEET",
      trackerCount: trackers.length,
    },
    maxModules:
      maxModules === null || powerLimitWp === null
        ? null
        : {
            basis: selectedPowerLimit?.basis ?? "MAX_DC_POWER",
            limitWp: powerLimitWp,
            modulePowerWp: designPmaxWp,
            modules: maxModules,
          },
    temperature: {
      vmpHotV: temperature.vmpHotV === null ? null : round(temperature.vmpHotV),
      vocColdV: temperature.vocColdV === null ? null : round(temperature.vocColdV),
      vmpColdV: temperature.vmpColdV === null ? null : round(temperature.vmpColdV),
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
      seriesRange: (() => {
        const maxModulesByColdVoc =
          temperature.vocColdV === null
            ? null
            : Math.floor(voltageCeilingV / temperature.vocColdV);
        const maxModulesByColdVmp =
          temperature.vmpColdV === null
            ? null
            : Math.floor(tracker.mpptMaxV / temperature.vmpColdV);
        const minModulesByMppt =
          temperature.vmpHotV === null
            ? null
            : Math.ceil(tracker.mpptMinV / temperature.vmpHotV);
        const minModulesByStartup =
          temperature.vmpHotV === null || inverter.startupVoltageV === null
            ? null
            : Math.ceil(inverter.startupVoltageV / temperature.vmpHotV);
        return {
          maxModules:
            maxModulesByColdVoc === null || maxModulesByColdVmp === null
              ? null
              : Math.min(maxModulesByColdVoc, maxModulesByColdVmp),
          maxModulesByColdVmp,
          maxModulesByColdVoc,
          minModules:
            minModulesByMppt === null || minModulesByStartup === null
              ? null
              : Math.max(minModulesByMppt, minModulesByStartup),
          minModulesByMppt,
          minModulesByStartup,
          voltageCeilingV: round(voltageCeilingV),
        };
      })(),
      stringRows: Array.from({ length: tracker.inputCount }, (_, index) => {
        const strings = index + 1;
        const operatingA = strings * calculationImpA;
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
