import { z } from "zod";

export const sizingRequestSchema = z.object({
  pvModuleId: z.string().min(1).max(100),
  inverterId: z.string().min(1).max(100),
  assumptions: z
    .object({
      tcellMinC: z.number().min(-60).max(40),
      tcellMaxC: z.number().min(25).max(100),
      currentSafetyFactor: z.number().min(1).max(2),
      targetDcPowerWp: z.number().min(100).max(10_000_000),
    })
    .refine((value) => value.tcellMinC < value.tcellMaxC, {
      message: "อุณหภูมิต่ำสุดต้องน้อยกว่าอุณหภูมิสูงสุด",
      path: ["tcellMinC"],
    }),
});

export type SizingRequest = z.infer<typeof sizingRequestSchema>;
