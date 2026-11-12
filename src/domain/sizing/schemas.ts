import { z } from "zod";

const negativeTemperatureCoefficient = z.number().min(-0.05).max(-0.00001);

const bifacialOverrideSchema = z.discriminatedUnion("mode", [
  z.object({
    acknowledged: z.literal(true),
    mode: z.literal("FRONT_SIDE_ONLY"),
  }),
  z.object({
    impA: z.number().positive().max(100),
    iscA: z.number().positive().max(100),
    mode: z.literal("USER_DESIGN_CASE"),
    pmaxWp: z.number().positive().max(10_000),
    rearGainFraction: z.number().positive().max(1),
    vmpV: z.number().positive().max(2_000),
    vocV: z.number().positive().max(2_000),
  }).superRefine((value, context) => {
    if (value.vmpV >= value.vocV) {
      context.addIssue({ code: "custom", message: "Vmp ต้องน้อยกว่า Voc", path: ["vmpV"] });
    }
    if (value.impA >= value.iscA) {
      context.addIssue({ code: "custom", message: "Imp ต้องน้อยกว่า Isc", path: ["impA"] });
    }
  }),
]);

export const sizingRequestSchema = z.object({
  pvModuleId: z.string().min(1).max(100),
  inverterId: z.string().min(1).max(100),
  overrides: z.object({
    betaVmpPerC: negativeTemperatureCoefficient.optional(),
    betaVocPerC: negativeTemperatureCoefficient.optional(),
    bifacial: bifacialOverrideSchema.optional(),
    maxDcPowerWp: z.number().min(100).max(100_000_000).optional(),
    startupVoltageV: z.number().positive().max(2_000).optional(),
  }).optional(),
  assumptions: z
    .object({
      tcellMinC: z.number().min(-60).max(40),
      tcellMaxC: z.number().min(25).max(100),
      currentSafetyFactor: z.number().min(1.25).max(2),
      targetDcPowerWp: z.number().min(100).max(10_000_000),
    })
    .refine((value) => value.tcellMinC < value.tcellMaxC, {
      message: "อุณหภูมิต่ำสุดต้องน้อยกว่าอุณหภูมิสูงสุด",
      path: ["tcellMinC"],
    }),
});

export type SizingRequest = z.infer<typeof sizingRequestSchema>;
