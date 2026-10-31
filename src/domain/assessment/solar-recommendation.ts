import type { SolarAssessmentDraft } from "./schema";
import {
  createTariffInsight,
  exportCompensationPolicy,
  residentialTariffPolicy,
} from "./tariff-policy";

const daysPerMonth = 30.4;
const acLoadKwhPerUnitHour = 0.9;
const fallbackRetailRateBahtPerKwh = 4.5;

const periodHours = {
  morning: 4,
  daytime: 6,
  evening: 6,
  night: 8,
} as const;

const baseLoadFactors = {
  morning: 1,
  daytime: 0.75,
  evening: 1.3,
  night: 0.65,
} as const;

export const solarRecommendationAssumptions = {
  candidateSystemSizesKw: [3, 5, 8, 10],
  daysPerMonth,
  peakWindow: "10:00–14:00",
  peakProductionShare: 0.58,
  solarWindow: "06:00–18:00",
  yieldKwhPerKwpDay: {
    conservative: 3.8,
    expected: 4.2,
    optimistic: 4.6,
  },
} as const;

export interface PaybackRange {
  fastestYears: number;
  slowestYears: number;
}

export interface InvestmentScore {
  band: "review" | "compare" | "promising" | "strong";
  confidencePoints: number;
  label: string;
  paybackPoints: number;
  score: number;
  selfUsePoints: number;
}

export interface SolarEnergyScenario {
  monthlyConsumptionKwh: number;
  monthlyGenerationKwh: number;
  monthlySelfUseKwh: number;
  monthlyExportKwh: number;
  selfConsumptionRatio: number;
  peakWindow: {
    generationKwh: number;
    loadKwh: number;
    selfUseKwh: number;
    exportKwh: number;
  };
  shoulderWindow: {
    generationKwh: number;
    loadKwh: number;
    selfUseKwh: number;
    exportKwh: number;
  };
}

export interface SolarRecommendation {
  recommendedSystemSizeKw: number;
  selectedSystemSizeKw: number;
  energy: SolarEnergyScenario;
  confidence: "high" | "medium" | "low";
  consumptionSource: "bill-kwh" | "bill-value-estimate";
  selfUseValueBahtPerKwh: number;
  exportValueBahtPerKwh: number;
  monthlyBillSavingThb: number;
  monthlyExportValueThb: number;
  annualConfirmedValueThb: number;
  annualPotentialValueThb: number;
  confirmedPayback: PaybackRange | null;
  investmentScore: InvestmentScore | null;
  potentialPayback: PaybackRange | null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, fractionDigits = 2) {
  const power = 10 ** fractionDigits;
  return Math.round(value * power) / power;
}

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

function estimateMonthlyConsumption(draft: SolarAssessmentDraft) {
  const completeEnergyBills = draft.bills.every((bill) => bill.energyKwh !== null);
  if (completeEnergyBills) {
    return {
      kwh:
        draft.bills.reduce((total, bill) => total + (bill.energyKwh ?? 0), 0) /
        draft.bills.length,
      source: "bill-kwh" as const,
    };
  }

  const averageBillThb =
    draft.bills.reduce((total, bill) => total + bill.amountThb, 0) /
    draft.bills.length;
  const tariffInsight = createTariffInsight(draft);
  const indicativeRate =
    tariffInsight.estimatedDaylightSelfUseValueBahtPerKwh ??
    fallbackRetailRateBahtPerKwh;

  return {
    kwh: averageBillThb / indicativeRate,
    source: "bill-value-estimate" as const,
  };
}

function estimateSelfUseValueBahtPerKwh(
  draft: SolarAssessmentDraft,
  monthlyConsumptionKwh: number,
) {
  const tariffInsight = createTariffInsight(draft);
  if (tariffInsight.estimatedDaylightSelfUseValueBahtPerKwh !== null) {
    return tariffInsight.estimatedDaylightSelfUseValueBahtPerKwh;
  }

  if (draft.tariff === "normal") {
    return addFtAndVat(getNormalMarginalRate(monthlyConsumptionKwh));
  }

  const averageBillThb =
    draft.bills.reduce((total, bill) => total + bill.amountThb, 0) /
    draft.bills.length;
  return clamp(averageBillThb / monthlyConsumptionKwh, 2.5, 7);
}

function createMonthlyLoadProfile(
  draft: SolarAssessmentDraft,
  monthlyConsumptionKwh: number,
) {
  const periods = Object.keys(periodHours) as Array<keyof typeof periodHours>;
  const dailyAcUnitHours = periods.reduce(
    (total, period) =>
      total + draft.acUsage[period].hours * draft.acUsage[period].unitCount,
    0,
  );
  const estimatedAcEnergyKwh = Math.min(
    monthlyConsumptionKwh * 0.55,
    dailyAcUnitHours * acLoadKwhPerUnitHour * daysPerMonth,
  );
  const remainingEnergyKwh = monthlyConsumptionKwh - estimatedAcEnergyKwh;

  const activityScores = periods.map((period) => ({
    period,
    score:
      periodHours[period] *
      (baseLoadFactors[period] + draft.occupancy[period] * 0.18),
  }));
  const totalActivityScore = activityScores.reduce(
    (total, item) => total + item.score,
    0,
  );

  const loads = {
    morning: 0,
    daytime: 0,
    evening: 0,
    night: 0,
  };

  for (const { period, score } of activityScores) {
    const acUnitHours =
      draft.acUsage[period].hours * draft.acUsage[period].unitCount;
    const acShare = dailyAcUnitHours > 0 ? acUnitHours / dailyAcUnitHours : 0;
    const activityShare = totalActivityScore > 0 ? score / totalActivityScore : 0;
    loads[period] =
      estimatedAcEnergyKwh * acShare + remainingEnergyKwh * activityShare;
  }

  return loads;
}

function calculateEnergyScenario(
  draft: SolarAssessmentDraft,
  systemSizeKw: number,
  yieldKwhPerKwpDay: number,
): SolarEnergyScenario {
  const consumption = estimateMonthlyConsumption(draft);
  const load = createMonthlyLoadProfile(draft, consumption.kwh);
  const monthlyGenerationKwh = systemSizeKw * yieldKwhPerKwpDay * daysPerMonth;
  const peakGenerationKwh =
    monthlyGenerationKwh * solarRecommendationAssumptions.peakProductionShare;
  const shoulderGenerationKwh = monthlyGenerationKwh - peakGenerationKwh;

  const peakLoadKwh = load.daytime * (4 / periodHours.daytime);
  const shoulderLoadKwh =
    load.morning +
    load.daytime * (2 / periodHours.daytime) +
    load.evening * (2 / periodHours.evening);
  const peakSelfUseKwh = Math.min(peakGenerationKwh, peakLoadKwh);
  const shoulderSelfUseKwh = Math.min(
    shoulderGenerationKwh,
    shoulderLoadKwh,
  );
  const monthlySelfUseKwh = peakSelfUseKwh + shoulderSelfUseKwh;
  const monthlyExportKwh = Math.max(
    monthlyGenerationKwh - monthlySelfUseKwh,
    0,
  );

  return {
    monthlyConsumptionKwh: round(consumption.kwh),
    monthlyGenerationKwh: round(monthlyGenerationKwh),
    monthlySelfUseKwh: round(monthlySelfUseKwh),
    monthlyExportKwh: round(monthlyExportKwh),
    selfConsumptionRatio:
      monthlyGenerationKwh > 0 ? monthlySelfUseKwh / monthlyGenerationKwh : 0,
    peakWindow: {
      generationKwh: round(peakGenerationKwh),
      loadKwh: round(peakLoadKwh),
      selfUseKwh: round(peakSelfUseKwh),
      exportKwh: round(Math.max(peakGenerationKwh - peakSelfUseKwh, 0)),
    },
    shoulderWindow: {
      generationKwh: round(shoulderGenerationKwh),
      loadKwh: round(shoulderLoadKwh),
      selfUseKwh: round(shoulderSelfUseKwh),
      exportKwh: round(
        Math.max(shoulderGenerationKwh - shoulderSelfUseKwh, 0),
      ),
    },
  };
}

function chooseRecommendedSystemSize(draft: SolarAssessmentDraft) {
  const consumption = estimateMonthlyConsumption(draft);
  const targetCoverage = draft.exportIntent === "none" ? 0.65 : 0.9;
  const exportPenalty = draft.exportIntent === "none" ? 1.1 : 0.22;
  let bestSize: number =
    solarRecommendationAssumptions.candidateSystemSizesKw[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const systemSizeKw of solarRecommendationAssumptions.candidateSystemSizesKw) {
    const scenario = calculateEnergyScenario(
      draft,
      systemSizeKw,
      solarRecommendationAssumptions.yieldKwhPerKwpDay.expected,
    );
    const targetGenerationKwh = consumption.kwh * targetCoverage;
    const targetDistance =
      Math.abs(scenario.monthlyGenerationKwh - targetGenerationKwh) /
      targetGenerationKwh;
    const exportRatio =
      scenario.monthlyExportKwh / scenario.monthlyGenerationKwh;
    const score = targetDistance + exportRatio * exportPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestSize = systemSizeKw;
    }
  }

  return bestSize;
}

function createPaybackRange(
  packagePriceThb: number,
  optimisticAnnualValueThb: number,
  conservativeAnnualValueThb: number,
): PaybackRange | null {
  if (
    packagePriceThb <= 0 ||
    optimisticAnnualValueThb <= 0 ||
    conservativeAnnualValueThb <= 0
  ) {
    return null;
  }

  return {
    fastestYears: round(packagePriceThb / optimisticAnnualValueThb, 1),
    slowestYears: round(packagePriceThb / conservativeAnnualValueThb, 1),
  };
}

function createInvestmentScore(
  payback: PaybackRange | null,
  selfConsumptionRatio: number,
  confidence: SolarRecommendation["confidence"],
): InvestmentScore | null {
  if (!payback) return null;

  const midpointYears = (payback.fastestYears + payback.slowestYears) / 2;
  const paybackPoints =
    midpointYears <= 6
      ? 55
      : midpointYears <= 8
        ? 48
        : midpointYears <= 10
          ? 40
          : midpointYears <= 12
            ? 32
            : midpointYears <= 15
              ? 20
              : 8;
  const selfUsePoints = Math.round(clamp(selfConsumptionRatio / 0.8, 0, 1) * 25);
  const confidencePoints = { high: 20, medium: 14, low: 8 }[confidence];
  const score = paybackPoints + selfUsePoints + confidencePoints;

  if (score >= 80) {
    return {
      band: "strong",
      confidencePoints,
      label: "คุ้มค่าน่าสนใจ",
      paybackPoints,
      score,
      selfUsePoints,
    };
  }
  if (score >= 65) {
    return {
      band: "promising",
      confidencePoints,
      label: "มีแนวโน้มน่าสนใจ",
      paybackPoints,
      score,
      selfUsePoints,
    };
  }
  if (score >= 50) {
    return {
      band: "compare",
      confidencePoints,
      label: "ควรเทียบราคาเพิ่ม",
      paybackPoints,
      score,
      selfUsePoints,
    };
  }

  return {
    band: "review",
    confidencePoints,
    label: "ควรทบทวน Package",
    paybackPoints,
    score,
    selfUsePoints,
  };
}

function calculateAnnualValues(
  draft: SolarAssessmentDraft,
  systemSizeKw: number,
  yieldKwhPerKwpDay: number,
  selfUseValueBahtPerKwh: number,
) {
  const scenario = calculateEnergyScenario(
    draft,
    systemSizeKw,
    yieldKwhPerKwpDay,
  );
  const annualSelfUseValueThb =
    scenario.monthlySelfUseKwh * selfUseValueBahtPerKwh * 12;
  const annualExportValueThb =
    scenario.monthlyExportKwh * exportCompensationPolicy.bahtPerKwh * 12;
  const hasConfirmedExport = draft.exportIntent === "contracted";
  const hasPotentialExport = draft.exportIntent !== "none";

  return {
    confirmed:
      annualSelfUseValueThb + (hasConfirmedExport ? annualExportValueThb : 0),
    potential:
      annualSelfUseValueThb + (hasPotentialExport ? annualExportValueThb : 0),
  };
}

export function createSolarRecommendation(
  draft: SolarAssessmentDraft,
  options: { packagePriceThb?: number; systemSizeKw?: number } = {},
): SolarRecommendation {
  const consumption = estimateMonthlyConsumption(draft);
  const recommendedSystemSizeKw = chooseRecommendedSystemSize(draft);
  const selectedSystemSizeKw =
    options.systemSizeKw ?? recommendedSystemSizeKw;
  const packagePriceThb = options.packagePriceThb ?? 0;
  const selfUseValueBahtPerKwh = estimateSelfUseValueBahtPerKwh(
    draft,
    consumption.kwh,
  );
  const energy = calculateEnergyScenario(
    draft,
    selectedSystemSizeKw,
    solarRecommendationAssumptions.yieldKwhPerKwpDay.expected,
  );
  const monthlyBillSavingThb =
    energy.monthlySelfUseKwh * selfUseValueBahtPerKwh;
  const monthlyExportValueThb =
    draft.exportIntent === "none"
      ? 0
      : energy.monthlyExportKwh * exportCompensationPolicy.bahtPerKwh;
  const confirmedAnnualValueThb =
    monthlyBillSavingThb * 12 +
    (draft.exportIntent === "contracted" ? monthlyExportValueThb * 12 : 0);
  const annualPotentialValueThb =
    monthlyBillSavingThb * 12 + monthlyExportValueThb * 12;
  const conservativeAnnualValues = calculateAnnualValues(
    draft,
    selectedSystemSizeKw,
    solarRecommendationAssumptions.yieldKwhPerKwpDay.conservative,
    selfUseValueBahtPerKwh,
  );
  const optimisticAnnualValues = calculateAnnualValues(
    draft,
    selectedSystemSizeKw,
    solarRecommendationAssumptions.yieldKwhPerKwpDay.optimistic,
    selfUseValueBahtPerKwh,
  );

  const confidence =
    consumption.source === "bill-kwh" && draft.tariff !== "unknown"
      ? "high"
      : draft.tariff !== "unknown"
        ? "medium"
        : "low";
  const confirmedPayback = createPaybackRange(
    packagePriceThb,
    optimisticAnnualValues.confirmed,
    conservativeAnnualValues.confirmed,
  );

  return {
    recommendedSystemSizeKw,
    selectedSystemSizeKw,
    energy,
    confidence,
    consumptionSource: consumption.source,
    selfUseValueBahtPerKwh: round(selfUseValueBahtPerKwh, 4),
    exportValueBahtPerKwh:
      draft.exportIntent === "none" ? 0 : exportCompensationPolicy.bahtPerKwh,
    monthlyBillSavingThb: round(monthlyBillSavingThb),
    monthlyExportValueThb: round(monthlyExportValueThb),
    annualConfirmedValueThb: round(confirmedAnnualValueThb),
    annualPotentialValueThb: round(annualPotentialValueThb),
    confirmedPayback,
    investmentScore: createInvestmentScore(
      confirmedPayback,
      energy.selfConsumptionRatio,
      confidence,
    ),
    potentialPayback: createPaybackRange(
      packagePriceThb,
      optimisticAnnualValues.potential,
      conservativeAnnualValues.potential,
    ),
  };
}
