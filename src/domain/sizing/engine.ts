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

export const ENGINE_VERSION = "0.1.0-alpha";
const STC_REFERENCE_TEMPERATURE_C = 25;
const MAX_SERIES_MODULES_TO_ENUMERATE = 60;
const MAX_CANDIDATES_TO_RETURN = 5;

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
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

  if (pvModule.betaVocPerC === null || pvModule.betaVmpPerC === null) {
    return [
      {
        ruleId: "R10_INPUT_QUALITY",
        group: "DATA",
        label: "Temperature coefficients",
        status: "INCOMPLETE",
        measured: "ข้อมูลไม่ครบ",
        limit: "ต้องมี βVoc และ βVmp",
        rationale: "ไม่สามารถคำนวณขอบเขตแรงดันตามอุณหภูมิได้",
      },
    ];
  }

  const coldVocString =
    seriesModules *
    adjustedVoltage(
      pvModule.vocV,
      pvModule.betaVocPerC,
      assumptions.tcellMinC,
    );
  const hotVmpString =
    seriesModules *
    adjustedVoltage(
      pvModule.vmpV,
      pvModule.betaVmpPerC,
      assumptions.tcellMaxC,
    );
  const coldVmpString =
    seriesModules *
    adjustedVoltage(
      pvModule.vmpV,
      pvModule.betaVmpPerC,
      assumptions.tcellMinC,
    );
  const operatingCurrent = parallelStrings * pvModule.impA;
  const designShortCircuitCurrent =
    parallelStrings * pvModule.iscA * assumptions.currentSafetyFactor;

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
    {
      ruleId: "R05_OPERATING_CURRENT",
      group: "CURRENT",
      label: `กระแสทำงาน · MPPT ${tracker.trackerIndex}`,
      status:
        operatingCurrent <= tracker.maxOperatingCurrentA ? "PASS" : "FAIL",
      measured: `${round(operatingCurrent)} A`,
      limit: `≤ ${tracker.maxOperatingCurrentA} A`,
      rationale: "รวม Imp ของทุก String ที่ต่อขนานบน MPPT เดียวกัน",
    },
    {
      ruleId: "R06_SHORT_CIRCUIT_CURRENT",
      group: "CURRENT",
      label: `กระแสลัดวงจรออกแบบ · MPPT ${tracker.trackerIndex}`,
      status:
        designShortCircuitCurrent <= tracker.maxShortCircuitCurrentA
          ? "PASS"
          : "FAIL",
      measured: `${round(designShortCircuitCurrent)} A`,
      limit: `≤ ${tracker.maxShortCircuitCurrentA} A`,
      rationale: `Isc × ${assumptions.currentSafetyFactor}; ต้องยืนยัน factor กับมาตรฐานและสภาพไซต์จริง`,
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

  return findings;
}

function equipmentQualityFindings(input: SizingInput): RuleFinding[] {
  const statuses = [
    input.pvModule.datasheet.verificationStatus,
    input.inverter.datasheet.verificationStatus,
  ];
  const isVerified = statuses.every((status) => status === "verified");
  const hasUnresolvedBifacialCurrent = input.pvModule.isBifacial;
  const isInputComplete = isVerified && !hasUnresolvedBifacialCurrent;

  return [
    {
      ruleId: "R10_INPUT_QUALITY",
      group: "DATA",
      label: "แหล่งข้อมูลและการตรวจสอบ",
      status: isInputComplete ? "PASS" : "INCOMPLETE",
      measured: hasUnresolvedBifacialCurrent
        ? "Bifacial current model unresolved"
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
): RuleFinding[] {
  const { inverter } = input;
  const findings: RuleFinding[] = [];

  const hardStatus: RuleStatus =
    inverter.maxDcPowerWp === null
      ? "INCOMPLETE"
      : totalDcPowerWp <= inverter.maxDcPowerWp
        ? "PASS"
        : "FAIL";

  findings.push({
    ruleId: "R07_POWER",
    group: "POWER",
    label: "กำลัง DC รวมเทียบขีดจำกัด",
    status: hardStatus,
    measured: `${round(totalDcPowerWp / 1000, 3)} kWp`,
    limit:
      inverter.maxDcPowerWp === null
        ? "ไม่พบ hard maximum"
        : `≤ ${round(inverter.maxDcPowerWp / 1000, 3)} kWp`,
    rationale: "แยก hard maximum ออกจากค่ากำลัง PV ที่ผู้ผลิตแนะนำ",
  });

  if (
    inverter.maxRecommendedPvWp !== null &&
    totalDcPowerWp > inverter.maxRecommendedPvWp
  ) {
    findings.push({
      ruleId: "R07_POWER_RECOMMENDED",
      group: "POWER",
      label: "ช่วงกำลัง PV ที่แนะนำ",
      status: "WARNING",
      measured: `${round(totalDcPowerWp / 1000, 3)} kWp`,
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
  const candidates: SizingCandidate[] = [];
  const maxParallelStrings = Math.max(
    ...inverter.trackers.map((tracker) => tracker.inputCount),
  );

  for (
    let seriesModules = 1;
    seriesModules <= MAX_SERIES_MODULES_TO_ENUMERATE;
    seriesModules += 1
  ) {
    for (
      let parallelStrings = 1;
      parallelStrings <= maxParallelStrings;
      parallelStrings += 1
    ) {
      const mpptConfigurations = inverter.trackers.map((tracker) => ({
        trackerIndex: tracker.trackerIndex,
        seriesModules,
        parallelStrings,
        moduleCount: seriesModules * parallelStrings,
        dcPowerWp: seriesModules * parallelStrings * pvModule.pmaxWp,
      }));
      const totalModules = mpptConfigurations.reduce(
        (total, config) => total + config.moduleCount,
        0,
      );
      const totalDcPowerWp = totalModules * pvModule.pmaxWp;
      const findings = [
        ...inverter.trackers.flatMap((tracker) =>
          evaluateTracker(input, tracker, seriesModules, parallelStrings),
        ),
        ...powerFindings(input, totalDcPowerWp),
        ...equipmentQualityFindings(input),
      ];

      if (findings.some((finding) => finding.status === "FAIL")) continue;

      candidates.push({
        id: `${seriesModules}s-${parallelStrings}p-all-mppt`,
        rank: 0,
        overallStatus: findStatus(findings),
        totalModules,
        totalDcPowerWp,
        dcAcRatio: round(totalDcPowerWp / (inverter.ratedAcKw * 1000), 3),
        mpptConfigurations,
        findings,
      });
    }
  }

  const rankedCandidates = candidates
    .sort(
      (left, right) =>
        Math.abs(left.totalDcPowerWp - assumptions.targetDcPowerWp) -
          Math.abs(right.totalDcPowerWp - assumptions.targetDcPowerWp) ||
        left.totalModules - right.totalModules,
    )
    .slice(0, MAX_CANDIDATES_TO_RETURN)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const fallbackFindings = equipmentQualityFindings(input);
  const overallStatus = rankedCandidates.length
    ? rankedCandidates[0].overallStatus
    : findStatus([
        ...fallbackFindings,
        {
          ruleId: "R00_NO_CANDIDATE",
          group: "TOPOLOGY",
          label: "ไม่พบ Candidate",
          status: "FAIL",
          measured: "0 configuration",
          limit: "อย่างน้อย 1 configuration",
          rationale: "ไม่มีชุด Ns/Np ในขอบเขตที่ผ่านข้อจำกัดทั้งหมด",
        },
      ]);

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
    candidates: rankedCandidates,
    limitations: [
      "Preliminary DC-side PV module–inverter sizing aid only.",
      "ไม่ใช่แบบรับรองวิศวกรรม และไม่ทดแทนคู่มือผู้ผลิต การสำรวจไซต์ หรือวิศวกรผู้รับผิดชอบ",
      "ไม่ครอบคลุม protection, cable, connector, earthing, SPD, structure, AC และ grid code",
    ],
  };
}
