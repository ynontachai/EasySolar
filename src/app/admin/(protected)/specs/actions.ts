"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { specActivationSchema } from "@/domain/catalog/admin-schemas";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import { setCatalogSpecActivation } from "@/lib/server/catalog-admin-repository";

function specsPath(category: "inverter" | "pv_module", result: "error" | "updated") {
  return `/admin/specs?category=${category}&result=${result}`;
}

export async function updateSpecActivationAction(formData: FormData) {
  const parsed = specActivationSchema.safeParse({
    category: formData.get("category"),
    isActive: formData.get("isActive"),
    targetId: formData.get("targetId"),
    targetType: formData.get("targetType"),
  });

  if (!parsed.success) redirect("/admin/specs?category=inverter&result=error");

  try {
    const principal = await requireAdminPrincipal(["reviewer", "super_admin"]);
    await setCatalogSpecActivation(principal, parsed.data);
  } catch {
    redirect(specsPath(parsed.data.category, "error"));
  }

  revalidatePath("/");
  revalidatePath("/equipment");
  revalidatePath("/admin/catalog");
  revalidatePath("/admin/specs");
  redirect(specsPath(parsed.data.category, "updated"));
}
