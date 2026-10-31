"use server";

import { revalidatePath } from "next/cache";
import {
  publishInputSchema,
  recallInputSchema,
  rejectInputSchema,
  verifyInputSchema,
} from "@/domain/catalog/spec-schemas";
import type { RevisionAction } from "@/domain/catalog/review-workflow";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import { HttpError } from "@/lib/server/http-error";
import { applyReviewAction } from "@/lib/server/review-repository";

export interface ReviewActionState {
  message: string;
  status: "error" | "idle" | "success";
}

const successCopy: Record<RevisionAction, string> = {
  enter_spec: "บันทึกสเปกแล้ว",
  publish: "Publish revision แล้ว เห็นได้ใน Library และ Checker",
  recall: "Recall revision แล้ว",
  reject: "ส่งกลับไปแก้ไขแล้ว",
  verify: "ยืนยันสเปกแล้ว พร้อม Publish",
};

interface ParsedReview {
  confirmedFields: string[];
  note: string | null;
  overrideReason: string | null;
  reason: string | null;
  revisionId: string;
}

function parseReviewForm(
  action: RevisionAction,
  formData: FormData,
): ParsedReview | { error: string } {
  const revisionId = formData.get("revisionId");
  const confirmedFields = formData.getAll("confirmedFields").map(String);
  const reason = formData.get("reason");
  const note = formData.get("note");
  const overrideReason = formData.get("overrideReason");

  if (action === "verify") {
    const parsed = verifyInputSchema.safeParse({
      confirmedFields,
      note: note ?? undefined,
      overrideReason: overrideReason ?? undefined,
      revisionId,
    });
    return parsed.success
      ? {
          confirmedFields: parsed.data.confirmedFields,
          note: parsed.data.note ?? null,
          overrideReason: parsed.data.overrideReason || null,
          reason: null,
          revisionId: parsed.data.revisionId,
        }
      : { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  if (action === "reject") {
    const parsed = rejectInputSchema.safeParse({ reason, revisionId });
    return parsed.success
      ? { confirmedFields: [], note: null, overrideReason: null, reason: parsed.data.reason, revisionId: parsed.data.revisionId }
      : { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  if (action === "recall") {
    const parsed = recallInputSchema.safeParse({ reason, revisionId });
    return parsed.success
      ? { confirmedFields: [], note: null, overrideReason: null, reason: parsed.data.reason, revisionId: parsed.data.revisionId }
      : { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const parsed = publishInputSchema.safeParse({ revisionId });
  return parsed.success
    ? { confirmedFields: [], note: null, overrideReason: null, reason: null, revisionId: parsed.data.revisionId }
    : { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
}

export async function reviewRevisionAction(
  _state: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const intent = formData.get("intent");
  const action = (["verify", "reject", "publish", "recall"] as const).find(
    (value) => value === intent,
  );
  if (!action) return { message: "ไม่รู้จักรายการที่ส่งมา", status: "error" };

  const parsed = parseReviewForm(action, formData);
  if ("error" in parsed) return { message: parsed.error, status: "error" };

  try {
    const principal = await requireAdminPrincipal(["reviewer", "super_admin"]);
    await applyReviewAction({
      action,
      actor: principal,
      confirmedFields: parsed.confirmedFields,
      note: parsed.note,
      overrideReason: parsed.overrideReason,
      reason: parsed.reason,
      revisionId: parsed.revisionId,
    });
    revalidatePath("/admin/equipment");
    revalidatePath("/equipment");
    revalidatePath("/checker");
    return { message: successCopy[action], status: "success" };
  } catch (error) {
    return {
      message: error instanceof HttpError ? error.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
      status: "error",
    };
  }
}
