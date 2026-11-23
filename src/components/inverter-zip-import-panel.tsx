"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileArchive,
  LoaderCircle,
  Upload,
} from "lucide-react";
import type { DatasheetRuntimeCapabilities } from "@/domain/assets/config";
import {
  extractInverterZip,
  type InverterZipEntry,
  type InverterZipType,
} from "@/domain/catalog/inverter-zip-import";
import { ThemeSelect } from "@/components/theme-select";

interface UploadIntentResponse {
  assetId: string;
  uploadHeaders: Record<string, string>;
  uploadUrl: string;
}

interface ApiErrorResponse {
  message?: string;
}

type ItemStatus = "ready" | "uploading" | "success" | "error";

interface PreparedInverter extends InverterZipEntry {
  error: string;
  status: ItemStatus;
}

interface InverterZipImportPanelProps {
  capabilities: DatasheetRuntimeCapabilities;
}

const inverterTypeLabels: Record<InverterZipType, string> = {
  hybrid: "Hybrid",
  string: "On Grid",
};

async function createFileChecksums(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const bytes = new Uint8Array(digest);
  return {
    base64: btoa(String.fromCharCode(...bytes)),
    hex: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorResponse;
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

export function InverterZipImportPanel({ capabilities }: InverterZipImportPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<PreparedInverter[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("เลือก ZIP ที่แยก PDF ไว้ในโฟลเดอร์ Hybrid และ On Grid");
  const [isReading, setIsReading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [manufacturer, setManufacturer] = useState("Solis");
  const [market, setMarket] = useState("TH");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [language, setLanguage] = useState("th");

  function updateItem(path: string, update: Partial<PreparedInverter>) {
    setItems((current) =>
      current.map((item) => item.path === path ? { ...item, ...update } : item),
    );
  }

  async function handleZipChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setItems([]);
    setWarnings([]);
    if (!file) return;

    setIsReading(true);
    setMessage("กำลังตรวจโครงสร้าง ZIP…");
    try {
      const result = await extractInverterZip(file);
      setItems(result.entries.map((entry) => ({ ...entry, error: "", status: "ready" })));
      setWarnings(result.warnings);
      const hybridCount = result.entries.filter((entry) => entry.inverterType === "hybrid").length;
      const onGridCount = result.entries.length - hybridCount;
      setMessage(`พบ ${result.entries.length} PDF · Hybrid ${hybridCount} · On Grid ${onGridCount}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปิด ZIP ไม่สำเร็จ");
    } finally {
      setIsReading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pendingItems = items.filter((item) => item.status !== "success");
    if (pendingItems.length === 0) return;

    const normalizedModels = pendingItems.map((item) => item.exactModel.trim().toLocaleLowerCase("en-US"));
    if (normalizedModels.some((model) => !model)) {
      setMessage("กรุณาระบุ Exact model ให้ครบทุกไฟล์");
      return;
    }
    if (new Set(normalizedModels).size !== normalizedModels.length) {
      setMessage("Exact model ในรายการต้องไม่ซ้ำกัน");
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of pendingItems) {
      updateItem(item.path, { error: "", status: "uploading" });
      try {
        const checksum = await createFileChecksums(item.file);
        const intentResponse = await fetch("/api/v1/admin/datasheets/upload-intents", {
          body: JSON.stringify({
            category: "inverter",
            exactModel: item.exactModel.trim(),
            filename: item.file.name,
            language,
            manufacturer: manufacturer.trim(),
            market: market.trim(),
            mediaType: item.file.type,
            revisionLabel: revisionLabel.trim(),
            sha256Base64: checksum.base64,
            sha256Hex: checksum.hex,
            sizeBytes: item.file.size,
            suggestedInverterType: item.inverterType,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const intent = await readApiResponse<UploadIntentResponse>(intentResponse);

        const uploadResponse = await fetch(intent.uploadUrl, {
          body: item.file,
          headers: intent.uploadHeaders,
          method: "PUT",
        });
        if (!uploadResponse.ok) {
          throw new Error(`Object storage ปฏิเสธไฟล์ (${uploadResponse.status})`);
        }

        const finalizeResponse = await fetch(
          `/api/v1/admin/datasheets/${intent.assetId}/finalize`,
          { method: "POST" },
        );
        await readApiResponse<{ state: string }>(finalizeResponse);
        updateItem(item.path, { status: "success" });
        successCount += 1;
      } catch (error) {
        updateItem(item.path, {
          error: error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ",
          status: "error",
        });
        errorCount += 1;
      }
    }

    setIsUploading(false);
    setMessage(
      errorCount === 0
        ? `สร้าง Draft สำเร็จ ${successCount} รายการ · กรุณาตรวจสเปกก่อน Publish`
        : `สำเร็จ ${successCount} · ต้องตรวจสอบ ${errorCount} รายการ`,
    );
    router.refresh();
  }

  const successfulCount = items.filter((item) => item.status === "success").length;

  return (
    <section className="datasheet-intake inverter-zip-intake" aria-labelledby="inverter-zip-title">
      <div className="datasheet-intake__head">
        <div>
          <p className="eyebrow eyebrow--dark">INVERTER ZIP INTAKE</p>
          <h2 id="inverter-zip-title">นำเข้า Inverter หลายรุ่นจาก ZIP</h2>
          <p>
            ระบบใช้ชื่อโฟลเดอร์เป็นข้อเสนอประเภท และชื่อ PDF เป็นข้อเสนอ Exact model
            ทุกไฟล์จะเป็น Draft จนกว่าจะตรวจค่าจาก Datasheet
          </p>
        </div>
        <span className={`intake-state intake-state--${capabilities.ready ? "ready" : "blocked"}`}>
          {capabilities.ready ? <Archive size={16} /> : <AlertTriangle size={16} />}
          {capabilities.ready ? "BATCH READY" : "CONFIG REQUIRED"}
        </span>
      </div>

      {!capabilities.ready ? (
        <div className="intake-config" role="status">
          <strong>ยังเปิด Import ไม่ได้</strong>
          <p>ตั้งค่า Database, Object Storage และ Admin Auth ก่อนเริ่มใช้งาน</p>
        </div>
      ) : (
        <form className="inverter-zip-form" onSubmit={handleSubmit}>
          <div className="inverter-zip-settings">
            <label>
              <span>Brand</span>
              <input onChange={(event) => setManufacturer(event.target.value)} required value={manufacturer} />
            </label>
            <label>
              <span>Market</span>
              <input maxLength={16} onChange={(event) => setMarket(event.target.value)} required value={market} />
            </label>
            <label>
              <span>Revision label</span>
              <input
                onChange={(event) => setRevisionLabel(event.target.value)}
                placeholder="เช่น TH 2026-11"
                required
                value={revisionLabel}
              />
            </label>
            <div className="datasheet-intake__field">
              <span>ภาษาใน Datasheet</span>
              <ThemeSelect
                onValueChange={setLanguage}
                options={[
                  { label: "ไทย", value: "th" },
                  { label: "English", value: "en" },
                ]}
                value={language}
              />
            </div>
          </div>

          <label className="inverter-zip-dropzone">
            <FileArchive aria-hidden="true" size={25} />
            <span>
              <strong>เลือก ZIP Folder</strong>
              <small>รองรับ PDF ไม่เกิน 50 ไฟล์ · ZIP ไม่เกิน 100 MB</small>
            </span>
            <input accept="application/zip,.zip" onChange={handleZipChange} type="file" />
          </label>

          <div className="inverter-zip-message" aria-live="polite">
            {isReading || isUploading ? <LoaderCircle className="spin" size={17} /> : null}
            <span>{message}</span>
          </div>

          {warnings.length > 0 ? (
            <ul className="inverter-zip-warnings" aria-label="คำเตือนจาก ZIP">
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}

          {items.length > 0 ? (
            <div className="inverter-zip-preview">
              <div className="inverter-zip-preview__head">
                <strong>ตรวจรายการก่อนสร้าง Draft</strong>
                <span>{successfulCount}/{items.length} สำเร็จ</span>
              </div>
              <div className="inverter-zip-list">
                {items.map((item) => (
                  <article className="inverter-zip-row" data-status={item.status} key={item.path}>
                    <div className="inverter-zip-row__type">
                      <span>{inverterTypeLabels[item.inverterType]}</span>
                      <small>{item.file.name}</small>
                    </div>
                    <label>
                      <span>Exact model</span>
                      <input
                        disabled={isUploading || item.status === "success"}
                        onChange={(event) => updateItem(item.path, { exactModel: event.target.value })}
                        required
                        value={item.exactModel}
                      />
                    </label>
                    <div className="inverter-zip-row__rating">
                      <span>Rated AC ที่คาดจากชื่อรุ่น</span>
                      <strong>{item.proposedRatedAcKw === null ? "ต้องตรวจใน PDF" : `${item.proposedRatedAcKw} kW`}</strong>
                    </div>
                    <div className="inverter-zip-row__status">
                      {item.status === "uploading" ? <LoaderCircle className="spin" size={17} /> : null}
                      {item.status === "success" ? <CheckCircle2 size={17} /> : null}
                      {item.status === "error" ? <AlertTriangle size={17} /> : null}
                      <span>{item.error || (item.status === "success" ? "สร้าง Draft แล้ว" : "พร้อมนำเข้า")}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="inverter-zip-actions">
            <p>Rated AC เป็นเพียงตัวช่วยอ่านชื่อรุ่น ค่าที่ Publish ต้องมาจาก PDF พร้อมหน้าอ้างอิง</p>
            <button
              className="button button--ink"
              disabled={isReading || isUploading || items.length === 0 || successfulCount === items.length}
              type="submit"
            >
              <Upload size={17} aria-hidden="true" />
              {isUploading ? "กำลังนำเข้า…" : `สร้าง Draft ${items.length - successfulCount} รายการ`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
