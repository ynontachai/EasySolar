import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/server";
import { getDb } from "./db";
import { HttpError } from "./http-error";

export const adminRoleCodes = [
  "account_admin",
  "reviewer",
  "super_admin",
] as const;

export type AdminRoleCode = (typeof adminRoleCodes)[number];

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AdminPrincipal {
  displayName: string;
  email: string;
  roles: Array<{
    code: AdminRoleCode;
    organizationId: string | null;
    organizationName: string | null;
  }>;
  userId: string;
}

function isAdminRoleCode(value: string): value is AdminRoleCode {
  return adminRoleCodes.includes(value as AdminRoleCode);
}

export const getAdminPrincipal = cache(async (): Promise<AdminPrincipal | null> => {
  if (!isSupabaseAuthConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) return null;

  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : "";
  const displayName =
    typeof claims.user_metadata === "object" &&
    claims.user_metadata !== null &&
    "display_name" in claims.user_metadata &&
    typeof claims.user_metadata.display_name === "string"
      ? claims.user_metadata.display_name
      : email.split("@")[0] || "EasySolar user";
  const sql = getDb();

  // One round trip: profile and active roles together. The profile row is normally
  // created by the handle_new_auth_user trigger; insert it only when it is missing.
  const loadPrincipalRows = () => sql<
    Array<{
      code: string | null;
      displayName: string;
      organizationId: string | null;
      organizationName: string | null;
      status: "active" | "suspended";
    }>
  >`
    SELECT
      user_profile.display_name AS "displayName",
      user_profile.status::text AS status,
      role_assignment.role_code::text AS code,
      organization.id::text AS "organizationId",
      organization.name AS "organizationName"
    FROM user_profile
    LEFT JOIN role_assignment
      ON role_assignment.user_id = user_profile.id
      AND (
        role_assignment.expires_at IS NULL
        OR role_assignment.expires_at > now()
      )
    LEFT JOIN organization ON organization.id = role_assignment.organization_id
    WHERE user_profile.id = ${userId}
    ORDER BY role_assignment.created_at NULLS LAST
  `;

  let rows = await loadPrincipalRows();

  if (rows.length === 0) {
    await sql`
      INSERT INTO user_profile (id, display_name)
      VALUES (${userId}, ${displayName})
      ON CONFLICT (id) DO NOTHING
    `;
    rows = await loadPrincipalRows();
  }

  const profile = rows[0];
  if (!profile || profile.status !== "active") return null;

  const roles = rows
    .filter((row): row is typeof row & { code: string } => isAdminRoleCode(row.code ?? ""))
    .map((row) => ({
      code: row.code as AdminRoleCode,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
    }));

  return {
    displayName: profile.displayName,
    email,
    roles,
    userId,
  };
});

export async function requireAdminPrincipal(
  allowedRoles: readonly AdminRoleCode[] = adminRoleCodes,
) {
  const principal = await getAdminPrincipal();

  if (!principal) {
    throw new HttpError(
      401,
      "ADMIN_AUTH_REQUIRED",
      "กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล EasySolar",
    );
  }

  if (!principal.roles.some((role) => allowedRoles.includes(role.code))) {
    throw new HttpError(
      403,
      "ADMIN_PERMISSION_REQUIRED",
      "บัญชีนี้ไม่มีสิทธิ์ดำเนินการดังกล่าว",
    );
  }

  return principal;
}

export async function requireAdminPage(
  allowedRoles: readonly AdminRoleCode[] = adminRoleCodes,
) {
  const principal = await getAdminPrincipal();
  if (!principal) redirect("/admin/login");
  if (!principal.roles.some((role) => allowedRoles.includes(role.code))) {
    redirect("/admin/access-pending");
  }

  return principal;
}

export function getPrincipalOrganizationIds(principal: AdminPrincipal) {
  return [
    ...new Set(
      principal.roles
        .map((role) => role.organizationId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

export function isSuperAdmin(principal: AdminPrincipal) {
  return principal.roles.some((role) => role.code === "super_admin");
}
