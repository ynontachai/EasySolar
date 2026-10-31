import { z } from "zod";

// Form values arrive as strings. Empty optional numbers become null instead of 0 so a
// missing safety-critical value is never silently filled.
const requiredNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `กรุณาระบุ ${label}`)
    .transform((value) => Number(value))
    .pipe(
      z
        .number({ message: `${label} ต้องเป็นตัวเลข` })
        .finite(`${label} ต้องเป็นตัวเลข`)
        .gt(min, `${label} ต้องมากกว่า ${min}`)
        .max(max, `${label} สูงเกินช่วงที่รองรับ`),
    );

const optionalNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(
      z
        .number({ message: `${label} ต้องเป็นตัวเลข` })
        .finite(`${label} ต้องเป็นตัวเลข`)
        .min(min, `${label} ต่ำเกินช่วงที่รองรับ`)
        .max(max, `${label} สูงเกินช่วงที่รองรับ`)
        .nullable(),
    );

const sourcePage = (label: string) =>
  z.string().trim().min(1, `กรุณาระบุหน้าอ้างอิงของ ${label}`).max(40);

const sourceUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)
  .pipe(
    z
      .string()
      .url("ลิงก์แหล่งข้อมูลไม่ถูกต้อง")
      .refine((value) => value.startsWith("https://"), "ลิงก์ต้องขึ้นต้นด้วย https://")
      .max(500)
      .nullable(),
  );

export const pvSpecInputSchema = z
  .object({
    betaVmpPercentPerC: optionalNumber("βVmp", -2, 0),
    betaVocPercentPerC: optionalNumber("βVoc", -2, 0),
    bifacialityFactor: optionalNumber("Bifaciality", 0, 1),
    impA: requiredNumber("Imp", 0, 100),
    iscA: requiredNumber("Isc", 0, 100),
    maxSystemVoltageV: requiredNumber("Max system voltage", 0, 5000),
    pmaxWp: requiredNumber("Pmax", 0, 2000),
    sourcePages: z.object({
      impA: sourcePage("Imp"),
      iscA: sourcePage("Isc"),
      maxSystemVoltageV: sourcePage("Max system voltage"),
      pmaxWp: sourcePage("Pmax"),
      vmpV: sourcePage("Vmp"),
      vocV: sourcePage("Voc"),
    }),
    sourceUrl,
    vmpV: requiredNumber("Vmp", 0, 500),
    vocV: requiredNumber("Voc", 0, 500),
  })
  .superRefine((value, context) => {
    if (value.vmpV >= value.vocV) {
      context.addIssue({ code: "custom", message: "Vmp ต้องน้อยกว่า Voc", path: ["vmpV"] });
    }
    if (value.impA >= value.iscA) {
      context.addIssue({ code: "custom", message: "Imp ต้องน้อยกว่า Isc", path: ["impA"] });
    }
  });

export const trackerInputSchema = z
  .object({
    inputCount: z
      .string()
      .trim()
      .min(1, "กรุณาระบุจำนวน input ของ MPPT")
      .transform((value) => Number(value))
      .pipe(z.number().int("จำนวน input ต้องเป็นจำนวนเต็ม").min(1).max(12)),
    maxOperatingCurrentA: requiredNumber("MPPT current", 0, 200),
    maxShortCircuitCurrentA: requiredNumber("MPPT Isc", 0, 300),
    mpptMaxV: requiredNumber("MPPT max V", 0, 2000),
    mpptMinV: requiredNumber("MPPT min V", 0, 2000),
  })
  .superRefine((value, context) => {
    if (value.mpptMinV >= value.mpptMaxV) {
      context.addIssue({ code: "custom", message: "MPPT min ต้องน้อยกว่า MPPT max", path: ["mpptMinV"] });
    }
  });

export const inverterSpecInputSchema = z
  .object({
    inverterType: z.enum(["string", "hybrid", "micro"], { message: "กรุณาเลือกประเภท Inverter" }),
    maxDcPowerWp: optionalNumber("Max DC power", 0, 10_000_000),
    maxDcVoltageV: requiredNumber("Max DC voltage", 0, 5000),
    maxRecommendedPvWp: optionalNumber("Max recommended PV", 0, 10_000_000),
    ratedAcKw: requiredNumber("Rated AC", 0, 10_000),
    sourcePages: z.object({
      maxDcVoltageV: sourcePage("Max DC voltage"),
      mpptCurrent: sourcePage("MPPT current"),
      mpptRange: sourcePage("MPPT voltage range"),
      ratedAcKw: sourcePage("Rated AC"),
    }),
    sourceUrl,
    startupVoltageV: optionalNumber("Startup voltage", 0, 2000),
    trackers: z.array(trackerInputSchema).min(1, "ต้องมี MPPT อย่างน้อย 1 ตัว").max(12),
  });

export type PvSpecInput = z.infer<typeof pvSpecInputSchema>;
export type InverterSpecInput = z.infer<typeof inverterSpecInputSchema>;

// Percent per °C on the form, fraction per °C in the database and sizing engine.
export function percentToFraction(value: number | null) {
  return value === null ? null : value / 100;
}

export function fractionToPercent(value: string | number | null) {
  return value === null ? null : Number(value) * 100;
}

export const verifyInputSchema = z.object({
  confirmedFields: z.array(z.string().min(1).max(60)).max(20),
  note: z.string().trim().max(500).optional(),
  overrideReason: z.string().trim().max(500).optional(),
  revisionId: z.string().uuid(),
});

export const rejectInputSchema = z.object({
  reason: z.string().trim().min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร").max(500),
  revisionId: z.string().uuid(),
});

export const publishInputSchema = z.object({ revisionId: z.string().uuid() });

export const recallInputSchema = z.object({
  reason: z.string().trim().min(10, "กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร").max(500),
  revisionId: z.string().uuid(),
});
