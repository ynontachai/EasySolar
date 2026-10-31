import type { Metadata } from "next";
import { connection } from "next/server";
import { Boxes } from "lucide-react";
import { AdminSkuForm } from "@/components/admin-sku-form";
import { requireAdminPage } from "@/lib/server/admin-auth";
import {
  listCatalogProductOptions,
  listCatalogManufacturerOptions,
  listCatalogSkus,
  listOrganizationsForPrincipal,
} from "@/lib/server/catalog-admin-repository";

export const metadata: Metadata = { title: "Products and SKU" };

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

export default async function AdminCatalogPage() {
  await connection();
  const principal = await requireAdminPage(["account_admin", "reviewer", "super_admin"]);
  const [organizations, manufacturers, products, skus] = await Promise.all([
    listOrganizationsForPrincipal(principal),
    listCatalogManufacturerOptions(),
    listCatalogProductOptions(),
    listCatalogSkus(principal),
  ]);
  const canCreate = principal.roles.some(
    (role) => role.code === "account_admin" || role.code === "super_admin",
  );

  return (
    <main className="admin-catalog-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow eyebrow--dark">CATALOG · VARIANTS</p>
          <h1>สินค้าและ SKU</h1>
          <p>แยกรหัสขายออกจาก Datasheet เพื่อให้ข้อมูลราคาในอนาคตไม่เปลี่ยนผลวิศวกรรม</p>
        </div>
        <span>{skus.length} SKU</span>
      </header>

      {canCreate ? (
        <AdminSkuForm
          manufacturers={manufacturers}
          organizations={organizations}
          products={products}
        />
      ) : null}

      <section className="admin-sku-list" aria-labelledby="sku-list-title">
        <div className="admin-sku-list__head">
          <div><Boxes size={20} /><h2 id="sku-list-title">SKU ทั้งหมดในขอบเขตของคุณ</h2></div>
        </div>
        {skus.length === 0 ? (
          <div className="admin-sku-empty">
            <Boxes size={28} />
            <strong>ยังไม่มี SKU</strong>
            <p>{canCreate ? "ใช้แบบฟอร์มด้านบนเพื่อสร้าง Product identity และ SKU แรก" : "ยังไม่มีรายการให้ตรวจใน organization นี้"}</p>
          </div>
        ) : (
          <div className="admin-sku-table" role="table" aria-label="รายการ SKU">
            <div className="admin-sku-table__header" role="row">
              <span role="columnheader">สินค้า / SKU</span><span role="columnheader">Product Model</span><span role="columnheader">Organization</span><span role="columnheader">สถานะ</span><span role="columnheader">อัปเดต</span>
            </div>
            {skus.map((sku) => (
              <article className="admin-sku-row" key={sku.id} role="row">
                <div className="admin-sku-identity" role="cell">
                  <span className="admin-sku-thumb">
                    {sku.imageAssetId ? <img alt={sku.imageAlt ?? ""} src={`/api/v1/product-media/${sku.imageAssetId}`} /> : <Boxes aria-hidden="true" size={18} />}
                  </span>
                  <span><strong>{sku.sku}</strong><small>{sku.variantLabel}</small></span>
                </div>
                <div role="cell"><strong>{sku.manufacturer}</strong><small>{sku.exactModel} · {sku.category === "pv_module" ? "PV Module" : "Inverter"}</small></div>
                <span role="cell">{sku.organizationName}</span>
                <span className="admin-status" role="cell">{sku.status}</span>
                <time role="cell">{formatUpdatedAt(sku.updatedAt)}</time>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
