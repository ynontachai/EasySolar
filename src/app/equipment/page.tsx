import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleDashed, Search } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";

export const metadata: Metadata = {
  title: "Equipment Library",
  description: "คลัง PV Module และ Inverter พร้อม revision และแหล่งข้อมูล",
};

export default function EquipmentPage() {
  const equipment = [
    ...demoPvModules.map((item) => ({
      category: "PV MODULE",
      id: item.id,
      manufacturer: item.manufacturer,
      model: item.model,
      primarySpec: `${item.pmaxWp} Wp`,
      secondarySpec: `${item.vocV} Voc · ${item.vmpV} Vmp`,
      datasheet: item.datasheet,
    })),
    ...demoInverters.map((item) => ({
      category: "INVERTER",
      id: item.id,
      manufacturer: item.manufacturer,
      model: item.model,
      primarySpec: `${item.ratedAcKw} kW`,
      secondarySpec: `${item.trackers.length} MPPT · ${item.maxDcVoltageV} Vdc max`,
      datasheet: item.datasheet,
    })),
  ];

  return (
    <main>
      <SiteHeader />
      <section className="library-head">
        <p className="eyebrow eyebrow--dark">SOURCE-AWARE CATALOG</p>
        <h1>Equipment Library</h1>
        <p>
          ค้นหาด้วย exact model และตรวจ revision ก่อนใช้ทุกครั้ง
          รายการใน scaffold นี้เป็นข้อมูล demo ที่ยังไม่ผ่านการตรวจสอบ
        </p>
        <form className="catalog-search" action="/equipment">
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="catalog-q">
            ค้นหาอุปกรณ์
          </label>
          <input
            id="catalog-q"
            name="q"
            placeholder="ค้นหา brand หรือ exact model…"
            type="search"
          />
          <button type="submit">ค้นหา</button>
        </form>
      </section>

      <section className="catalog-shell">
        <aside className="catalog-filters">
          <strong>FILTERS</strong>
          <label>
            <input defaultChecked type="checkbox" /> PV Module
          </label>
          <label>
            <input defaultChecked type="checkbox" /> Inverter
          </label>
          <span>Verification</span>
          <label>
            <input defaultChecked type="checkbox" /> Unverified demo
          </label>
        </aside>
        <div className="catalog-list">
          <div className="catalog-list__head">
            <span>{equipment.length} records</span>
            <span>Last updated · scaffold data</span>
          </div>
          {equipment.map((item) => (
            <article className="equipment-row" key={item.id}>
              <div>
                <small>{item.category}</small>
                <p>{item.manufacturer}</p>
                <h2>{item.model}</h2>
              </div>
              <div className="equipment-row__spec">
                <strong>{item.primarySpec}</strong>
                <span>{item.secondarySpec}</span>
              </div>
              <div className="equipment-row__source">
                <span className="verification-badge">
                  <CircleDashed size={13} aria-hidden="true" />
                  UNVERIFIED
                </span>
                <small>{item.datasheet.revisionLabel}</small>
                <p>{item.datasheet.sourceNote}</p>
              </div>
              <Link href="/checker" aria-label={`เปิด ${item.model} ใน checker`}>
                <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
