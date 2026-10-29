import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getAdminPrincipal } from "@/lib/server/admin-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin Sign in" };

interface AdminLoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const principal = await getAdminPrincipal();
  if (principal) redirect("/admin");

  const { next } = await searchParams;

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-aside">
        <Link className="brand" href="/">
          <span className="brand__mark" aria-hidden="true">ES</span>
          <span>EasySolar</span>
        </Link>
        <div>
          <p className="eyebrow">CATALOG OPERATIONS</p>
          <h1>ข้อมูลที่เชื่อถือได้ เริ่มจากสิทธิ์ที่ชัดเจน</h1>
          <p>
            พื้นที่นี้สำหรับ Account Admin, Reviewer และ Super Admin
            ที่ได้รับคำเชิญเท่านั้น
          </p>
        </div>
        <span><ShieldCheck size={18} /> Supabase Auth · Role-scoped access</span>
      </section>
      <section className="admin-auth-panel" aria-labelledby="admin-login-title">
        <div>
          <p className="eyebrow eyebrow--dark">WELCOME BACK</p>
          <h2 id="admin-login-title">เข้าสู่ระบบหลังบ้าน</h2>
          <p>ใช้บัญชีที่ EasySolar ส่งคำเชิญให้ ไม่มีการเปิดสมัครสมาชิกสาธารณะ</p>
        </div>
        <AdminLoginForm
          authConfigured={isSupabaseAuthConfigured()}
          nextPath={next}
        />
      </section>
    </main>
  );
}
