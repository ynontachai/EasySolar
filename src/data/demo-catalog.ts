import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";

/**
 * Synthetic records used only to exercise the scaffold.
 * They do not represent a real manufacturer product and must never be published
 * as verified equipment data.
 */
export const demoPvModules: PvModuleSpec[] = [
  {
    id: "demo-pv-550",
    manufacturer: "EasySolar Lab",
    model: "DEMO-PV-550",
    market: "DEMO",
    pmaxWp: 550,
    vocV: 49.9,
    vmpV: 41.96,
    iscA: 13.98,
    impA: 13.11,
    betaVocPerC: -0.0025,
    betaVmpPerC: -0.003,
    maxSystemVoltageV: 1500,
    isBifacial: false,
    datasheet: {
      revisionId: "demo-pv-550-r1",
      revisionLabel: "DEMO R1",
      sourceUrl: null,
      sourceNote: "ข้อมูลสังเคราะห์สำหรับทดสอบระบบเท่านั้น",
      verifiedAt: null,
      verificationStatus: "unverified",
    },
  },
];

export const demoInverters: InverterSpec[] = [
  {
    id: "demo-inverter-10k",
    manufacturer: "EasySolar Lab",
    model: "DEMO-INV-10K-2MPPT",
    market: "DEMO",
    ratedAcKw: 10,
    maxDcVoltageV: 1100,
    maxDcPowerWp: 15000,
    maxRecommendedPvWp: 13000,
    startupVoltageV: 200,
    trackers: [1, 2].map((trackerIndex) => ({
      trackerIndex,
      mpptMinV: 200,
      mpptMaxV: 1000,
      maxOperatingCurrentA: 26,
      maxShortCircuitCurrentA: 32,
      inputCount: 2,
    })),
    datasheet: {
      revisionId: "demo-inverter-10k-r1",
      revisionLabel: "DEMO R1",
      sourceUrl: null,
      sourceNote: "ข้อมูลสังเคราะห์สำหรับทดสอบระบบเท่านั้น",
      verifiedAt: null,
      verificationStatus: "unverified",
    },
  },
];

export function findPvModule(id: string) {
  return demoPvModules.find((item) => item.id === id);
}

export function findInverter(id: string) {
  return demoInverters.find((item) => item.id === id);
}
