import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, MapPin, Network, Phone, UserRound } from "lucide-react";
import { z } from "zod";
import { CommunityStatusForm } from "@/components/community-status-form";
import { requireAdminPage } from "@/lib/server/admin-auth";
import { getCommunityInterest } from "@/lib/server/community-admin-repository";

export const metadata: Metadata = { title: "Community customer detail" };

const propertyLabels: Record<string, string> = {
  commercial: "ร้านค้า / ธุรกิจขนาดเล็ก",
  detached_home: "บ้านเดี่ยว",
  other: "อื่น ๆ",
  townhome: "ทาวน์โฮม / อาคารแถว",
};
const windowLabels: Record<string, string> = {
  "0_3_months": "ภายใน 3 เดือน",
  "3_6_months": "3–6 เดือน",
  "6_12_months": "6–12 เดือน",
  exploring: "กำลังเปรียบเทียบ",
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

export default async function AdminCommunityDetailPage({
  params,
}: {
  params: Promise<{ interestId: string }>;
}) {
  await connection();
  const principal = await requireAdminPage(["super_admin"]);
  const { interestId } = await params;
  if (!z.string().uuid().safeParse(interestId).success) notFound();
  const item = await getCommunityInterest(principal, interestId);
  if (!item) notFound();

  return (
    <main className="admin-community-detail">
      <Link className="text-link admin-back-link" href="/admin/community">
        <ArrowLeft size={18} aria-hidden="true" /> กลับรายการ Community
      </Link>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow eyebrow--dark">{item.referenceCode}</p>
          <h1>{item.fullName}</h1>
          <p>ลงทะเบียน {formatDateTime(item.createdAt)} · Customer ID {item.memberId}</p>
        </div>
        <span>{item.selectedSystemSizeKw ? `${item.selectedSystemSizeKw} kW` : "ยังไม่ระบุ kW"}</span>
      </header>

      <div className="admin-community-detail__grid">
        <section className="admin-community-card">
          <div className="admin-community-card__head"><UserRound size={20} /><h2>ข้อมูลลูกค้า</h2></div>
          <dl>
            <div><dt>ชื่อ-นามสกุล</dt><dd>{item.fullName}</dd></div>
            <div><dt>อีเมล</dt><dd><a href={`mailto:${item.email}`}>{item.email}</a></dd></div>
            <div><dt>โทรศัพท์</dt><dd>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : "ไม่มีข้อมูลเดิม"}</dd></div>
            <div><dt>Customer ID</dt><dd className="admin-mono">{item.memberId}</dd></div>
          </dl>
        </section>

        <section className="admin-community-card">
          <div className="admin-community-card__head"><MapPin size={20} /><h2>ความต้องการและสถานที่</h2></div>
          <dl>
            <div><dt>ขนาดที่สนใจ</dt><dd>{item.selectedSystemSizeKw ? `${item.selectedSystemSizeKw} kW` : "—"}</dd></div>
            <div><dt>ประเภทสถานที่</dt><dd>{propertyLabels[item.propertyType] ?? item.propertyType}</dd></div>
            <div><dt>ช่วงติดตั้ง</dt><dd>{windowLabels[item.installationWindow] ?? item.installationWindow}</dd></div>
            <div><dt>พื้นที่</dt><dd>{item.subdistrict}, {item.district}, {item.province} {item.postalCode}</dd></div>
            <div><dt>รัศมีจับคู่</dt><dd>{item.preferredRadiusKm} km</dd></div>
            {item.latitude !== null && item.longitude !== null ? (
              <div><dt>พิกัด</dt><dd>{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</dd></div>
            ) : null}
          </dl>
        </section>

        <section className="admin-community-card">
          <div className="admin-community-card__head"><Network size={20} /><h2>Referral</h2></div>
          <dl>
            <div><dt>Code ของลูกค้า</dt><dd className="admin-mono">{item.referralCode}</dd></div>
            <div><dt>แนะนำสำเร็จ</dt><dd>{item.referralCount} คน</dd></div>
            <div><dt>ที่มารายการนี้</dt><dd>{item.referredByCode ? `${item.referredByName ?? "สมาชิก"} · ${item.referredByCode}` : "สมัครโดยตรง"}</dd></div>
          </dl>
        </section>

        <section className="admin-community-card admin-community-card--action">
          <div className="admin-community-card__head"><Phone size={20} /><h2>ดำเนินการ</h2></div>
          <p>อัปเดตสถานะหลังตรวจสอบหรือติดต่อแล้ว ทุกการเปลี่ยนแปลงจะถูกบันทึกใน event log</p>
          <CommunityStatusForm currentStatus={item.status} interestId={item.id} />
        </section>
      </div>
    </main>
  );
}
