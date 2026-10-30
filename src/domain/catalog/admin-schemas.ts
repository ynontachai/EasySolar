import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : null),
    z.string().trim().max(max).nullable(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value : null),
  z.string().uuid().nullable(),
);

export const createSkuSchema = z.object({
  category: z.enum(["pv_module", "inverter"]),
  exactModel: optionalText(160),
  manufacturerId: optionalUuid,
  manufacturerName: optionalText(160),
  manufacturerPartNumber: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  organizationId: z.string().uuid(),
  productModelId: optionalUuid,
  sku: z
    .string()
    .trim()
    .min(2, "SKU ต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "SKU ใช้ได้เฉพาะ A–Z, 0–9, จุด, ขีด และ /"),
  variantLabel: z.string().trim().min(2, "กรุณาระบุชื่อรุ่นย่อย").max(160),
}).superRefine((value, context) => {
  if (value.productModelId) return;

  if (!value.exactModel) {
    context.addIssue({
      code: "custom",
      message: "กรุณาระบุ Model",
      path: ["exactModel"],
    });
  }

  if (!value.manufacturerId && !value.manufacturerName) {
    context.addIssue({
      code: "custom",
      message: "กรุณาเลือกหรือเพิ่ม Brand",
      path: ["manufacturerId"],
    });
  }

  if (value.manufacturerId && value.manufacturerName) {
    context.addIssue({
      code: "custom",
      message: "เลือก Brand เดิมหรือเพิ่ม Brand ใหม่อย่างใดอย่างหนึ่ง",
      path: ["manufacturerId"],
    });
  }
});

export type CreateSkuInput = z.infer<typeof createSkuSchema>;
