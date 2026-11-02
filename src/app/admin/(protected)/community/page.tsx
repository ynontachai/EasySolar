import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Search, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/server/admin-auth";
import {
  communityInterestStatuses,
  listCommunityInterests,
  type CommunityInterestStatus,
} from "@/lib/server/community-admin-repository";

export const metadata: Metadata = { title: "Community customers" };

const statusLabels: Record<CommunityInterestStatus, string> = {
  active: "กำลังดำเนินการ",
  converted: "เป็นลูกค้าแล้ว",
  pending: "รอตรวจสอบ",
  withdrawn: "ยกเลิก",
};

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const principal = await requireAdminPage(["super_admin"]);
  const params = await searchParams;
  const query = singleParam(params.q)?.trim() ?? "";
  const rawStatus = singleParam(params.status);
  const status = communityInterestStatuses.find((value) => value === rawStatus);
  const interests = await listCommunityInterests(principal, { query, status });

  return (
    <main className="admin-community-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow eyebrow--dark">COMMUNITY · CUSTOMERS</p>
          <h1>ลูกค้า Community</h1>
          <p>ดูเจ้าของความต้องการ ขนาดระบบ พื้นที่ และที่มาของ Referral ใน flow เดียว</p>
        </div>
        <span>{interests.length} รายการ</span>
      </header>

      <form className="admin-community-filters">
        <label>
          <span className="sr-only">ค้นหาลูกค้า</span>
          <Search size={18} aria-hidden="true" />
          <input defaultValue={query} name="q" placeholder="ชื่อ อีเมล โทรศัพท์ หรือ Code" type="search" />
        </label>
        <label>
          <span className="sr-only">กรองตามสถานะ</span>
          <select defaultValue={status ?? ""} name="status">
            <option value="">ทุกสถานะ</option>
            {communityInterestStatuses.map((value) => (
              <option key={value} value={value}>{statusLabels[value]}</option>
            ))}
          </select>
        </label>
        <button className="button button--ink" type="submit">ค้นหา</button>
        {query || status ? <Link className="text-link" href="/admin/community">ล้างตัวกรอง</Link> : null}
      </form>

      <section className="admin-community-list" aria-labelledby="community-list-title">
        <div className="admin-community-list__head">
          <Users size={20} aria-hidden="true" />
          <h2 id="community-list-title">รายการความต้องการติดตั้ง</h2>
        </div>
        {interests.length === 0 ? (
          <div className="admin-sku-empty">
            <Users size={28} aria-hidden="true" />
            <strong>ไม่พบรายการ Community</strong>
            <p>{query || status ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "รายการใหม่จะปรากฏเมื่อมีผู้ลงทะเบียน"}</p>
          </div>
        ) : (
          <div className="admin-community-table" role="table" aria-label="รายการลูกค้า Community">
            <div className="admin-community-table__header" role="row">
              <span role="columnheader">ลูกค้า</span>
              <span role="columnheader">ความต้องการ</span>
              <span role="columnheader">Referral</span>
              <span role="columnheader">สถานะ</span>
              <span role="columnheader">ลงทะเบียน</span>
            </div>
            {interests.map((item) => (
              <Link className="admin-community-row" href={`/admin/community/${item.id}`} key={item.id} role="row">
                <div role="cell">
                  <strong>{item.fullName}</strong>
                  <small>{item.email}{item.phone ? ` · ${item.phone}` : ""}</small>
                </div>
                <div role="cell">
                  <strong>{item.selectedSystemSizeKw ? `${item.selectedSystemSizeKw} kW` : "ยังไม่ระบุ kW"}</strong>
                  <small>{item.district}, {item.province}</small>
                </div>
                <div role="cell">
                  <strong>{item.referralCode}</strong>
                  <small>{item.referredByCode ? `มาจาก ${item.referredByCode}` : "สมัครโดยตรง"}</small>
                </div>
                <span className="admin-status" data-status={item.status} role="cell">{statusLabels[item.status]}</span>
                <time role="cell" dateTime={item.createdAt.toISOString()}>{formatDate(item.createdAt)}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
