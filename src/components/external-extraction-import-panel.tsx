"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson2,
  FileUp,
  LoaderCircle,
} from "lucide-react";
import {
  DATASHEET_MEDIA_TYPE,
  MAX_DATASHEET_SIZE_BYTES,
  type DatasheetRuntimeCapabilities,
} from "@/domain/assets/config";
import {
  extractedSpecSchema,
  MAX_EXTRACTION_JSON_SIZE_BYTES,
  type ExtractedSpec,
} from "@/domain/catalog/extraction-schema";
import type {
  ExtractedImportPreflightResult,
  ImportPreflightModelStatus,
} from "@/domain/catalog/import-preflight";
import { ThemeSelect } from "@/components/theme-select";

interface UploadIntentResponse {
  assetId: string;
  importId: string;
  revisions: Array<{ exactModel: string; revisionId: string }>;
  uploadHeaders: Record<string, string>;
  uploadUrl: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
}

type ImportPhase =
  | "idle"
  | "validating"
  | "hashing"
  | "creating"
  | "uploading"
  | "finalizing"
  | "success"
  | "error";

interface ExternalExtractionImportPanelProps {
  capabilities: DatasheetRuntimeCapabilities;
}

const preflightStatusLabels: Record<ImportPreflightModelStatus, string> = {
  CATEGORY_CONFLICT: "ประเภทขัดแย้ง",
  NEW_MODEL: "เพิ่ม Model",
  NEW_REVISION: "เพิ่ม Revision",
  REVISION_EXISTS: "Revision ซ้ำ",
};

export function ImportPreflightPreview({
  preflight,
}: {
  preflight: ExtractedImportPreflightResult;
}) {
  return (
    <section
      aria-labelledby="preflight-title"
      className={`extraction-preflight extraction-preflight--${preflight.canImport ? "ready" : "blocked"}`}
    >
      <div className="extraction-preflight__head">
        <div>
          <p className="eyebrow eyebrow--dark">IMPORT PREFLIGHT</p>
          <h3 id="preflight-title">ผลตรวจก่อนสร้าง Draft</h3>
          <p>
            Manufacturer: <strong>{preflight.manufacturer.matchedName ?? preflight.manufacturer.inputName}</strong>
            {preflight.manufacturer.status === "EXISTING" ? " · ใช้รายการเดิม" : " · จะสร้างใหม่"}
          </p>
        </div>
        <span className={`preflight-state preflight-state--${preflight.canImport ? "ready" : "blocked"}`}>
          {preflight.canImport ? "พร้อมนำเข้า" : `ติดปัญหา ${preflight.summary.blocked} รายการ`}
        </span>
      </div>
      <dl className="extraction-preflight__summary">
        <div><dt>เพิ่ม Model</dt><dd>{preflight.summary.newModels}</dd></div>
        <div><dt>เพิ่ม Revision</dt><dd>{preflight.summary.newRevisions}</dd></div>
        <div><dt>ต้องแก้ไข</dt><dd>{preflight.summary.blocked}</dd></div>
      </dl>
      <ul className="extraction-preflight__models">
        {preflight.models.map((model) => (
          <li key={model.exactModel}>
            <div>
              <strong>{model.exactModel}</strong>
              <small>{model.message}</small>
            </div>
            <span className={`preflight-model-state preflight-model-state--${model.status.toLowerCase()}`}>
              {preflightStatusLabels[model.status]}
            </span>
          </li>
        ))}
      </ul>
      <p className="extraction-preflight__note">
        ระบบจะตรวจซ้ำอีกครั้งตอนสร้าง Draft เพื่อป้องกันข้อมูลเปลี่ยนระหว่างการตรวจ
      </p>
    </section>
  );
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
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

async function uploadPdf(intent: UploadIntentResponse, pdf: File) {
  try {
    const response = await fetch(intent.uploadUrl, {
      body: pdf,
      headers: intent.uploadHeaders,
      method: "PUT",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        message?: string;
      };
      const storageError = body.code || body.error || body.message || "";
      if (
        (response.status === 400 || response.status === 409) &&
        /already exists|keyalreadyexists/i.test(storageError)
      ) {
        return;
      }
      throw new Error(`Storage ปฏิเสธการอัปโหลด (${response.status})`);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "เชื่อมต่อ Object Storage ไม่สำเร็จ กรุณาตรวจ Storage URL/CORS แล้วลองใหม่",
      );
    }
    throw error;
  }
}

async function readExtractionFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".json")) {
    throw new Error("ผลลัพธ์จาก GPT ต้องเป็นไฟล์ .json");
  }
  if (file.size > MAX_EXTRACTION_JSON_SIZE_BYTES) {
    throw new Error("ไฟล์ JSON ต้องไม่เกิน 1 MB");
  }

  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("เปิดไฟล์ JSON ไม่ได้ กรุณาให้ GPT ส่ง valid JSON โดยไม่มี Markdown");
  }

  const parsed = extractedSpecSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const location = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    throw new Error(`${issue?.message ?? "JSON ไม่ตรงกับ EasySolar template"}${location}`);
  }
  return parsed.data;
}

function countAttentionFields(extraction: ExtractedSpec) {
  return extraction.models.reduce((total, model) => {
    const fields = [...Object.values(model.fields), ...model.trackers.flatMap((tracker) => Object.values(tracker.fields))];
    return total + fields.filter((field) =>
      field.status === "ambiguous" ||
      field.status === "conflict" ||
      field.status === "not_found"
    ).length;
  }, 0);
}

export function ExternalExtractionImportPanel({
  capabilities,
}: ExternalExtractionImportPanelProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ExtractedSpec | null>(null);
  const [preflight, setPreflight] = useState<ExtractedImportPreflightResult | null>(null);
  const [preflightError, setPreflightError] = useState("");
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [market, setMarket] = useState("TH");
  const [language, setLanguage] = useState("en");
  const latestPreflightRequest = useRef(0);

  function clearPreflight() {
    latestPreflightRequest.current += 1;
    setPreflight(null);
    setPreflightError("");
    setIsPreflighting(false);
  }

  async function handleJsonChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    clearPreflight();
    setMessage("");
    if (!file) return;

    setPhase("validating");
    try {
      const extraction = await readExtractionFile(file);
      setPreview(extraction);
      setPhase("idle");
      setMessage(`JSON ถูกต้อง · พบ ${extraction.detected_model_count} Models`);
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "ตรวจ JSON ไม่สำเร็จ");
    }
  }

  async function handlePreflight() {
    if (!preview) return;
    if (!revisionLabel.trim()) {
      setPreflightError("กรุณาระบุ Revision label ก่อนตรวจรายการ");
      return;
    }
    if (market.trim().length < 2) {
      setPreflightError("กรุณาระบุ Market อย่างน้อย 2 ตัวอักษร");
      return;
    }

    const requestId = ++latestPreflightRequest.current;
    setIsPreflighting(true);
    setPreflightError("");
    setMessage("");
    try {
      const response = await fetch(
        "/api/v1/admin/datasheets/extracted-imports/preflight",
        {
          body: JSON.stringify({ extraction: preview, market, revisionLabel }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const result = await readApiResponse<ExtractedImportPreflightResult>(response);
      if (requestId === latestPreflightRequest.current) {
        setPreflight(result);
        setPhase("idle");
      }
    } catch (error) {
      if (requestId === latestPreflightRequest.current) {
        setPreflight(null);
        setPreflightError(error instanceof Error ? error.message : "ตรวจรายการเดิมไม่สำเร็จ");
      }
    } finally {
      if (requestId === latestPreflightRequest.current) setIsPreflighting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const pdf = formData.get("datasheet");
    const json = formData.get("extractionJson");
    if (!preflight) {
      setPhase("error");
      setMessage("กรุณากดตรวจรายการเดิมก่อนสร้าง Draft");
      return;
    }
    if (!preflight.canImport) {
      setPhase("error");
      setMessage("ยังสร้าง Draft ไม่ได้ กรุณาแก้รายการที่ซ้ำหรือขัดแย้งก่อน");
      return;
    }
    if (!(pdf instanceof File) || pdf.size === 0) {
      setPhase("error");
      setMessage("กรุณาเลือก Datasheet PDF ต้นฉบับ");
      return;
    }
    if (!(json instanceof File) || json.size === 0) {
      setPhase("error");
      setMessage("กรุณาเลือก JSON ผลลัพธ์จาก EasySolar Prompt");
      return;
    }
    if (pdf.type !== DATASHEET_MEDIA_TYPE || !pdf.name.toLowerCase().endsWith(".pdf")) {
      setPhase("error");
      setMessage("Datasheet ต้องเป็น PDF เท่านั้น");
      return;
    }
    if (pdf.size > MAX_DATASHEET_SIZE_BYTES) {
      setPhase("error");
      setMessage(`PDF ต้องไม่เกิน ${formatMegabytes(MAX_DATASHEET_SIZE_BYTES)}`);
      return;
    }

    try {
      setPhase("validating");
      const extraction = await readExtractionFile(json);
      if (extraction.source_document.filename !== pdf.name) {
        throw new Error(
          `PDF ไม่ตรงกับ JSON: JSON ระบุ ${extraction.source_document.filename}`,
        );
      }

      setPhase("hashing");
      const checksum = await createFileChecksums(pdf);
      setPhase("creating");
      const intentResponse = await fetch(
        "/api/v1/admin/datasheets/extracted-imports/upload-intents",
        {
          body: JSON.stringify({
            extraction,
            filename: pdf.name,
            language: formData.get("language"),
            market: formData.get("market"),
            mediaType: pdf.type,
            revisionLabel: formData.get("revisionLabel"),
            sha256Base64: checksum.base64,
            sha256Hex: checksum.hex,
            sizeBytes: pdf.size,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const intent = await readApiResponse<UploadIntentResponse>(intentResponse);

      setPhase("uploading");
      await uploadPdf(intent, pdf);

      setPhase("finalizing");
      const finalizeResponse = await fetch(
        `/api/v1/admin/datasheets/${intent.assetId}/finalize`,
        { method: "POST" },
      );
      await readApiResponse<{ message: string; state: string }>(finalizeResponse);

      setPhase("success");
      setMessage(
        `สร้าง Draft ${intent.revisions.length} Models แล้ว · เปิดแต่ละรายการในคิวเพื่อตรวจและบันทึกสเปก`,
      );
      setPreview(null);
      setPreflight(null);
      setRevisionLabel("");
      setMarket("TH");
      form.reset();
      setLanguage("en");
      router.refresh();
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ");
    }
  }

  const isBusy = ["validating", "hashing", "creating", "uploading", "finalizing"].includes(phase);
  const phaseLabel = {
    creating: "กำลังสร้าง Draft Models…",
    error: "ต้องแก้ไขก่อนลองใหม่",
    finalizing: "กำลังตรวจไฟล์ใน Object Storage…",
    hashing: "กำลังคำนวณ SHA-256…",
    idle: "รอ PDF และ JSON ที่สร้างจาก EasySolar Prompt",
    success: "นำเข้าสำเร็จ",
    uploading: "กำลังอัปโหลด PDF…",
    validating: "กำลังตรวจ JSON…",
  }[phase];

  return (
    <section className="datasheet-intake extraction-intake" aria-labelledby="extraction-intake-title">
      <div className="datasheet-intake__head">
        <div>
          <p className="eyebrow eyebrow--dark">EXTERNAL AI EXTRACTION</p>
          <h2 id="extraction-intake-title">นำเข้า PDF หลาย Model จาก JSON</h2>
          <p>
            ใช้ Prompt และ Template กลางกับ ChatGPT ภายนอก แล้วนำ PDF ต้นฉบับกับ JSON
            ผลลัพธ์กลับมาตรวจใน EasySolar ระบบจะสร้างเฉพาะ Draft และไม่ Publish อัตโนมัติ
          </p>
        </div>
        <span className={`intake-state intake-state--${capabilities.ready ? "ready" : "blocked"}`}>
          {capabilities.ready ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {capabilities.ready ? "MANUAL GPT READY" : "CONFIG REQUIRED"}
        </span>
      </div>

      <div className="extraction-downloads" aria-label="ไฟล์กลางสำหรับใช้งานกับ ChatGPT">
        <a download href="/easysolar-extraction/easysolar-extraction-prompt-v1.txt">
          <Download size={16} aria-hidden="true" /> Prompt v1.1
        </a>
        <a download href="/easysolar-extraction/easysolar-pv-module-extraction-v1.json">
          <Download size={16} aria-hidden="true" /> PV Template v1.1
        </a>
        <a download href="/easysolar-extraction/easysolar-inverter-extraction-v1.json">
          <Download size={16} aria-hidden="true" /> Inverter Template v1.1
        </a>
      </div>

      {!capabilities.ready ? (
        <div className="intake-config" role="status">
          <strong>ยังเปิด Import ไม่ได้</strong>
          <p>ตั้งค่า Database, Object Storage และ Admin Auth ก่อนเริ่มใช้งาน</p>
        </div>
      ) : (
        <form className="datasheet-intake__form" onSubmit={handleSubmit}>
          <label>
            <span>Revision label</span>
            <input
              name="revisionLabel"
              onChange={(event) => {
                setRevisionLabel(event.target.value);
                clearPreflight();
              }}
              placeholder="เช่น Rev. 2026-11"
              required
              value={revisionLabel}
            />
          </label>
          <label>
            <span>Market</span>
            <input
              maxLength={16}
              name="market"
              onChange={(event) => {
                setMarket(event.target.value);
                clearPreflight();
              }}
              required
              value={market}
            />
          </label>
          <div className="datasheet-intake__field">
            <span>ภาษาใน Datasheet</span>
            <ThemeSelect
              name="language"
              onValueChange={setLanguage}
              options={[
                { label: "English", value: "en" },
                { label: "ไทย", value: "th" },
              ]}
              value={language}
            />
          </div>
          <div className="extraction-guidance">
            <strong>ก่อนอัปโหลด</strong>
            <span>ชื่อ PDF ต้องตรงกับ source_document.filename ใน JSON ทุกตัวอักษร</span>
          </div>
          <label className="datasheet-intake__file">
            <span>1. Datasheet PDF ต้นฉบับ</span>
            <input accept="application/pdf,.pdf" name="datasheet" required type="file" />
            <small>PDF เท่านั้น · ไม่เกิน {formatMegabytes(MAX_DATASHEET_SIZE_BYTES)}</small>
          </label>
          <label className="datasheet-intake__file">
            <span>2. JSON ผลลัพธ์จาก EasySolar Prompt</span>
            <input accept="application/json,.json" name="extractionJson" onChange={handleJsonChange} required type="file" />
            <small>JSON เท่านั้น · Template และ Prompt version 1.1 · ไม่เกิน 1 MB</small>
          </label>

          {preview ? (
            <div className="extraction-preview" aria-live="polite">
              <div>
                <FileJson2 size={19} aria-hidden="true" />
                <span>
                  <strong>{preview.manufacturer.value}</strong>
                  <small>{preview.template_id} · {preview.source_document.page_count} หน้า</small>
                </span>
              </div>
              <dl>
                <div><dt>Models</dt><dd>{preview.detected_model_count}</dd></div>
                <div><dt>ต้องตรวจ</dt><dd>{countAttentionFields(preview)}</dd></div>
                <div><dt>คำเตือน</dt><dd>{preview.document_warnings.length}</dd></div>
              </dl>
              <p>{preview.models.map((model) => model.exact_model).join(" · ")}</p>
              <div className="extraction-preview__action">
                <span>ตรวจ Manufacturer, Model และ Revision กับฐานข้อมูลก่อนสร้าง Draft</span>
                <button
                  className="button button--outline"
                  disabled={isPreflighting}
                  onClick={() => void handlePreflight()}
                  type="button"
                >
                  {isPreflighting ? "กำลังตรวจ…" : "ตรวจรายการเดิม"}
                </button>
              </div>
            </div>
          ) : null}

          {preflightError ? (
            <p className="extraction-preflight__error" role="alert">{preflightError}</p>
          ) : null}

          {preflight ? <ImportPreflightPreview preflight={preflight} /> : null}

          <div className="datasheet-intake__action">
            <div aria-live="polite">
              {phase === "success" ? <CheckCircle2 size={17} /> : null}
              {phase === "error" ? <AlertTriangle size={17} /> : null}
              {isBusy ? <LoaderCircle className="spin" size={17} /> : null}
              <span>{message || phaseLabel}</span>
            </div>
            <button
              className="button button--ink"
              disabled={isBusy || isPreflighting || !preview || !preflight?.canImport}
              type="submit"
            >
              <FileUp size={17} aria-hidden="true" />
              {isBusy ? "กำลังดำเนินการ" : `สร้าง Draft ${preview?.detected_model_count ?? ""} Models`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
