import { z } from "zod";

export const createSkuSchema = z.object({
  manufacturerPartNumber: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  organizationId: z.string().uuid(),
  productModelId: z.string().uuid(),
  sku: z
    .string()
    .trim()
    .min(2, "SKU ต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "SKU ใช้ได้เฉพาะ A–Z, 0–9, จุด, ขีด และ /"),
  variantLabel: z.string().trim().min(2, "กรุณาระบุชื่อรุ่นย่อย").max(160),
});

export type CreateSkuInput = z.infer<typeof createSkuSchema>;
