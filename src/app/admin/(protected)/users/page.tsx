import type { Metadata } from "next";
import { connection } from "next/server";
import { MailPlus, ShieldAlert, Users } from "lucide-react";
import { AdminInviteForm } from "@/components/admin-invite-form";
import { isSuperAdmin, requireAdminPage } from "@/lib/server/admin-auth";
import { listOrganizationsForPrincipal } from "@/lib/server/catalog-admin-repository";
import { listAdminAssignments } from "@/lib/server/user-invitation-repository";

export const metadata: Metadata = { title: "Users and invitations" };

const roleLabels: Record<string, string> = {
  account_admin: "Account Admin",
  reviewer: "Catalog Reviewer",
  super_admin: "Super Admin",
};

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

function statusLabel(row: { lastSignInAt: Date | null; suspended: boolean }) {
  if (row.suspended) return "ถูกระงับ";
  return row.lastSignInAt ? "ใช้งานแล้ว" : "รอตอบรับคำเชิญ";
}

export default async function AdminUsersPage() {
  await connection();
  const principal = await requireAdminPage();

  if (!isSuperAdmin(principal)) {
    return (
      <main className="admin-users-page">
        <div className="admin-form-blocker admin-users-denied" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>เฉพาะ Super Admin เท่านั้นที่เชิญและจัดการผู้ใช้ได้</span>
        </div>
      </main>
    );
  }

  const [organizations, assignments] = await Promise.all([
    listOrganizationsForPrincipal(principal),
    listAdminAssignments(),
  ]);

  return (
    <main className="admin-users-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow eyebrow--dark">ACCESS · INVITATIONS</p>
          <h1>ผู้ใช้และคำเชิญ</h1>
          <p>ส่งคำเชิญทางอีเมลผ่าน Supabase Auth ผู้รับตั้งรหัสผ่านเองก่อนเข้าใช้งาน</p>
        </div>
        <span>{assignments.length} สิทธิ์</span>
      </header>

      <AdminInviteForm organizations={organizations} />

      <section className="admin-users-list" aria-labelledby="admin-users-list-title">
        <div className="admin-users-list__head">
          <Users size={20} aria-hidden="true" />
          <h2 id="admin-users-list-title">สิทธิ์ที่กำหนดแล้ว</h2>
        </div>
        {assignments.length === 0 ? (
          <div className="admin-sku-empty">
            <MailPlus size={28} aria-hidden="true" />
            <strong>ยังไม่มีผู้ได้รับคำเชิญ</strong>
            <p>ส่งคำเชิญรายแรกจากฟอร์มด้านบน</p>
          </div>
        ) : (
          <div className="admin-users-table" role="table" aria-label="รายการสิทธิ์ผู้ใช้">
            <div className="admin-users-table__header" role="row">
              <span role="columnheader">อีเมล</span>
              <span role="columnheader">Role · Organization</span>
              <span role="columnheader">สถานะ</span>
              <span role="columnheader">ส่งเมื่อ</span>
            </div>
            {assignments.map((row) => (
              <article className="admin-users-row" key={`${row.userId}-${row.roleCode}-${row.createdAt.getTime()}`} role="row">
                <div role="cell"><strong>{row.email}</strong></div>
                <div role="cell">
                  <strong>{roleLabels[row.roleCode] ?? row.roleCode}</strong>
                  <small>{row.organizationName ?? "Platform"}</small>
                </div>
                <span className="admin-status" role="cell">{statusLabel(row)}</span>
                <time role="cell" dateTime={row.invitedAt?.toISOString() ?? row.createdAt.toISOString()}>
                  {formatDate(row.invitedAt ?? row.createdAt)}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
