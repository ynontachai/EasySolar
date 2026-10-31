"use server";

import { communityInterestSchema } from "@/domain/community/schema";
import { createCommunityInterest } from "@/lib/server/community-interest-repository";
import { HttpError } from "@/lib/server/http-error";

export interface CommunityInterestActionState {
  message: string;
  referenceCode?: string;
  status: "error" | "idle" | "success";
}
export async function registerCommunityInterestAction(
  _state: CommunityInterestActionState,
  formData: FormData,
): Promise<CommunityInterestActionState> {
  const parsed = communityInterestSchema.safeParse({
    consentDemandMatching: formData.get("consentDemandMatching"),
    consentNotifications: formData.get("consentNotifications"),
    decisionRole: formData.get("decisionRole"),
    district: formData.get("district"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    honeypot: formData.get("companyWebsite") ?? "",
    installationWindow: formData.get("installationWindow"),
    investmentScore: formData.get("investmentScore"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    packagePriceThb: formData.get("packagePriceThb"),
    phone: formData.get("phone"),
    postalCode: formData.get("postalCode"),
    preferredRadiusKm: formData.get("preferredRadiusKm"),
    propertyType: formData.get("propertyType"),
    province: formData.get("province"),
    selectedSystemSizeKw: formData.get("selectedSystemSizeKw"),
    subdistrict: formData.get("subdistrict"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "กรุณาตรวจสอบข้อมูลอีกครั้ง",
      status: "error",
    };
  }

  try {
    const result = await createCommunityInterest(parsed.data);
    return {
      message: "ลงทะเบียนความสนใจแล้ว",
      referenceCode: result.referenceCode,
      status: "success",
    };
  } catch (error) {
    return {
      message: error instanceof HttpError ? error.message : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      status: "error",
    };
  }
}
