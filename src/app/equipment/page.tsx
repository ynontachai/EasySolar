import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Download,
  Search,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { listPublishedCatalogItems } from "@/lib/server/datasheet-repository";

export const metadata: Metadata = {
  title: "Equipment Library",
  description: "คลัง PV Module และ Inverter พร้อม revision และแหล่งข้อมูล",
};

export default async function EquipmentPage() {
  await connection();
  const publishedEquipment = await listPublishedCatalogItems();
  const demoEquipment = [
    ...demoPvModules.map((item) => ({
      category: "PV MODULE",
      downloadPath: null,
      id: item.id,
      manufacturer: item.manufacturer,
      model: item.model,
      primarySpec: `${item.pmaxWp} Wp`,
      secondarySpec: `${item.vocV} Voc · ${item.vmpV} Vmp`,
      datasheet: item.datasheet,
      verificationStatus: "unverified" as const,
    })),
    ...demoInverters.map((item) => ({
      category: "INVERTER",
      downloadPath: null,
      id: item.id,
      manufacturer: item.manufacturer,
      model: item.model,
      primarySpec: `${item.ratedAcKw} kW`,
      secondarySpec: `${item.trackers.length} MPPT · ${item.maxDcVoltageV} Vdc max`,
      datasheet: item.datasheet,
      verificationStatus: "unverified" as const,
    })),
  ];
  const isDemoMode = publishedEquipment === null;
  const equipment = isDemoMode
    ? demoEquipment
    : publishedEquipment.map((item) => ({
        category: item.category === "pv_module" ? "PV MODULE" : "INVERTER",
        datasheet: {
          revisionLabel: item.revisionLabel,
          sourceNote:
            item.assetState === "available"
              ? "Official Datasheet พร้อมดาวน์โหลด"
              : `ไฟล์อยู่ในสถานะ ${item.assetState ?? "missing"}`,
        },
        downloadPath: item.downloadPath,
        id: item.id,
        manufacturer: item.manufacturer,
        model: item.exactModel,
        primarySpec: item.primarySpec,
        secondarySpec: item.secondarySpec,
        verificationStatus: item.verificationStatus,
      }));

  return (
    <main>
      <SiteHeader />
      <section className="library-head">
        <p className="eyebrow eyebrow--dark">SOURCE-AWARE CATALOG</p>
        <h1>Equipment Library</h1>
        <p>
          ค้นหาด้วย exact model และตรวจ revision ก่อนใช้ทุกครั้ง
          {isDemoMode
            ? " รายการใน scaffold นี้เป็นข้อมูล demo เพราะยังไม่ได้ตั้งค่า Database"
            : " แสดงเฉพาะรายการที่ผ่าน verification หรือ publish แล้ว"}
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
            <span>{isDemoMode ? "Source · demo scaffold" : "Source · PostgreSQL catalog"}</span>
          </div>
          {!isDemoMode && equipment.length === 0 ? (
            <div className="catalog-empty">
              ยังไม่มีอุปกรณ์ที่ผ่านการตรวจและ publish
            </div>
          ) : null}
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
                  {item.verificationStatus === "unverified" ? (
                    <CircleDashed size={13} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={13} aria-hidden="true" />
                  )}
                  {item.verificationStatus.toUpperCase()}
                </span>
                <small>{item.datasheet.revisionLabel}</small>
                <p>{item.datasheet.sourceNote}</p>
              </div>
              <div className="equipment-row__actions">
                {item.downloadPath ? (
                  <a
                    aria-label={`เปิด Datasheet ${item.model}`}
                    href={item.downloadPath}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Download aria-hidden="true" />
                  </a>
                ) : null}
                <Link href="/checker" aria-label={`เปิด ${item.model} ใน checker`}>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
