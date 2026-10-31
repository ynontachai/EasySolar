import type { Metadata } from "next";
import { connection } from "next/server";
import { ShieldAlert } from "lucide-react";
import { DatasheetUploadPanel } from "@/components/datasheet-upload-panel";
import { ReviewQueueItem } from "@/components/review-queue-item";
import { isDatabaseConfigured } from "@/lib/server/db";
import { requireAdminPage } from "@/lib/server/admin-auth";
import { listReviewQueue } from "@/lib/server/review-repository";
import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";

export const metadata: Metadata = { title: "Admin Verification" };

export default async function AdminEquipmentPage() {
  await connection();
  const principal = await requireAdminPage();
  const capabilities = getDatasheetRuntimeCapabilities();
  const canReview = principal.roles.some(
    (role) => role.code === "account_admin" || role.code === "reviewer" || role.code === "super_admin",
  );
  const canEnterSpec = principal.roles.some(
    (role) => role.code === "account_admin" || role.code === "super_admin",
  );
  const canDeleteDraft = canEnterSpec;
  const queue = canReview && isDatabaseConfigured() ? await listReviewQueue() : [];

  return (
    <main className="admin-page">
      <div className="admin-bar">
        <div>
          <p className="eyebrow eyebrow--dark">CATALOG OPERATIONS</p>
          <h1>Datasheet และการตรวจสอบ</h1>
        </div>
        <span className="admin-mode">{canReview ? "REVIEWER" : "INTAKE"}</span>
      </div>

      <DatasheetUploadPanel capabilities={capabilities} />

      <section className="review-queue" aria-labelledby="review-queue-title">
        <div className="review-queue__head">
          <h2 id="review-queue-title">คิวตรวจสอบ</h2>
          <span>{queue.length} รายการ</span>
        </div>

        {!canReview ? (
          <div className="admin-form-blocker" role="status">
            <ShieldAlert size={16} aria-hidden="true" /> เฉพาะ Reviewer หรือ Super Admin ที่ตรวจสอบและ Publish ได้
          </div>
        ) : queue.length === 0 ? (
          <div className="admin-sku-empty">
            <strong>ยังไม่มี revision ที่รอดำเนินการ</strong>
            <p>อัปโหลด Datasheet ด้านบนเพื่อเริ่ม revision ใหม่</p>
          </div>
        ) : (
          <div className="review-queue__list">
            {queue.map((row) => (
              <ReviewQueueItem
                canDeleteDraft={canDeleteDraft}
                canEnterSpec={canEnterSpec}
                key={row.revisionId}
                row={row}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
