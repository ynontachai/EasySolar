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
}

export interface SizingCandidate {
  id: string;
  rank: number;
  overallStatus: OverallStatus;
  totalModules: number;
  totalDcPowerWp: number;
  dcAcRatio: number;
  mpptConfigurations: MpptConfiguration[];
  findings: RuleFinding[];
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
  candidates: SizingCandidate[];
  limitations: string[];
}
