"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  inverterSpecInputSchema,
  publishInputSchema,
  pvSpecInputSchema,
  recallInputSchema,
  rejectInputSchema,
  verifyInputSchema,
  type InverterSpecInput,
  type PvSpecInput,
} from "@/domain/catalog/spec-schemas";
import type { RevisionAction } from "@/domain/catalog/review-workflow";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import { HttpError } from "@/lib/server/http-error";
import { applyReviewAction, deleteDraftRevision, enterRevisionSpec } from "@/lib/server/review-repository";
import { deleteStoredObject } from "@/lib/server/object-storage";

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

  if (intent === "delete_draft") {
    const revisionId = z.string().uuid().safeParse(formData.get("revisionId"));
    if (!revisionId.success) return { message: "Revision ID ไม่ถูกต้อง", status: "error" };

    try {
      const principal = await requireAdminPrincipal(["account_admin", "super_admin"]);
      const result = await deleteDraftRevision({ actor: principal, revisionId: revisionId.data });
      const cleanupResults = await Promise.allSettled(
        result.cleanupObjects.map(async (asset) => {
          if (asset.storageProvider !== "s3") throw new Error("UNSUPPORTED_STORAGE_PROVIDER");
          await deleteStoredObject({ bucket: asset.bucket, objectKey: asset.objectKey });
        }),
      );
      const cleanupFailed = cleanupResults.some((cleanup) => cleanup.status === "rejected");

      revalidatePath("/admin/equipment");
      return {
        message: cleanupFailed
          ? "ลบ Draft แล้ว แต่ลบไฟล์แนบจาก Storage ไม่ครบ กรุณาให้ผู้ดูแลตรวจสอบ"
          : "ลบ Draft และไฟล์แนบแล้ว",
        status: "success",
      };
    } catch (error) {
      return {
        message: error instanceof HttpError ? error.message : "ลบ Draft ไม่สำเร็จ กรุณาลองใหม่",
        status: "error",
      };
    }
  }

  const action = (["verify", "reject", "publish", "recall"] as const).find(
    (value) => value === intent,
  );
  if (!action) return { message: "ไม่รู้จักรายการที่ส่งมา", status: "error" };

  const parsed = parseReviewForm(action, formData);
  if ("error" in parsed) return { message: parsed.error, status: "error" };

  try {
    const principal = await requireAdminPrincipal(["account_admin", "reviewer", "super_admin"]);
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

const pvFormFields = [
  "betaVmpPercentPerC",
  "betaVocPercentPerC",
  "bifacialityFactor",
  "impA",
  "iscA",
  "maxSystemVoltageV",
  "pmaxWp",
  "sourceUrl",
  "vmpV",
  "vocV",
] as const;

const inverterFormFields = [
  "inverterType",
  "maxDcPowerWp",
  "maxDcVoltageV",
  "maxRecommendedPvWp",
  "ratedAcKw",
  "sourceUrl",
  "startupVoltageV",
] as const;

const sourcePageFields = {
  pv_module: ["impA", "iscA", "maxSystemVoltageV", "pmaxWp", "vmpV", "vocV"],
  inverter: ["maxDcVoltageV", "mpptCurrent", "mpptRange", "ratedAcKw"],
} as const;

const trackerFormFields = [
  "inputCount",
  "maxOperatingCurrentA",
  "maxShortCircuitCurrentA",
  "mpptMaxV",
  "mpptMinV",
] as const;

// Missing fields become "" so the schema reports "กรุณาระบุ ..." instead of a type error.
function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readSourcePages(formData: FormData, names: readonly string[]) {
  return Object.fromEntries(names.map((name) => [name, readText(formData, `sourcePages.${name}`)]));
}

type ParsedSpec =
  | { category: "pv_module"; spec: PvSpecInput }
  | { category: "inverter"; spec: InverterSpecInput };

function parseSpecForm(formData: FormData): ParsedSpec | { error: string } {
  const category = formData.get("category");

  if (category === "pv_module") {
    const fields = Object.fromEntries(pvFormFields.map((name) => [name, readText(formData, name)]));
    const parsed = pvSpecInputSchema.safeParse({
      ...fields,
      sourcePages: readSourcePages(formData, sourcePageFields.pv_module),
    });
    return parsed.success
      ? { category, spec: parsed.data }
      : { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  if (category === "inverter") {
    const fields = Object.fromEntries(inverterFormFields.map((name) => [name, readText(formData, name)]));
    const trackerFields = Object.fromEntries(
      trackerFormFields.map((name) => [name, formData.getAll(name).map(String)]),
    );
    const trackerCount = formData.getAll("mpptMinV").length;
    const trackers = Array.from({ length: trackerCount }, (_, index) =>
      Object.fromEntries(trackerFormFields.map((name) => [name, trackerFields[name][index] ?? ""])),
    );
    const parsed = inverterSpecInputSchema.safeParse({
      ...fields,
      inverterType: fields.inverterType || undefined,
      sourcePages: readSourcePages(formData, sourcePageFields.inverter),
      trackers,
    });
    return parsed.success
      ? { category, spec: parsed.data }
      : { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  return { error: "ไม่รู้จักประเภทสินค้าที่ส่งมา" };
}

export async function enterSpecAction(
  _state: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const revisionId = z.string().uuid().safeParse(readText(formData, "revisionId"));
  if (!revisionId.success) return { message: "ไม่พบ Datasheet revision ที่ระบุ", status: "error" };

  const parsed = parseSpecForm(formData);
  if ("error" in parsed) return { message: parsed.error, status: "error" };

  try {
    const principal = await requireAdminPrincipal(["account_admin", "super_admin"]);
    await enterRevisionSpec({ ...parsed, actor: principal, revisionId: revisionId.data });
    revalidatePath("/admin/equipment");
    revalidatePath(`/admin/equipment/${revisionId.data}/spec`);
    return { message: successCopy.enter_spec, status: "success" };
  } catch (error) {
    return {
      message: error instanceof HttpError ? error.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
      status: "error",
    };
  }
}
