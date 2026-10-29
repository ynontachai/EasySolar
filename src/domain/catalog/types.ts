export interface DatasheetReference {
  revisionId: string;
  revisionLabel: string;
  sourceUrl: string | null;
  sourceNote: string;
  verifiedAt: string | null;
  verificationStatus: "verified" | "unverified" | "superseded" | "recalled";
}

export interface PvModuleSpec {
  id: string;
  manufacturer: string;
  model: string;
  market: string;
  pmaxWp: number;
  vocV: number;
  vmpV: number;
  iscA: number;
  impA: number;
  betaVocPerC: number | null;
  betaVmpPerC: number | null;
  maxSystemVoltageV: number;
  isBifacial: boolean;
  datasheet: DatasheetReference;
}

export interface MpptTrackerSpec {
  trackerIndex: number;
  mpptMinV: number;
  mpptMaxV: number;
  maxOperatingCurrentA: number;
  maxShortCircuitCurrentA: number;
  inputCount: number;
}

export interface InverterSpec {
  id: string;
  manufacturer: string;
  model: string;
  market: string;
  ratedAcKw: number;
  maxDcVoltageV: number;
  maxDcPowerWp: number | null;
  maxRecommendedPvWp: number | null;
  startupVoltageV: number | null;
  trackers: MpptTrackerSpec[];
  datasheet: DatasheetReference;
}
