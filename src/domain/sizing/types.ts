import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";

export type RuleStatus = "PASS" | "FAIL" | "INCOMPLETE" | "WARNING";
export type OverallStatus =
  | "PRELIMINARY_COMPATIBLE"
  | "INCOMPATIBLE"
  | "INSUFFICIENT_DATA";

export interface SizingAssumptions {
  tcellMinC: number;
  tcellMaxC: number;
  currentSafetyFactor: number;
  targetDcPowerWp: number;
}

export interface SizingInput {
  pvModule: PvModuleSpec;
  inverter: InverterSpec;
  assumptions: SizingAssumptions;
}

export interface CalculationContext {
  calculationId: string;
  calculatedAt: string;
}

export interface RuleFinding {
  ruleId: string;
  group: "VOLTAGE" | "CURRENT" | "POWER" | "TOPOLOGY" | "DATA" | "SCOPE";
  label: string;
  status: RuleStatus;
  measured: string;
  limit: string;
  rationale: string;
}

export interface MpptConfiguration {
  trackerIndex: number;
  seriesModules: number;
  parallelStrings: number;
  moduleCount: number;
  dcPowerWp: number;
  designDcPowerWp: number;
}

export interface SizingCandidate {
  id: string;
  rank: number;
  overallStatus: OverallStatus;
  totalModules: number;
  totalDcPowerWp: number;
  designTotalDcPowerWp: number;
  dcAcRatio: number;
  designDcAcRatio: number;
  mpptConfigurations: MpptConfiguration[];
  findings: RuleFinding[];
}

export interface SizingWalkthrough {
  pvModule: Pick<PvModuleSpec, "pmaxWp" | "vocV" | "vmpV" | "iscA" | "impA" | "betaVocPerC" | "betaVmpPerC" | "betaVmpSource">;
  designElectricals: {
    impA: number;
    iscA: number;
    pmaxWp: number;
    rearGainPercent: number;
    sourcePage: string;
    vmpV: number;
    vocV: number;
  } | null;
  inverterLimits: {
    maxDcPowerWp: number | null;
    maxDcVoltageV: number;
    maxRecommendedPvWp: number | null;
    ratedAcKw: number;
    startupVoltageV: number | null;
    trackerCount: number;
  };
  /** Module cap from the stricter available recommended or hard PV power limit. */
  maxModules: {
    basis: "MAX_DC_POWER" | "MAX_RECOMMENDED_PV";
    limitWp: number;
    modulePowerWp: number;
    modules: number;
  } | null;
  /** Each result is independent so available Datasheet checks remain visible. */
  temperature: {
    vmpHotV: number | null;
    vocColdV: number | null;
    vmpColdV: number | null;
  };
  currents: {
    designIscA: number;
    impA: number;
    safetyFactor: number;
  };
  trackers: Array<{
    inputCount: number;
    maxOperatingCurrentA: number;
    maxShortCircuitCurrentA: number;
    mpptMaxV: number;
    mpptMinV: number;
    seriesRange: {
      maxModules: number | null;
      maxModulesByColdVmp: number | null;
      maxModulesByColdVoc: number | null;
      minModules: number | null;
      minModulesByMppt: number | null;
      minModulesByStartup: number | null;
      voltageCeilingV: number;
    };
    stringRows: Array<{
      operatingA: number;
      operatingPass: boolean;
      pass: boolean;
      shortCircuitA: number;
      shortCircuitPass: boolean;
      strings: number;
      topologyPass: boolean;
    }>;
    trackerIndex: number;
  }>;
}

export interface SizingResult {
  calculationId: string;
  engineVersion: string;
  calculatedAt: string;
  overallStatus: OverallStatus;
  equipment: {
    pvModule: Pick<PvModuleSpec, "id" | "manufacturer" | "model"> & {
      revisionId: string;
    };
    inverter: Pick<InverterSpec, "id" | "manufacturer" | "model"> & {
      revisionId: string;
    };
  };
  assumptions: SizingAssumptions;
  blockingReasons: string[];
  candidates: SizingCandidate[];
  walkthrough: SizingWalkthrough;
  limitations: string[];
}
