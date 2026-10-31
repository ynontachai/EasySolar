/* eslint-disable @next/next/no-img-element -- product images redirect to short-lived signed URLs that the image optimizer cannot follow */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CheckCircle2, Download, ImageIcon, Search } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { listPublishedCatalogItems } from "@/lib/server/datasheet-repository";

export const metadata: Metadata = {
  title: "Equipment Library",
  description: "คลัง PV Module และ Inverter พร้อม revision และแหล่งข้อมูล",
};

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; q?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const rawCategories = Array.isArray(params.category) ? params.category : params.category ? [params.category] : [];
  const categories = rawCategories.filter(
    (value): value is "inverter" | "pv_module" => value === "inverter" || value === "pv_module",
  );
  const publishedEquipment = await listPublishedCatalogItems({ categories, query: params.q });
  const demoEquipment = [
    ...demoPvModules.map((item) => ({
      category: "PV MODULE",
      downloadPath: null,
      id: item.id,
      imageAlt: null,
      imageAssetId: null,
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
      imageAlt: null,
      imageAssetId: null,
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
        imageAlt: item.imageAlt,
        imageAssetId: item.imageAssetId,
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
            : " แสดงเฉพาะรายการที่ตรวจสอบและ Publish แล้ว"}
        </p>
        <form className="catalog-search" action="/equipment" id="catalog-filter-form">
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="catalog-q">
            ค้นหาอุปกรณ์
          </label>
          <input
            id="catalog-q"
            name="q"
            placeholder="ค้นหา brand หรือ exact model…"
            type="search"
            defaultValue={params.q ?? ""}
          />
          <button type="submit">ค้นหา</button>
        </form>
      </section>

      <section className="catalog-shell">
        <aside className="catalog-filters">
          <strong>FILTERS</strong>
          <label>
            <input defaultChecked={!categories.length || categories.includes("pv_module")} form="catalog-filter-form" name="category" type="checkbox" value="pv_module" /> PV Module
          </label>
          <label>
            <input defaultChecked={!categories.length || categories.includes("inverter")} form="catalog-filter-form" name="category" type="checkbox" value="inverter" /> Inverter
          </label>
          <span>Verification</span>
          <p className="catalog-verified-only"><CheckCircle2 size={14} /> Published only</p>
          <button form="catalog-filter-form" type="submit">ใช้ตัวกรอง</button>
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
          <div className="equipment-grid">
          {equipment.map((item) => (
            <article className="equipment-card" key={item.id}>
              <div className="equipment-card__media">
                {item.imageAssetId ? (
                  <img alt={item.imageAlt ?? ""} src={`/api/v1/product-media/${item.imageAssetId}`} />
                ) : <ImageIcon aria-hidden="true" size={32} />}
                <span>{item.category}</span>
              </div>
              <div className="equipment-card__identity">
                <small>{item.category}</small>
                <p>{item.manufacturer}</p>
                <h2>{item.model}</h2>
              </div>
              <div className="equipment-card__spec">
                <strong>{item.primarySpec}</strong>
                <span>{item.secondarySpec}</span>
              </div>
              <div className="equipment-card__source">
                <span className="verification-badge">
                  <CheckCircle2 size={13} aria-hidden="true" /> PUBLISHED
                </span>
                <small>{item.datasheet.revisionLabel}</small>
                <p>{item.datasheet.sourceNote}</p>
              </div>
              <div className="equipment-card__actions">
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
                <Link href={`/checker?${item.category === "PV MODULE" ? "pvModuleId" : "inverterId"}=${item.id}`} aria-label={`เลือก ${item.model} ใน checker`}>
                  เลือกใน Checker <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            </article>
          ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
