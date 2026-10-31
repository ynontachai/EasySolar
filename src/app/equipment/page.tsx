/* eslint-disable @next/next/no-img-element -- product images redirect to short-lived signed URLs that the image optimizer cannot follow */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CheckCircle2, Download, Search } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { demoInverters, demoPvModules } from "@/data/demo-catalog";
import { listPublishedCatalogPage } from "@/lib/server/datasheet-repository";

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Equipment Library",
  description: "คลัง PV Module และ Inverter พร้อม revision และแหล่งข้อมูล",
};

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; page?: string; q?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const rawCategories = Array.isArray(params.category) ? params.category : params.category ? [params.category] : [];
  const categories = rawCategories.filter(
    (value): value is "inverter" | "pv_module" => value === "inverter" || value === "pv_module",
  );
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const offset = (page - 1) * PAGE_SIZE;
  const catalogPage = await listPublishedCatalogPage({
    categories,
    limit: PAGE_SIZE,
    offset,
    query: params.q,
  });
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
  const isDemoMode = catalogPage === null;
  const query = params.q?.trim().toLowerCase() ?? "";
  const matchesDemoFilters = (item: (typeof demoEquipment)[number]) => {
    const category = item.category === "PV MODULE" ? "pv_module" : "inverter";
    const text = `${item.manufacturer} ${item.model}`.toLowerCase();
    return (!categories.length || categories.includes(category)) && (!query || text.includes(query));
  };
  const demoMatches = demoEquipment.filter(matchesDemoFilters);
  const totalRecords = isDemoMode ? demoMatches.length : catalogPage.total;
  const equipment = isDemoMode
    ? demoMatches.slice(offset, offset + PAGE_SIZE)
    : catalogPage.items.map((item) => ({
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

  const pageCount = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const buildPageHref = (target: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    for (const category of categories) search.append("category", category);
    if (target > 1) search.set("page", String(target));
    const queryString = search.toString();
    return queryString ? `/equipment?${queryString}` : "/equipment";
  };

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
            <span>{totalRecords} records</span>
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
              <div className={item.imageAssetId ? "equipment-card__media" : "equipment-card__media equipment-card__media--empty"}>
                {item.imageAssetId ? (
                  <img alt={item.imageAlt ?? ""} src={`/api/v1/product-media/${item.imageAssetId}`} />
                ) : null}
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
                    className="equipment-card__download"
                    aria-label={`เปิด Datasheet ${item.model}`}
                    href={item.downloadPath}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Download aria-hidden="true" />
                  </a>
                ) : null}
                <Link className="equipment-card__checker" href={`/checker?${item.category === "PV MODULE" ? "pvModuleId" : "inverterId"}=${item.id}`} aria-label={`เลือก ${item.model} ใน checker`}>
                  เลือกใน Checker <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            </article>
          ))}
          </div>
          {pageCount > 1 ? (
            <nav aria-label="เลือกหน้ารายการ" className="catalog-pagination">
              {page > 1 ? (
                <Link href={buildPageHref(page - 1)} rel="prev">ก่อนหน้า</Link>
              ) : (
                <span aria-disabled="true">ก่อนหน้า</span>
              )}
              <span>หน้า {page} / {pageCount}</span>
              {page < pageCount ? (
                <Link href={buildPageHref(page + 1)} rel="next">ถัดไป</Link>
              ) : (
                <span aria-disabled="true">ถัดไป</span>
              )}
            </nav>
          ) : null}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
