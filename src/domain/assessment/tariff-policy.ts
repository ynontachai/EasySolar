import type { SolarAssessmentDraft } from "./schema";

export const residentialTariffPolicy = {
  code: "TH-PEA-RESIDENTIAL-2026-09",
  effectiveFrom: "2026-09-01",
  ft: {
    bahtPerKwh: 0.1623,
    effectiveThrough: "2026-12-31",
    sourceLabel: "สำนักงาน กกพ. · ค่า Ft ก.ย.–ธ.ค. 2569",
    sourceUrl: "https://www.erc.or.th/th/automatic",
  },
  normal: {
    lowUse: {
      serviceChargeBahtPerMonth: 8.19,
      tiers: [
        { fromKwh: 0, rateBahtPerKwh: 2.3488, toKwh: 15 },
        { fromKwh: 15, rateBahtPerKwh: 2.9882, toKwh: 25 },
        { fromKwh: 25, rateBahtPerKwh: 3, toKwh: 200 },
        { fromKwh: 200, rateBahtPerKwh: 4.1584, toKwh: 400 },
        { fromKwh: 400, rateBahtPerKwh: 4.3583, toKwh: null },
      ],
    },
    standard: {
      serviceChargeBahtPerMonth: 24.62,
      tiers: [
        { fromKwh: 0, rateBahtPerKwh: 3, toKwh: 200 },
        { fromKwh: 200, rateBahtPerKwh: 4.1584, toKwh: 400 },
        { fromKwh: 400, rateBahtPerKwh: 4.3583, toKwh: null },
      ],
    },
  },
  sourceLabel: "PEA · โครงสร้างอัตราค่าไฟฟ้า มีผลตั้งแต่ ก.ย. 2569",
  sourceUrl:
    "https://www.pea.co.th/sites/default/files/users/user34/attachments/Electricity_Tariff_SEP_2026_3.pdf",
  tou: {
    offPeakBahtPerKwh: 2.6369,
    peakBahtPerKwh: 5.7982,
    serviceChargeBahtPerMonth: 24.62,
    schedule: {
      offPeak: "22:00–09:00 วันจันทร์–ศุกร์ และตลอดวันเสาร์–อาทิตย์/วันหยุดที่กำหนด",
      peak: "09:00–22:00 วันจันทร์–ศุกร์",
    },
    voltageClass: "แรงดันต่ำกว่า 22 kV",
  },
  vatRate: 0.07,
} as const;

export const exportCompensationPolicy = {
  bahtPerKwh: 2.2,
  code: "OWNER-ASSUMPTION-EXPORT-2.20",
  sourceLabel: "อัตราที่เจ้าของผลิตภัณฑ์กำหนดสำหรับแบบประเมิน",
} as const;

function getNormalMarginalRate(averageEnergyKwh: number) {
  const tariffClass = averageEnergyKwh <= 150
    ? residentialTariffPolicy.normal.lowUse
    : residentialTariffPolicy.normal.standard;
  const tier = tariffClass.tiers.find(
    (candidate) =>
      averageEnergyKwh > candidate.fromKwh &&
      (candidate.toKwh === null || averageEnergyKwh <= candidate.toKwh),
  );

  return tier?.rateBahtPerKwh ?? tariffClass.tiers.at(-1)?.rateBahtPerKwh ?? 0;
}

function addFtAndVat(energyRateBahtPerKwh: number) {
  return (
    (energyRateBahtPerKwh + residentialTariffPolicy.ft.bahtPerKwh) *
    (1 + residentialTariffPolicy.vatRate)
  );
}

export function createTariffInsight(draft: SolarAssessmentDraft) {
  const completeEnergyBills = draft.bills.every((bill) => bill.energyKwh !== null);
  const averageEnergyKwh = completeEnergyBills
    ? draft.bills.reduce((total, bill) => total + (bill.energyKwh ?? 0), 0) /
      draft.bills.length
    : null;

  let estimatedDaylightSelfUseValueBahtPerKwh: number | null = null;
  let method: "normal-marginal" | "tou-weekday-weekend" | "insufficient-data" =
    "insufficient-data";

  if (draft.tariff === "normal" && averageEnergyKwh !== null) {
    estimatedDaylightSelfUseValueBahtPerKwh = addFtAndVat(
      getNormalMarginalRate(averageEnergyKwh),
    );
    method = "normal-marginal";
  }

  if (draft.tariff === "tou") {
    const indicativeDaylightEnergyRate =
      (residentialTariffPolicy.tou.peakBahtPerKwh * 5 +
        residentialTariffPolicy.tou.offPeakBahtPerKwh * 2) /
      7;
    estimatedDaylightSelfUseValueBahtPerKwh = addFtAndVat(
      indicativeDaylightEnergyRate,
    );
    method = "tou-weekday-weekend";
  }

  const exportValueBahtPerKwh =
    draft.exportIntent === "none" ? 0 : exportCompensationPolicy.bahtPerKwh;

  return {
    averageEnergyKwh,
    estimatedDaylightSelfUseValueBahtPerKwh,
    exportValueBahtPerKwh,
    method,
  };
}
