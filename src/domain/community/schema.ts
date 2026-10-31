import { z } from "zod";
import { isValidThaiAddress } from "@/domain/location/thai-address";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().finite().nullable(),
);

const optionalPhone = z.preprocess(
  (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    return value.replace(/\D/g, "");
  },
  z.string().regex(/^0\d{8,9}$/, "รูปแบบเบอร์โทรไม่ถูกต้อง").nullable(),
);

export const communityInterestSchema = z
  .object({
    consentDemandMatching: z.literal("on", {
      error: "กรุณายินยอมให้ใช้ข้อมูลเพื่อจับคู่ความต้องการในพื้นที่",
    }),
    consentNotifications: z.enum(["on"]).nullable().catch(null),
    decisionRole: z.enum(["owner", "authorized", "exploring"]),
    district: z.string().trim().min(2, "กรุณาระบุอำเภอ/เขต").max(120),
    email: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง").max(254),
    fullName: z.string().trim().min(2, "กรุณาระบุชื่อ").max(160),
    honeypot: z.string().max(0, "ไม่สามารถส่งแบบฟอร์มได้"),
    installationWindow: z.enum(["0_3_months", "3_6_months", "6_12_months", "exploring"]),
    investmentScore: optionalNumber.pipe(z.number().int().min(0).max(100).nullable()),
    latitude: optionalNumber.pipe(z.number().min(-90).max(90).nullable()),
    longitude: optionalNumber.pipe(z.number().min(-180).max(180).nullable()),
    packagePriceThb: optionalNumber.pipe(z.number().int().positive().max(100_000_000).nullable()),
    phone: optionalPhone,
    postalCode: z.string().trim().regex(/^\d{5}$/, "รหัสไปรษณีย์ต้องมี 5 หลัก"),
    preferredRadiusKm: z.coerce.number().int().pipe(z.union([z.literal(10), z.literal(15), z.literal(20)])),
    propertyType: z.enum(["detached_home", "townhome", "commercial", "other"]),
    province: z.string().trim().min(2, "กรุณาระบุจังหวัด").max(120),
    selectedSystemSizeKw: optionalNumber.pipe(z.number().positive().max(1000).nullable()),
    subdistrict: z.string().trim().min(2, "กรุณาระบุตำบล/แขวง").max(120),
  })
  .superRefine((value, context) => {
    if ((value.latitude === null) !== (value.longitude === null)) {
      context.addIssue({
        code: "custom",
        message: "ข้อมูลพิกัดไม่ครบ กรุณาลองระบุตำแหน่งอีกครั้งหรือข้ามขั้นตอนนี้",
        path: ["latitude"],
      });
    }
    if (!isValidThaiAddress(value)) {
      context.addIssue({
        code: "custom",
        message: "จังหวัด อำเภอ ตำบล และรหัสไปรษณีย์ไม่สัมพันธ์กัน",
        path: ["postalCode"],
      });
    }
  });

export type CommunityInterestInput = z.infer<typeof communityInterestSchema>;
