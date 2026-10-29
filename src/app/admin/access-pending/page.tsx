import { redirect } from "next/navigation";
import { Clock3, LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { getAdminPrincipal } from "@/lib/server/admin-auth";

export default async function AdminAccessPendingPage() {
  const principal = await getAdminPrincipal();
  if (!principal) redirect("/admin/login");
  if (principal.roles.length > 0) redirect("/admin");

  return (
    <main className="admin-auth-page admin-auth-page--compact">
      <section className="admin-auth-panel admin-access-pending">
        <Clock3 size={34} aria-hidden="true" />
        <p className="eyebrow eyebrow--dark">ACCESS PENDING</p>
        <h1>บัญชีผ่านการยืนยันแล้ว แต่ยังไม่มีสิทธิ์ใช้งาน</h1>
        <p>
          กรุณาให้ Super Admin กำหนด role และ organization ให้ {principal.email}
          ก่อนเข้าพื้นที่ Catalog Operations
        </p>
        <form action={logoutAction}>
          <button className="button button--outline" type="submit">
            <LogOut size={17} /> ออกจากระบบ
          </button>
        </form>
      </section>
    </main>
  );
}
