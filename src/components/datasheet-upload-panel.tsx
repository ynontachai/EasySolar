"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  DATASHEET_MEDIA_TYPE,
  MAX_DATASHEET_SIZE_BYTES,
  type DatasheetRuntimeCapabilities,
} from "@/domain/assets/config";

interface UploadIntentResponse {
  assetId: string;
  uploadHeaders: Record<string, string>;
  uploadUrl: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

type UploadPhase = "idle" | "hashing" | "uploading" | "finalizing" | "success" | "error";

interface DatasheetUploadPanelProps {
  capabilities: DatasheetRuntimeCapabilities;
}

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function createFileChecksums(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const base64 = btoa(String.fromCharCode(...bytes));
  return { base64, hex };
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorResponse;
  if (!response.ok) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body;
}

export function DatasheetUploadPanel({ capabilities }: DatasheetUploadPanelProps) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("datasheet");
    const adminToken = String(formData.get("adminToken") ?? "");

    if (!(file instanceof File) || file.size === 0) {
      setPhase("error");
      setMessage("กรุณาเลือกไฟล์ PDF");
      return;
    }

    if (file.type !== DATASHEET_MEDIA_TYPE || !file.name.toLowerCase().endsWith(".pdf")) {
      setPhase("error");
      setMessage("รองรับเฉพาะไฟล์ PDF เท่านั้น");
      return;
    }

    if (file.size > MAX_DATASHEET_SIZE_BYTES) {
      setPhase("error");
      setMessage(`ไฟล์ต้องไม่เกิน ${formatMegabytes(MAX_DATASHEET_SIZE_BYTES)}`);
      return;
    }

    try {
      setPhase("hashing");
      const checksum = await createFileChecksums(file);
      const authorization = { Authorization: `Bearer ${adminToken}` };

      const intentResponse = await fetch("/api/v1/admin/datasheets/upload-intents", {
        body: JSON.stringify({
          category: formData.get("category"),
          exactModel: formData.get("exactModel"),
          filename: file.name,
          language: formData.get("language"),
          manufacturer: formData.get("manufacturer"),
          market: formData.get("market"),
          mediaType: file.type,
          revisionLabel: formData.get("revisionLabel"),
          sha256Base64: checksum.base64,
          sha256Hex: checksum.hex,
          sizeBytes: file.size,
        }),
        headers: { "content-type": "application/json", ...authorization },
        method: "POST",
      });
      const intent = await readApiResponse<UploadIntentResponse>(intentResponse);

      setPhase("uploading");
      const uploadResponse = await fetch(intent.uploadUrl, {
        body: file,
        headers: intent.uploadHeaders,
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        throw new Error(`Object storage ปฏิเสธการอัปโหลด (${uploadResponse.status})`);
      }

      setPhase("finalizing");
      const finalizeResponse = await fetch(
        `/api/v1/admin/datasheets/${intent.assetId}/finalize`,
        { headers: authorization, method: "POST" },
      );
      const finalized = await readApiResponse<{ message: string; state: string }>(
        finalizeResponse,
      );

      setPhase("success");
      setMessage(`${finalized.message} · สถานะ ${finalized.state}`);
      form.reset();
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    }
  }

  const isBusy = phase === "hashing" || phase === "uploading" || phase === "finalizing";
  const phaseLabel = {
    error: "ต้องแก้ไขก่อนลองใหม่",
    finalizing: "กำลังตรวจไฟล์ใน Object Storage…",
    hashing: "กำลังคำนวณ SHA-256…",
    idle: "พร้อมรับ Datasheet",
    success: "รับไฟล์เรียบร้อย",
    uploading: "กำลังอัปโหลดไฟล์…",
  }[phase];

  return (
    <section className="datasheet-intake" aria-labelledby="datasheet-intake-title">
      <div className="datasheet-intake__head">
        <div>
          <p className="eyebrow eyebrow--dark">DATASHEET INTAKE</p>
          <h2 id="datasheet-intake-title">สร้าง Revision และอัปโหลด PDF</h2>
          <p>
            ไฟล์จะถูกเก็บแบบ private และยัง publish ไม่ได้จนกว่าจะผ่าน scan
            กับ field verification
          </p>
        </div>
        <span className={`intake-state intake-state--${capabilities.ready ? "ready" : "blocked"}`}>
          {capabilities.ready ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          {capabilities.ready ? "RUNTIME READY" : "CONFIG REQUIRED"}
        </span>
      </div>

      {!capabilities.ready ? (
        <div className="intake-config" role="status">
          <strong>ยังเปิด Upload ไม่ได้</strong>
          <p>ตั้งค่า environment ที่ขาดก่อนเริ่มใช้งาน:</p>
          <ul>
            {!capabilities.database ? <li>DATABASE_URL</li> : null}
            {!capabilities.storage ? <li>S3_BUCKET และ S3_REGION</li> : null}
            {!capabilities.adminAuth ? <li>EASYSOLAR_ADMIN_TOKEN</li> : null}
          </ul>
        </div>
      ) : (
        <form className="datasheet-intake__form" onSubmit={handleSubmit}>
          <label>
            <span>ผู้ผลิต</span>
            <input name="manufacturer" placeholder="เช่น LONGi" required />
          </label>
          <label>
            <span>Exact model</span>
            <input name="exactModel" placeholder="รหัสรุ่นตาม Datasheet" required />
          </label>
          <label>
            <span>ประเภทอุปกรณ์</span>
            <select defaultValue="pv_module" name="category">
              <option value="pv_module">PV Module</option>
              <option value="inverter">Inverter</option>
            </select>
          </label>
          <label>
            <span>Market</span>
            <input defaultValue="TH" maxLength={16} name="market" required />
          </label>
          <label>
            <span>Revision label</span>
            <input name="revisionLabel" placeholder="เช่น Rev. 2026-01" required />
          </label>
          <label>
            <span>ภาษา</span>
            <select defaultValue="th" name="language">
              <option value="th">ไทย</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="datasheet-intake__file">
            <span>Official Datasheet PDF</span>
            <input
              accept="application/pdf,.pdf"
              name="datasheet"
              required
              type="file"
            />
            <small>PDF เท่านั้น · ไม่เกิน {formatMegabytes(MAX_DATASHEET_SIZE_BYTES)}</small>
          </label>
          <label className="datasheet-intake__token">
            <span>Admin upload token</span>
            <input autoComplete="off" name="adminToken" required type="password" />
            <small>ใช้ยืนยัน request เท่านั้น ระบบไม่จัดเก็บ token ใน browser</small>
          </label>
          <div className="datasheet-intake__action">
            <div aria-live="polite">
              {phase === "success" ? <CheckCircle2 size={17} /> : null}
              {phase === "error" ? <AlertTriangle size={17} /> : null}
              {isBusy ? <LoaderCircle className="spin" size={17} /> : null}
              <span>{message || phaseLabel}</span>
            </div>
            <button className="button button--ink" disabled={isBusy} type="submit">
              <FileUp size={17} aria-hidden="true" />
              {isBusy ? "กำลังดำเนินการ" : "สร้าง Draft และอัปโหลด"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
