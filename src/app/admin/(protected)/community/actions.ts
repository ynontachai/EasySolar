"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import {
  communityInterestStatuses,
  updateCommunityInterestStatus,
} from "@/lib/server/community-admin-repository";
import { HttpError } from "@/lib/server/http-error";

export interface CommunityStatusActionState {
  message: string;
  status: "error" | "idle" | "success";
}

const statusInputSchema = z.object({
  interestId: z.string().uuid("รหัสรายการไม่ถูกต้อง"),
  status: z.enum(communityInterestStatuses),
});

export async function updateCommunityStatusAction(
  _state: CommunityStatusActionState,
  formData: FormData,
): Promise<CommunityStatusActionState> {
  const parsed = statusInputSchema.safeParse({
    interestId: formData.get("interestId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง", status: "error" };
  }

  try {
    const principal = await requireAdminPrincipal(["super_admin"]);
    await updateCommunityInterestStatus({ ...parsed.data, principal });
    revalidatePath("/admin/community");
    revalidatePath(`/admin/community/${parsed.data.interestId}`);
    return { message: "อัปเดตสถานะแล้ว", status: "success" };
  } catch (error) {
    return {
      message: error instanceof HttpError ? error.message : "อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่",
      status: "error",
    };
  }
}
