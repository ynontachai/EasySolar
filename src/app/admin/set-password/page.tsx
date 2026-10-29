import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminSetPasswordForm } from "@/components/admin-set-password-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set Admin Password" };

export default async function AdminSetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/admin/login");

  return (
    <main className="admin-auth-page admin-auth-page--compact">
      <section className="admin-auth-panel" aria-labelledby="set-password-title">
        <div>
          <p className="eyebrow eyebrow--dark">ACCOUNT ACTIVATION</p>
          <h1 id="set-password-title">ตั้งรหัสผ่านของคุณ</h1>
          <p>ตั้งรหัสผ่านก่อนเข้า Catalog Operations ครั้งแรก</p>
        </div>
        <AdminSetPasswordForm />
      </section>
    </main>
  );
}
