import Link from "next/link";
import {
  Boxes,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { isSuperAdmin, type AdminPrincipal } from "@/lib/server/admin-auth";

const roleLabels = {
  account_admin: "Account Admin",
  reviewer: "Catalog Reviewer",
  super_admin: "Super Admin",
} as const;

export function AdminShell({
  children,
  principal,
}: {
  children: React.ReactNode;
  principal: AdminPrincipal;
}) {
  const roleSummary = [...new Set(principal.roles.map((role) => roleLabels[role.code]))]
    .join(" · ");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          <span className="brand__mark" aria-hidden="true">ES</span>
          <span>EasySolar</span>
        </Link>
        <nav aria-label="เมนูหลังบ้าน">
          <Link href="/admin"><LayoutDashboard size={18} /> ภาพรวมงาน</Link>
          <Link href="/admin/catalog"><Boxes size={18} /> สินค้าและ SKU</Link>
          <Link href="/admin/equipment"><FileCheck2 size={18} /> Datasheet</Link>
          {isSuperAdmin(principal) ? (
            <Link href="/admin/users"><Users size={18} /> ผู้ใช้และคำเชิญ</Link>
          ) : null}
        </nav>
        <div className="admin-sidebar__account">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>{principal.displayName}</strong>
            <span>{roleSummary}</span>
          </div>
          <form action={logoutAction}>
            <button aria-label="ออกจากระบบ" title="ออกจากระบบ" type="submit">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="admin-shell__content">{children}</div>
    </div>
  );
}
