"use server";

import { revalidatePath } from "next/cache";
import { inviteAdminSchema } from "@/domain/identity/invite-schemas";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import { HttpError } from "@/lib/server/http-error";
import { recordInvitation } from "@/lib/server/user-invitation-repository";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export interface InviteAdminActionState {
  message: string;
  status: "error" | "idle" | "success";
}

const roleLabels = {
  account_admin: "Account Admin",
  reviewer: "Catalog Reviewer",
} as const;

export async function inviteAdminAction(
  _state: InviteAdminActionState,
  formData: FormData,
): Promise<InviteAdminActionState> {
  const parsed = inviteAdminSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    organizationId: formData.get("organizationId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "ข้อมูลคำเชิญไม่ถูกต้อง",
      status: "error",
    };
  }

  try {
    const principal = await requireAdminPrincipal(["super_admin"]);

    if (!isSupabaseAdminConfigured()) {
      throw new HttpError(503, "SUPABASE_ADMIN_NOT_CONFIGURED", "ยังไม่ได้ตั้งค่าการส่งคำเชิญสำหรับ environment นี้");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: parsed.data.displayName ? { display_name: parsed.data.displayName } : undefined,
    });

    if (error || !data.user) {
      if (error?.code === "email_exists" || error?.message.toLowerCase().includes("already")) {
        throw new HttpError(409, "EMAIL_ALREADY_REGISTERED", "อีเมลนี้มีบัญชีในระบบแล้ว");
      }
      throw new HttpError(502, "INVITE_EMAIL_FAILED", "ส่งคำเชิญไม่สำเร็จ กรุณาลองใหม่");
    }

    try {
      await recordInvitation(principal, { ...parsed.data, userId: data.user.id });
    } catch (dbError) {
      // Remove the just-created auth user so a retry can reinvite cleanly.
      const { error: rollbackError } = await supabase.auth.admin.deleteUser(data.user.id);
      if (rollbackError) console.error("Invite rollback failed", data.user.id, rollbackError);
      throw dbError;
    }

    revalidatePath("/admin/users");
    return {
      message: `ส่งคำเชิญถึง ${parsed.data.email} ในบทบาท ${roleLabels[parsed.data.role]} แล้ว`,
      status: "success",
    };
  } catch (error) {
    return {
      message: error instanceof HttpError ? error.message : "ส่งคำเชิญไม่สำเร็จ",
      status: "error",
    };
  }
}
