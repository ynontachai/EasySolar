import Link from "next/link";
import { ArrowUpRight, Boxes, FileUp, ListChecks, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/server/admin-auth";

export default async function AdminHomePage() {
  const principal = await requireAdminPage();
  const organizationNames = [
    ...new Set(
      principal.roles
        .map((role) => role.organizationName)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const canManageCommunity = principal.roles.some((role) => role.code === "super_admin");

  return (
    <main className="admin-home">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow eyebrow--dark">WORK QUEUE</p>
          <h1>วันนี้ต้องจัดการอะไร</h1>
          <p>
            {organizationNames.length > 0
              ? `ขอบเขตข้อมูล: ${organizationNames.join(", ")}`
              : "ขอบเขต Platform · เห็นทุก organization"}
          </p>
        </div>
      </header>
      <section className="admin-task-grid" data-community={canManageCommunity} aria-label="งานที่เริ่มได้">
        <Link href="/admin/catalog">
          <Boxes size={24} />
          <span>สินค้าและ SKU</span>
          <strong>เพิ่ม SKU หนึ่งรายการ</strong>
          <p>ค้น Product Model ก่อนสร้างรหัสขาย เพื่อป้องกันข้อมูลซ้ำ</p>
          <ArrowUpRight size={18} />
        </Link>
        <Link href="/admin/equipment">
          <FileUp size={24} />
          <span>Datasheet intake</span>
          <strong>เพิ่ม Revision และ PDF</strong>
          <p>ไฟล์อยู่ใน private storage และรอ scan ก่อนเข้าสู่ review</p>
          <ArrowUpRight size={18} />
        </Link>
        {canManageCommunity ? (
          <Link href="/admin/community">
            <Users size={24} />
            <span>Community customers</span>
            <strong>ติดตาม Demand และ Referral</strong>
            <p>ดูข้อมูลลูกค้า ขนาด kW พื้นที่ ผู้แนะนำ และอัปเดตสถานะ</p>
            <ArrowUpRight size={18} />
          </Link>
        ) : null}
        <div className="admin-task-grid__disabled" aria-disabled="true">
          <ListChecks size={24} />
          <span>Bulk import</span>
          <strong>นำเข้าหลายรายการ</strong>
          <p>กำลังเตรียม dry run, column mapping และ issue report</p>
          <em>NEXT SLICE</em>
        </div>
      </section>
    </main>
  );
}
