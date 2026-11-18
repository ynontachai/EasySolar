import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CircleOff, SlidersHorizontal } from "lucide-react";
import { SpecActivationButton } from "@/components/spec-activation-button";
import { requireAdminPage } from "@/lib/server/admin-auth";
import {
  listCatalogSpecs,
  type CatalogSpecRow,
} from "@/lib/server/catalog-admin-repository";
import { updateSpecActivationAction } from "./actions";

export const metadata: Metadata = { title: "Spec Management" };

type Category = "inverter" | "pv_module";

const categoryLabels: Record<Category, string> = {
  inverter: "Inverter",
  pv_module: "Solar Panel",
};

function groupByManufacturer(rows: CatalogSpecRow[]) {
  const groups = new Map<string, { brandActive: boolean; manufacturer: string; rows: CatalogSpecRow[] }>();
  for (const row of rows) {
    const group = groups.get(row.manufacturerId);
    if (group) group.rows.push(row);
    else groups.set(row.manufacturerId, {
      brandActive: row.brandActive,
      manufacturer: row.manufacturer,
      rows: [row],
    });
  }
  return [...groups.entries()];
}

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

export default async function AdminSpecsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; result?: string }>;
}) {
  await connection();
  await requireAdminPage(["reviewer", "super_admin"]);
  const params = await searchParams;
  const category: Category = params.category === "pv_module" ? "pv_module" : "inverter";
  const rows = await listCatalogSpecs(category);
  const groups = groupByManufacturer(rows);
  const activeCount = rows.filter((row) => row.brandActive && row.modelActive).length;

  return (
    <main className="admin-specs-page">
      <header className="admin-page-header">
        <div>
          <p className="eyebrow eyebrow--dark">CATALOG · AVAILABILITY</p>
          <h1>Spec Management</h1>
          <p>ควบคุมรุ่นที่แสดงใน Equipment dropdown โดยไม่ลบ Datasheet หรือข้อมูลสเปก</p>
        </div>
        <span>{activeCount} / {rows.length} Active</span>
      </header>

      <nav className="admin-spec-tabs" aria-label="ประเภทสเปก">
        {(Object.keys(categoryLabels) as Category[]).map((value) => (
          <Link
            aria-current={category === value ? "page" : undefined}
            href={`/admin/specs?category=${value}`}
            key={value}
          >
            {categoryLabels[value]}
          </Link>
        ))}
      </nav>

      {params.result === "updated" ? (
        <p className="admin-spec-feedback" data-status="success" role="status">
          บันทึกสถานะแล้ว Dropdown และ sizing resolver ใช้สถานะใหม่ทันที
        </p>
      ) : null}
      {params.result === "error" ? (
        <p className="admin-spec-feedback" data-status="error" role="alert">
          บันทึกสถานะไม่สำเร็จ กรุณาลองอีกครั้งหรือตรวจสอบสิทธิ์ผู้ใช้
        </p>
      ) : null}

      {groups.length === 0 ? (
        <section className="admin-spec-empty">
          <CircleOff size={28} aria-hidden="true" />
          <h2>ยังไม่มี {categoryLabels[category]} ที่ Publish แล้ว</h2>
          <p>รายการจะปรากฏที่นี่หลังจาก Datasheet ผ่าน review และ Publish</p>
        </section>
      ) : (
        <div className="admin-spec-groups">
          {groups.map(([manufacturerId, group]) => {
            const modelFlagCount = group.rows.filter((row) => row.modelActive).length;
            const effectiveCount = group.brandActive ? modelFlagCount : 0;
            return (
              <section className="admin-spec-group" key={manufacturerId}>
                <header className="admin-spec-group__head">
                  <div>
                    <span className="admin-spec-group__icon"><SlidersHorizontal size={18} /></span>
                    <div>
                      <h2>{group.manufacturer}</h2>
                      <p>
                        {effectiveCount} / {group.rows.length} รุ่นแสดงใน Dropdown
                        {!group.brandActive && modelFlagCount > 0 ? " · เก็บสถานะแต่ละรุ่นไว้" : ""}
                      </p>
                    </div>
                  </div>
                  <form action={updateSpecActivationAction}>
                    <input name="category" type="hidden" value={category} />
                    <input name="isActive" type="hidden" value={String(!group.brandActive)} />
                    <input name="targetId" type="hidden" value={manufacturerId} />
                    <input name="targetType" type="hidden" value="brand" />
                    <SpecActivationButton active={group.brandActive} scope="brand" />
                  </form>
                </header>

                <div className="admin-spec-table-wrap">
                  <table className="admin-spec-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Published revision</th>
                        <th>Key spec</th>
                        <th>Dropdown status</th>
                        <th><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const effectivelyActive = group.brandActive && row.modelActive;
                        const status = !group.brandActive
                          ? "Inactive by brand"
                          : row.modelActive
                            ? "Active"
                            : "Inactive";
                        return (
                          <tr key={row.modelId}>
                            <td data-label="Model">
                              <strong>{row.exactModel}</strong>
                              <small>อัปเดต {formatUpdatedAt(row.updatedAt)}</small>
                            </td>
                            <td data-label="Published revision">{row.revisionLabel}</td>
                            <td data-label="Key spec">{row.specSummary}</td>
                            <td data-label="Dropdown status">
                              <span className="admin-spec-status" data-active={effectivelyActive}>
                                {status}
                              </span>
                            </td>
                            <td data-label="Action">
                              <form action={updateSpecActivationAction}>
                                <input name="category" type="hidden" value={category} />
                                <input name="isActive" type="hidden" value={String(!row.modelActive)} />
                                <input name="targetId" type="hidden" value={row.modelId} />
                                <input name="targetType" type="hidden" value="model" />
                                <SpecActivationButton active={row.modelActive} scope="model" />
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
