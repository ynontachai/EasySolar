"use server";

import { revalidatePath } from "next/cache";
import { createSkuSchema } from "@/domain/catalog/admin-schemas";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import { createCatalogSku } from "@/lib/server/catalog-admin-repository";
import { HttpError } from "@/lib/server/http-error";

export interface CreateSkuActionState {
  message: string;
  status: "error" | "idle" | "success";
}

export async function createSkuAction(
  _state: CreateSkuActionState,
  formData: FormData,
): Promise<CreateSkuActionState> {
  const parsed = createSkuSchema.safeParse({
    manufacturerPartNumber: formData.get("manufacturerPartNumber"),
    organizationId: formData.get("organizationId"),
    productModelId: formData.get("productModelId"),
    sku: formData.get("sku"),
    variantLabel: formData.get("variantLabel"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "ข้อมูล SKU ไม่ถูกต้อง",
      status: "error",
    };
  }

  try {
    const principal = await requireAdminPrincipal(["account_admin", "super_admin"]);
    await createCatalogSku(principal, parsed.data);
    revalidatePath("/admin/catalog");
    return { message: `สร้าง SKU ${parsed.data.sku.toUpperCase()} แล้ว`, status: "success" };
  } catch (error) {
    return {
      message: error instanceof HttpError ? error.message : "สร้าง SKU ไม่สำเร็จ",
      status: "error",
    };
  }
}
