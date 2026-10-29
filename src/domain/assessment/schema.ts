import { z } from "zod";

export const assessmentPeriodKeys = [
  "morning",
  "daytime",
  "evening",
  "night",
] as const;

export type AssessmentPeriodKey = (typeof assessmentPeriodKeys)[number];

const billPeriodSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amountThb: z.number().positive().max(1_000_000),
  energyKwh: z.number().positive().max(1_000_000).nullable(),
});

const occupancySchema = z.object({
  morning: z.number().int().min(0).max(30),
  daytime: z.number().int().min(0).max(30),
  evening: z.number().int().min(0).max(30),
  night: z.number().int().min(0).max(30),
});

const acPeriodSchema = z
  .object({
    enabled: z.boolean(),
    unitCount: z.number().int().min(0).max(20),
    hours: z.number().min(0).max(12),
  })
  .superRefine((value, context) => {
    if (value.enabled && value.unitCount < 1) {
      context.addIssue({
        code: "custom",
        message: "กรุณาระบุจำนวนเครื่องปรับอากาศ",
        path: ["unitCount"],
      });
    }

    if (value.enabled && value.hours <= 0) {
      context.addIssue({
        code: "custom",
        message: "กรุณาระบุชั่วโมงใช้งานโดยประมาณ",
        path: ["hours"],
      });
    }

    if (!value.enabled && (value.unitCount !== 0 || value.hours !== 0)) {
      context.addIssue({
        code: "custom",
        message: "ช่วงเวลาที่ไม่เปิดแอร์ต้องไม่มีจำนวนเครื่องหรือชั่วโมงใช้งาน",
      });
    }
  });

const acUsageSchema = z.object({
  morning: acPeriodSchema,
  daytime: acPeriodSchema,
  evening: acPeriodSchema,
  night: acPeriodSchema,
});

const solarAssessmentDraftBaseSchema = z.object({
  bills: z.array(billPeriodSchema).length(3),
  occupancy: occupancySchema,
  acUsage: acUsageSchema,
  tariff: z.enum(["normal", "tou", "unknown"]),
  exportIntent: z.enum(["none", "interested", "contracted"]),
});

function validateUniqueBillMonths(
  bills: Array<{ month: string }>,
  context: z.RefinementCtx,
) {
  const uniqueMonths = new Set(bills.map((bill) => bill.month));
  if (uniqueMonths.size !== bills.length) {
    context.addIssue({
      code: "custom",
      message: "เดือนของบิลต้องไม่ซ้ำกัน",
      path: ["bills"],
    });
  }
}

export const solarAssessmentDraftSchema =
  solarAssessmentDraftBaseSchema.superRefine((value, context) => {
    validateUniqueBillMonths(value.bills, context);
  });

export const billStepSchema = solarAssessmentDraftBaseSchema
  .pick({ bills: true })
  .superRefine((value, context) => validateUniqueBillMonths(value.bills, context));
export const occupancyStepSchema = solarAssessmentDraftBaseSchema.pick({
  occupancy: true,
});
export const acUsageStepSchema = solarAssessmentDraftBaseSchema.pick({
  acUsage: true,
});
export const policyStepSchema = solarAssessmentDraftBaseSchema.pick({
  exportIntent: true,
  tariff: true,
});

export type SolarAssessmentDraft = z.infer<typeof solarAssessmentDraftSchema>;

export function summarizeAssessmentDraft(draft: SolarAssessmentDraft) {
  const averageBillThb =
    draft.bills.reduce((total, bill) => total + bill.amountThb, 0) /
    draft.bills.length;
  const billsWithEnergy = draft.bills.filter(
    (bill): bill is typeof bill & { energyKwh: number } =>
      bill.energyKwh !== null,
  );
  const averageEnergyKwh =
    billsWithEnergy.length === draft.bills.length
      ? billsWithEnergy.reduce((total, bill) => total + bill.energyKwh, 0) /
        billsWithEnergy.length
      : null;
  const daytimeOccupancy = draft.occupancy.morning + draft.occupancy.daytime;
  const enabledAcPeriods = assessmentPeriodKeys.filter(
    (period) => draft.acUsage[period].enabled,
  ).length;
  const estimatedAcHours = assessmentPeriodKeys.reduce(
    (total, period) =>
      total + draft.acUsage[period].hours * draft.acUsage[period].unitCount,
    0,
  );

  return {
    averageBillThb,
    averageEnergyKwh,
    daytimeOccupancy,
    enabledAcPeriods,
    estimatedAcHours,
  };
}
