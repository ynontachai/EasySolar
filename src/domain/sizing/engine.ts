import type { MpptTrackerSpec } from "@/domain/catalog/types";
import type {
  CalculationContext,
  OverallStatus,
  RuleFinding,
  RuleStatus,
  SizingCandidate,
  SizingInput,
  SizingResult,
} from "./types";
import { buildWalkthrough } from "./walkthrough";

export const ENGINE_VERSION = "0.3.1";
const STC_REFERENCE_TEMPERATURE_C = 25;
const MAX_SERIES_MODULES_TO_ENUMERATE = 60;
const MAX_CANDIDATES_TO_RETURN = 5;

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function getDesignElectricals(pvModule: SizingInput["pvModule"]) {
  return pvModule.bifacialDesignCase ?? {
    impA: pvModule.impA,
    iscA: pvModule.iscA,
    pmaxWp: pvModule.pmaxWp,
    vmpV: pvModule.vmpV,
    vocV: pvModule.vocV,
  };
}

function adjustedVoltage(
  stcVoltage: number,
  temperatureCoefficient: number,
  cellTemperatureC: number,
) {
  return (
    stcVoltage *
    (1 +
      temperatureCoefficient *
        (cellTemperatureC - STC_REFERENCE_TEMPERATURE_C))
  );
}

function findStatus(findings: RuleFinding[]): OverallStatus {
  if (findings.some((finding) => finding.status === "FAIL"))
    return "INCOMPATIBLE";
  if (findings.some((finding) => finding.status === "INCOMPLETE"))
    return "INSUFFICIENT_DATA";
  return "PRELIMINARY_COMPATIBLE";
}

function voltageFinding(
  ruleId: string,
  label: string,
  measuredValue: number,
  limitValue: number,
  comparison: "lte" | "gte",
  rationale: string,
): RuleFinding {
  const isPassing =
    comparison === "lte"
      ? measuredValue <= limitValue
      : measuredValue >= limitValue;

  return {
    ruleId,
    group: "VOLTAGE",
    label,
    status: isPassing ? "PASS" : "FAIL",
    measured: `${round(measuredValue)} V`,
    limit: `${comparison === "lte" ? "≤" : "≥"} ${round(limitValue)} V`,
    rationale,
  };
}

function evaluateTracker(
  input: SizingInput,
  tracker: MpptTrackerSpec,
  seriesModules: number,
  parallelStrings: number,
): RuleFinding[] {
  const { pvModule, inverter, assumptions } = input;
  const design = getDesignElectricals(pvModule);

  const betaVocPerC = pvModule.betaVocPerC;
  const betaVmpPerC = pvModule.betaVmpPerC;
  const hasTemperatureCoefficients = betaVocPerC !== null && betaVmpPerC !== null;

  if (!hasTemperatureCoefficients) {
    const missing = [
      pvModule.betaVocPerC === null ? "βVoc" : null,
      pvModule.betaVmpPerC === null ? "βVmp" : null,
    ].filter(Boolean);
    return [
      {
        ruleId: "R10_TEMPERATURE_COEFFICIENTS",
        group: "DATA",
        label: `สัมประสิทธิ์อุณหภูมิ · MPPT ${tracker.trackerIndex}`,
        status: "INCOMPLETE",
        measured: `ขาด ${missing.join(" และ ")}`,
        limit: "ต้องมี βVoc และ βVmp พร้อมหน่วยและแหล่งอ้างอิง",
        rationale: "หยุดสร้าง Candidate เพราะยังตรวจ cold Voc และ hot/cold Vmp ไม่ได้",
      },
      ...currentAndTopologyFindings(input, tracker, parallelStrings),
    ];
  }

  const coldVocString =
    seriesModules *
    adjustedVoltage(
      design.vocV,
      betaVocPerC,
      assumptions.tcellMinC,
    );
  const hotVmpString =
    seriesModules *
    adjustedVoltage(
      design.vmpV,
      betaVmpPerC,
      assumptions.tcellMaxC,
    );
  const coldVmpString =
    seriesModules *
    adjustedVoltage(
      design.vmpV,
      betaVmpPerC,
      assumptions.tcellMinC,
    );
  const coldVocLimit = Math.min(
    inverter.maxDcVoltageV,
    pvModule.maxSystemVoltageV,
  );
  const findings: RuleFinding[] = [
    voltageFinding(
      "R01_COLD_VOC",
      `แรงดัน Voc ขณะเย็น · MPPT ${tracker.trackerIndex}`,
      coldVocString,
      coldVocLimit,
      "lte",
      "แรงดันวงจรเปิดต้องไม่เกินขีดจำกัดต่ำสุดของแผงและอินเวอร์เตอร์",
    ),
    voltageFinding(
      "R02_HOT_VMP",
      `แรงดัน Vmp ขณะร้อน · MPPT ${tracker.trackerIndex}`,
      hotVmpString,
      tracker.mpptMinV,
      "gte",
      "String ต้องรักษาแรงดันขั้นต่ำในช่วง MPPT เมื่อเซลล์ร้อน",
    ),
    voltageFinding(
      "R03_COLD_VMP",
      `แรงดัน Vmp ขณะเย็น · MPPT ${tracker.trackerIndex}`,
      coldVmpString,
      tracker.mpptMaxV,
      "lte",
      "String ต้องอยู่ใต้ขอบบนของช่วง MPPT เมื่อเซลล์เย็น",
    ),
    {
      ruleId: "R04_STARTUP",
      group: "VOLTAGE",
      label: `แรงดันเริ่มทำงาน · MPPT ${tracker.trackerIndex}`,
      status:
        inverter.startupVoltageV === null
          ? "INCOMPLETE"
          : hotVmpString >= inverter.startupVoltageV
            ? "PASS"
            : "FAIL",
      measured: `${round(hotVmpString)} V`,
      limit:
        inverter.startupVoltageV === null
          ? "ไม่พบในข้อมูล"
          : `≥ ${inverter.startupVoltageV} V`,
      rationale: "ใช้ Vmp ขณะร้อนเป็น conservative operating check เบื้องต้น",
    },
    ...currentAndTopologyFindings(input, tracker, parallelStrings),
  ];

  return findings;
}

function getBlockingReasons(input: SizingInput) {
  const reasons: string[] = [];
  if (input.pvModule.betaVocPerC === null) reasons.push("Datasheet แผงไม่มี βVoc");
  if (input.pvModule.betaVmpPerC === null) reasons.push("Datasheet แผงไม่มี βVmp");
  if (input.inverter.startupVoltageV === null) reasons.push("Datasheet อินเวอร์เตอร์ไม่มี Startup voltage");
  if (input.inverter.maxDcPowerWp === null) reasons.push("Datasheet อินเวอร์เตอร์ไม่มี Max DC power");
  if (input.inverter.trackers.length === 0) reasons.push("อินเวอร์เตอร์ไม่มีข้อมูล MPPT");
  if (input.pvModule.isBifacial && input.pvModule.bifacialDesignCase === null) {
    reasons.push("ยังไม่มี approved rear-side design case สำหรับแผง Bifacial");
  }
  if (input.pvModule.datasheet.verificationStatus !== "verified") {
    reasons.push("Datasheet แผงยังไม่ผ่านการตรวจสอบ");
  }
  if (input.inverter.datasheet.verificationStatus !== "verified") {
    reasons.push("Datasheet อินเวอร์เตอร์ยังไม่ผ่านการตรวจสอบ");
  }
  return reasons;
}

function hasEngineeringDataBlocker(input: SizingInput) {
  return (
    input.pvModule.betaVocPerC === null ||
    input.pvModule.betaVmpPerC === null ||
    input.inverter.startupVoltageV === null ||
    input.inverter.maxDcPowerWp === null ||
    input.inverter.trackers.length === 0 ||
    (input.pvModule.isBifacial && input.pvModule.bifacialDesignCase === null) ||
    input.pvModule.datasheet.verificationStatus !== "verified" ||
    input.inverter.datasheet.verificationStatus !== "verified"
  );
}

interface TrackerOption {
  configuration: SizingCandidate["mpptConfigurations"][number];
  findings: RuleFinding[];
}

function buildTrackerOptions(input: SizingInput, tracker: MpptTrackerSpec): TrackerOption[] {
  const options: TrackerOption[] = [];
  for (let seriesModules = 1; seriesModules <= MAX_SERIES_MODULES_TO_ENUMERATE; seriesModules += 1) {
    for (let parallelStrings = 1; parallelStrings <= tracker.inputCount; parallelStrings += 1) {
      const findings = evaluateTracker(input, tracker, seriesModules, parallelStrings);
      if (findings.some((finding) => finding.status === "FAIL" || finding.status === "INCOMPLETE")) {
        continue;
      }
      const moduleCount = seriesModules * parallelStrings;
      const design = getDesignElectricals(input.pvModule);
      options.push({
        configuration: {
          trackerIndex: tracker.trackerIndex,
          seriesModules,
          parallelStrings,
          moduleCount,
          dcPowerWp: moduleCount * input.pvModule.pmaxWp,
          designDcPowerWp: moduleCount * design.pmaxWp,
        },
        findings,
      });
    }
  }
  return options;
}

interface CandidateState {
  configurations: SizingCandidate["mpptConfigurations"];
  findings: RuleFinding[];
  totalModules: number;
}

function combineTrackerOptions(input: SizingInput): CandidateState[] {
  if (hasEngineeringDataBlocker(input)) return [];

  const design = getDesignElectricals(input.pvModule);
  const hardModuleLimit = Math.floor(
    (input.inverter.maxDcPowerWp ?? 0) / design.pmaxWp,
  );
  let states: CandidateState[] = [{ configurations: [], findings: [], totalModules: 0 }];

  for (const tracker of input.inverter.trackers) {
    const options = buildTrackerOptions(input, tracker);
    if (options.length === 0) return [];
    const nextByModuleCount = new Map<number, CandidateState>();

    for (const state of states) {
      for (const option of options) {
        const totalModules = state.totalModules + option.configuration.moduleCount;
        if (totalModules > hardModuleLimit) continue;
        const candidate = {
          configurations: [...state.configurations, option.configuration],
          findings: [...state.findings, ...option.findings],
          totalModules,
        };
        const existing = nextByModuleCount.get(totalModules);
        if (!existing || isBetterBalanced(candidate, existing)) {
          nextByModuleCount.set(totalModules, candidate);
        }
      }
    }
    states = [...nextByModuleCount.values()];
  }

  return states;
}

function isBetterBalanced(candidate: CandidateState, existing: CandidateState) {
  const spread = (state: CandidateState) => {
    const series = state.configurations.map((configuration) => configuration.seriesModules);
    return Math.max(...series) - Math.min(...series);
  };
  const spreadDifference = spread(candidate) - spread(existing);
  if (spreadDifference !== 0) return spreadDifference < 0;

  for (let index = 0; index < candidate.configurations.length; index += 1) {
    const difference =
      candidate.configurations[index].seriesModules -
      existing.configurations[index].seriesModules;
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function currentAndTopologyFindings(
  input: SizingInput,
  tracker: MpptTrackerSpec,
  parallelStrings: number,
): RuleFinding[] {
  const design = getDesignElectricals(input.pvModule);
  const operatingCurrent = parallelStrings * design.impA;
  const designShortCircuitCurrent =
    parallelStrings * design.iscA * input.assumptions.currentSafetyFactor;

  return [
    {
      ruleId: "R05_OPERATING_CURRENT",
      group: "CURRENT",
      label: `กระแสทำงาน · MPPT ${tracker.trackerIndex}`,
      status: operatingCurrent <= tracker.maxOperatingCurrentA ? "PASS" : "FAIL",
      measured: `${round(operatingCurrent)} A`,
      limit: `≤ ${tracker.maxOperatingCurrentA} A`,
      rationale: "รวม Imp ของทุก String ที่ต่อขนานบน MPPT เดียวกัน",
    },
    {
      ruleId: "R06_SHORT_CIRCUIT_CURRENT",
      group: "CURRENT",
      label: `กระแสลัดวงจรออกแบบ · MPPT ${tracker.trackerIndex}`,
      status:
        designShortCircuitCurrent <= tracker.maxShortCircuitCurrentA ? "PASS" : "FAIL",
      measured: `${round(designShortCircuitCurrent)} A`,
      limit: `≤ ${tracker.maxShortCircuitCurrentA} A`,
      rationale: `Isc × ${input.assumptions.currentSafetyFactor}; ต้องยืนยัน factor กับมาตรฐานและสภาพไซต์จริง`,
    },
    {
      ruleId: "R08_TOPOLOGY",
      group: "TOPOLOGY",
      label: `จำนวน String · MPPT ${tracker.trackerIndex}`,
      status: parallelStrings <= tracker.inputCount ? "PASS" : "FAIL",
      measured: `${parallelStrings} String`,
      limit: `≤ ${tracker.inputCount} input`,
      rationale: "จำนวน String ต้องไม่เกินจำนวน physical input ที่ระบุ",
    },
  ];
}

function equipmentQualityFindings(input: SizingInput): RuleFinding[] {
  const statuses = [
    input.pvModule.datasheet.verificationStatus,
    input.inverter.datasheet.verificationStatus,
  ];
  const isVerified = statuses.every((status) => status === "verified");
  const hasUnresolvedBifacialCurrent =
    input.pvModule.isBifacial && input.pvModule.bifacialDesignCase === null;
  const isInputComplete = isVerified && !hasUnresolvedBifacialCurrent;

  return [
    {
      ruleId: "R10_INPUT_QUALITY",
      group: "DATA",
      label: "แหล่งข้อมูลและการตรวจสอบ",
      status: isInputComplete ? "PASS" : "INCOMPLETE",
      measured: hasUnresolvedBifacialCurrent
        ? "Bifacial current model unresolved"
        : input.pvModule.bifacialDesignCase
          ? `Approved ${(input.pvModule.bifacialDesignCase.rearGainFraction * 100).toFixed(0)}% rear-gain design case`
        : isVerified
          ? "Verified revisions"
          : "Demo / unverified",
      limit: "ต้อง verified และครอบคลุมเงื่อนไขกระแสของเทคโนโลยีแผง",
      rationale: hasUnresolvedBifacialCurrent
        ? "แผง bifacial ต้องระบุ rear-side gain และวิธีคำนวณ design current ก่อนยืนยันผล"
        : isVerified
          ? "ข้อมูลอ้างอิงรุ่นและ revision ที่ผ่านการตรวจสอบ"
          : "ตัวเลขผ่านกฎไฟฟ้าได้ แต่ห้ามออกผล Compatible จนกว่าจะตรวจ datasheet จริง",
    },
    {
      ruleId: "R09_SYSTEM_COMPONENTS",
      group: "SCOPE",
      label: "ขอบเขตระบบประกอบ",
      status: "WARNING",
      measured: "ไม่ได้ประเมิน",
      limit: "ต้องออกแบบแยก",
      rationale:
        "ผลนี้ไม่ครอบคลุมสายไฟ ฟิวส์ connector isolator SPD earthing โครงสร้าง และฝั่ง AC",
    },
  ];
}

function powerFindings(
  input: SizingInput,
  totalDcPowerWp: number,
  designTotalDcPowerWp: number,
): RuleFinding[] {
  const { inverter } = input;
  const findings: RuleFinding[] = [];

  const hardStatus: RuleStatus =
    inverter.maxDcPowerWp === null
      ? "INCOMPLETE"
      : designTotalDcPowerWp <= inverter.maxDcPowerWp
        ? "PASS"
        : "FAIL";

  findings.push({
    ruleId: "R07_POWER",
    group: "POWER",
    label: "กำลัง DC รวมเทียบขีดจำกัด",
    status: hardStatus,
    measured:
      designTotalDcPowerWp === totalDcPowerWp
        ? `${round(totalDcPowerWp / 1000, 3)} kWp`
        : `${round(designTotalDcPowerWp / 1000, 3)} kW design (${round(totalDcPowerWp / 1000, 3)} kWp front)`,
    limit:
      inverter.maxDcPowerWp === null
        ? "ไม่พบ hard maximum"
        : `≤ ${round(inverter.maxDcPowerWp / 1000, 3)} kWp`,
    rationale: "แยก hard maximum ออกจากค่ากำลัง PV ที่ผู้ผลิตแนะนำ",
  });

  if (
    inverter.maxRecommendedPvWp !== null &&
    designTotalDcPowerWp > inverter.maxRecommendedPvWp
  ) {
    findings.push({
      ruleId: "R07_POWER_RECOMMENDED",
      group: "POWER",
      label: "ช่วงกำลัง PV ที่แนะนำ",
      status: "WARNING",
      measured: `${round(designTotalDcPowerWp / 1000, 3)} kW design`,
      limit: `แนะนำ ≤ ${round(inverter.maxRecommendedPvWp / 1000, 3)} kWp`,
      rationale: "เกินช่วงแนะนำแต่ไม่ตีความเป็น hard fail โดยอัตโนมัติ",
    });
  }

  return findings;
}

export function evaluateSizing(
  input: SizingInput,
  context: CalculationContext,
): SizingResult {
  const { pvModule, inverter, assumptions } = input;
  const blockingReasons = getBlockingReasons(input);
  const design = getDesignElectricals(pvModule);
  const candidates = combineTrackerOptions(input).map((state): SizingCandidate => {
    const totalDcPowerWp = state.totalModules * pvModule.pmaxWp;
    const designTotalDcPowerWp = state.totalModules * design.pmaxWp;
    const findings = [
      ...state.findings,
      ...powerFindings(input, totalDcPowerWp, designTotalDcPowerWp),
      ...equipmentQualityFindings(input),
    ];
    return {
      id: state.configurations
        .map((configuration) => `${configuration.trackerIndex}-${configuration.seriesModules}s-${configuration.parallelStrings}p`)
        .join("_"),
      rank: 0,
      overallStatus: findStatus(findings),
      totalModules: state.totalModules,
      totalDcPowerWp,
      designTotalDcPowerWp,
      dcAcRatio: round(totalDcPowerWp / (inverter.ratedAcKw * 1000), 3),
      designDcAcRatio: round(designTotalDcPowerWp / (inverter.ratedAcKw * 1000), 3),
      mpptConfigurations: state.configurations,
      findings,
    };
  });

  const rankedCandidates = candidates
    .sort(
      (left, right) =>
        Math.abs(left.totalDcPowerWp - assumptions.targetDcPowerWp) -
          Math.abs(right.totalDcPowerWp - assumptions.targetDcPowerWp) ||
        left.totalModules - right.totalModules,
    )
    .slice(0, MAX_CANDIDATES_TO_RETURN)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const overallStatus = rankedCandidates.length
    ? rankedCandidates[0].overallStatus
    : blockingReasons.length > 0
      ? "INSUFFICIENT_DATA"
      : "INCOMPATIBLE";

  return {
    calculationId: context.calculationId,
    engineVersion: ENGINE_VERSION,
    calculatedAt: context.calculatedAt,
    overallStatus,
    equipment: {
      pvModule: {
        id: pvModule.id,
        manufacturer: pvModule.manufacturer,
        model: pvModule.model,
        revisionId: pvModule.datasheet.revisionId,
      },
      inverter: {
        id: inverter.id,
        manufacturer: inverter.manufacturer,
        model: inverter.model,
        revisionId: inverter.datasheet.revisionId,
      },
    },
    assumptions,
    blockingReasons,
    candidates: rankedCandidates,
    walkthrough: buildWalkthrough(pvModule, inverter, assumptions),
    limitations: [
      "Preliminary DC-side PV module–inverter sizing aid only.",
      "ไม่ใช่แบบรับรองวิศวกรรม และไม่ทดแทนคู่มือผู้ผลิต การสำรวจไซต์ หรือวิศวกรผู้รับผิดชอบ",
      "ไม่ครอบคลุม protection, cable, connector, earthing, SPD, structure, AC และ grid code",
    ],
  };
}
