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
    trackerCount: number;
  };
  /** Module cap from the manufacturer's recommended (else hard) PV power limit. */
  maxModules: { limitWp: number; modulePowerWp: number; modules: number } | null;
  /** Null when the datasheet lacks temperature coefficients. */
  temperature: { vmpHotV: number; vocColdV: number; vmpColdV: number } | null;
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
      maxModules: number;
      maxModulesByColdVmp: number;
      maxModulesByColdVoc: number;
      minModules: number;
      voltageCeilingV: number;
    } | null;
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
