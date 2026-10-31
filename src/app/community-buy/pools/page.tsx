import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MIN_POOL_MEMBERS, PILOT_TENDER_HOUSEHOLDS, PILOT_TENDER_KWP, poolReadiness } from "@/domain/community/pools";
import { isDatabaseConfigured } from "@/lib/server/db";
import { listDemandPools } from "@/lib/server/community-pool-repository";

export const metadata: Metadata = {
  title: "Demand pool ตามจังหวัด · EasySolar",
  description: "ภาพรวมความต้องการติด Solar รวมตามจังหวัดสำหรับ EPC โดยไม่มีรายชื่อหรือรายละเอียดรายบ้าน",
};

const numberFormat = new Intl.NumberFormat("th-TH");

export default async function CommunityPoolsPage() {
  await connection();
  const pools = isDatabaseConfigured() ? await listDemandPools() : [];

  return (
    <main className="community-page">
      <SiteHeader />
      <section className="pool-hero">
        <p className="eyebrow eyebrow--dark">DEMAND POOL · สำหรับ EPC</p>
        <h1>ภาพรวมความต้องการ<br />ตามจังหวัด</h1>
        <p>
          แสดงจำนวนรวมของผู้สนใจในแต่ละ Pool เพื่อวางแผนทีมและ Package เท่านั้น
          ไม่มีรายชื่อ อีเมล เบอร์โทร อำเภอ ตำบล หรือพิกัดของผู้สนใจรายบ้าน
        </p>
        <p className="pool-hero__rule">
          <ShieldCheck size={16} aria-hidden="true" /> แสดงเฉพาะ Pool ที่มีผู้สนใจอย่างน้อย {MIN_POOL_MEMBERS} ราย
        </p>
      </section>

      <section className="pool-list" aria-labelledby="pool-list-title">
        <div className="pool-list__head">
          <h2 id="pool-list-title">Pool ที่เปิดให้ดูอยู่</h2>
          <span>{pools.length} จังหวัด</span>
        </div>

        {pools.length === 0 ? (
          <div className="pool-empty">
            <strong>ยังไม่มี Pool ที่ถึงขนาดแสดงผล</strong>
            <p>Pool จะปรากฏเมื่อมีผู้สนใจในจังหวัดเดียวกันอย่างน้อย {MIN_POOL_MEMBERS} ราย</p>
          </div>
        ) : (
          <ul className="pool-grid">
            {pools.map((pool) => {
              const readiness = poolReadiness(pool);
              return (
                <li className="pool-card" key={pool.province}>
                  <div className="pool-card__head">
                    <h3>{pool.province}</h3>
                    <span className="admin-status">{readiness.ready ? "ถึงเกณฑ์ Tender" : "กำลังรวมกลุ่ม"}</span>
                  </div>
                  <dl className="pool-card__stats">
                    <div>
                      <dt>ผู้สนใจ</dt>
                      <dd>{numberFormat.format(pool.interestedCount)} ราย</dd>
                    </div>
                    <div>
                      <dt>ครัวเรือนที่พร้อม</dt>
                      <dd>{numberFormat.format(pool.qualifiedHouseholdCount)} ราย</dd>
                    </div>
                    <div>
                      <dt>กำลังการผลิตรวม</dt>
                      <dd>{numberFormat.format(Math.round(pool.estimatedKwp))} kWp</dd>
                    </div>
                  </dl>
                  <div
                    aria-label={`ความคืบหน้าไปยังเกณฑ์ของ ${pool.province}`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={readiness.percent}
                    className="pool-card__bar"
                    role="progressbar"
                  >
                    <span style={{ width: `${readiness.percent}%` }} />
                  </div>
                  <p className="pool-card__note">
                    เกณฑ์นำร่อง {PILOT_TENDER_HOUSEHOLDS} ครัวเรือน หรือ {PILOT_TENDER_KWP} kWp ({readiness.percent}%)
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pool-next">
        <div>
          <p className="eyebrow eyebrow--dark">NEXT</p>
          <h2>ต้องการเข้าร่วมการคัดเลือก EPC?</h2>
          <p>รายละเอียดการคัดเลือก เงื่อนไข และช่องทางรับ Demand สำหรับ EPC จะเปิดในขั้นถัดไป</p>
        </div>
        <Link className="button button--outline" href="/equipment">
          เปิดคลังอุปกรณ์ <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
      <SiteFooter />
    </main>
  );
}
