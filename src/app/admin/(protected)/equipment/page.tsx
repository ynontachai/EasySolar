import type { Metadata } from "next";
import { connection } from "next/server";
import { AlertCircle, CheckCircle2, FileText, History } from "lucide-react";
import { DatasheetUploadPanel } from "@/components/datasheet-upload-panel";
import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";

export const metadata: Metadata = { title: "Admin Verification" };

const fields = [
  ["Pmax", "550 Wp", "Page —"],
  ["Voc", "49.90 V", "Page —"],
  ["Vmp", "41.96 V", "Page —"],
  ["Isc", "13.98 A", "Page —"],
  ["βVoc", "−0.250 %/°C", "Page —"],
];

export default async function AdminEquipmentPage() {
  await connection();
  const capabilities = getDatasheetRuntimeCapabilities();

  return (
    <main className="admin-page">
      <div className="admin-bar">
        <div>
          <p className="eyebrow eyebrow--dark">CATALOG OPERATIONS</p>
          <h1>Verification queue</h1>
        </div>
        <span className="admin-mode">DATASHEET INTAKE · FOUNDATION</span>
      </div>
      <DatasheetUploadPanel capabilities={capabilities} />
      <div className="admin-workspace">
        <aside className="queue-panel">
          <strong>REVIEW QUEUE</strong>
          <button className="queue-item queue-item--active" type="button">
            <span>PV</span>
            <div><small>EasySolar Lab</small><b>DEMO-PV-550</b><em>Awaiting source</em></div>
          </button>
          <div className="queue-empty">ยังไม่มีข้อมูลจริงในคิว</div>
        </aside>
        <section className="review-panel">
          <div className="review-head">
            <div><small>DEMO-PV-550 · DEMO R1</small><h2>Field verification</h2></div>
            <span className="verification-badge"><AlertCircle size={13} /> SOURCE MISSING</span>
          </div>
          <div className="review-split">
            <div className="datasheet-placeholder">
              <FileText size={34} strokeWidth={1.3} />
              <strong>Official datasheet required</strong>
              <p>ระบบจริงต้องแสดง PDF/official source ข้างค่าที่ normalize และบันทึก page/section ต่อ field</p>
            </div>
            <div className="field-review-list">
              <div className="field-review-list__head"><span>NORMALIZED FIELD</span><span>VALUE</span><span>SOURCE</span></div>
              {fields.map(([label, value, source]) => (
                <div className="field-review-row" key={label}><strong>{label}</strong><span>{value}</span><span>{source}</span></div>
              ))}
              <div className="review-warning"><AlertCircle size={16} /> ห้าม publish จนกว่าจะมีแหล่งข้อมูลและผู้ตรวจที่รับผิดชอบ</div>
            </div>
          </div>
          <div className="review-actions">
            <span><History size={14} /> ไม่มี verification event</span>
            <button className="button button--outline" disabled type="button">Save draft</button>
            <button className="button button--ink" disabled type="button"><CheckCircle2 size={16} /> Publish revision</button>
          </div>
        </section>
      </div>
    </main>
  );
}
