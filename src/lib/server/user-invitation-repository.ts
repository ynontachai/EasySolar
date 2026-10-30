import "server-only";
import type { InviteAdminInput } from "@/domain/identity/invite-schemas";
import type { AdminPrincipal } from "./admin-auth";
import { getDb } from "./db";
import { HttpError } from "./http-error";

export interface AdminAssignmentRow {
  createdAt: Date;
  email: string;
  invitedAt: Date | null;
  lastSignInAt: Date | null;
  organizationName: string | null;
  roleCode: string;
  suspended: boolean;
  userId: string;
}

export async function listAdminAssignments() {
  const sql = getDb();

  return sql<AdminAssignmentRow[]>`
    SELECT
      role_assignment.created_at AS "createdAt",
      auth_user.email::text AS email,
      auth_user.invited_at AS "invitedAt",
      auth_user.last_sign_in_at AS "lastSignInAt",
      organization.name AS "organizationName",
      role_assignment.role_code::text AS "roleCode",
      (user_profile.status <> 'active') AS suspended,
      role_assignment.user_id::text AS "userId"
    FROM role_assignment
    JOIN auth.users AS auth_user ON auth_user.id = role_assignment.user_id
    LEFT JOIN user_profile ON user_profile.id = role_assignment.user_id
    LEFT JOIN organization ON organization.id = role_assignment.organization_id
    ORDER BY role_assignment.created_at DESC
    LIMIT 200
  `;
}

// Runs after Supabase Auth has created the invited user. Throws HttpError when the
// organization is missing or inactive; the caller removes the auth user on failure.
export async function recordInvitation(
  principal: AdminPrincipal,
  input: InviteAdminInput & { userId: string },
) {
  const sql = getDb();

  await sql.begin(async (tx) => {
    const organizations = await tx<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM organization
      WHERE id = ${input.organizationId}::uuid
        AND status = 'active'
      LIMIT 1
    `;
    if (organizations.length === 0) {
      throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "ไม่พบ Organization ที่ใช้งานได้");
    }

    await tx`
      INSERT INTO user_profile (id, display_name)
      VALUES (${input.userId}::uuid, ${input.displayName ?? input.email.split("@")[0]})
      ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
    `;

    await tx`
      INSERT INTO organization_member (organization_id, user_id, status, invited_by)
      VALUES (
        ${input.organizationId}::uuid,
        ${input.userId}::uuid,
        'active',
        ${principal.userId}::uuid
      )
      ON CONFLICT (organization_id, user_id) DO NOTHING
    `;

    await tx`
      INSERT INTO role_assignment (user_id, role_code, organization_id, granted_by)
      VALUES (
        ${input.userId}::uuid,
        ${input.role}::app_role_code,
        ${input.organizationId}::uuid,
        ${principal.userId}::uuid
      )
      ON CONFLICT DO NOTHING
    `;

    await tx`
      INSERT INTO audit_event (actor_id, organization_id, action, entity_type, entity_id, after_json)
      VALUES (
        ${principal.userId}::uuid,
        ${input.organizationId}::uuid,
        'user.invited',
        'auth_user',
        ${input.userId}::uuid,
        ${tx.json({ role: input.role, organizationId: input.organizationId })}
      )
    `;
  });
}
