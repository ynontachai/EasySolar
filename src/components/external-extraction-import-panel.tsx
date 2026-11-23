"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  FileJson2,
  Files,
  LoaderCircle,
} from "lucide-react";
import {
  MAX_DATASHEET_SIZE_BYTES,
  type DatasheetRuntimeCapabilities,
} from "@/domain/assets/config";
import {
  extractedSpecSchema,
  MAX_EXTRACTION_JSON_SIZE_BYTES,
  type ExtractedSpec,
} from "@/domain/catalog/extraction-schema";
import {
  buildExtractionBatchPlan,
  MAX_EXTRACTION_BATCH_FILES,
  type ParsedExtractionBatchFile,
} from "@/domain/catalog/extraction-batch";
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

type BatchItemStatus =
  | "blocked"
  | "checking"
  | "error"
  | "importing"
  | "invalid"
  | "ready"
  | "success";

interface ExtractionBatchItem {
  error: string;
  excludedDuplicateModels: string[];
  extraction: ExtractedSpec | null;
  json: File | null;
  key: string;
  pairingError: string;
  pdf: File | null;
  preflight: ExtractedImportPreflightResult | null;
  status: BatchItemStatus;
}

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
    const sourceFilename = (
      value &&
      typeof value === "object" &&
      "source_document" in value &&
      value.source_document &&
      typeof value.source_document === "object" &&
      "filename" in value.source_document &&
      typeof value.source_document.filename === "string" &&
      value.source_document.filename.length <= 255
    ) ? value.source_document.filename : null;
    throw new ExtractionFileValidationError(
      `${issue?.message ?? "JSON ไม่ตรงกับ EasySolar template"}${location}`,
      sourceFilename,
    );
  }
  return parsed.data;
}

class ExtractionFileValidationError extends Error {
  constructor(message: string, readonly sourceFilename: string | null) {
    super(message);
  }
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
  const [items, setItems] = useState<ExtractionBatchItem[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [jsonFiles, setJsonFiles] = useState<File[]>([]);
  const [preflightError, setPreflightError] = useState("");
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [revisionLabel, setRevisionLabel] = useState("");
  const [market, setMarket] = useState("TH");
  const [language, setLanguage] = useState("en");
  const latestPreflightRequest = useRef(0);
  const latestPreparationRequest = useRef(0);

  function clearPreflight() {
    latestPreflightRequest.current += 1;
    setPreflightError("");
    setIsPreflighting(false);
    setItems((current) => current.map((item) => item.status === "success" ? item : {
      ...item,
      error: item.pairingError,
      preflight: null,
      status: item.pairingError ? "invalid" : "ready",
    }));
  }

  function updateItem(key: string, update: Partial<ExtractionBatchItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...update } : item));
  }

  async function prepareBatch(nextPdfs: File[], nextJsons: File[]) {
    const requestId = ++latestPreparationRequest.current;
    latestPreflightRequest.current += 1;
    setPreflightError("");
    setIsPreflighting(false);
    setMessage("");
    if (nextPdfs.length === 0 && nextJsons.length === 0) {
      setItems([]);
      setPhase("idle");
      return;
    }
    if (
      nextPdfs.length > MAX_EXTRACTION_BATCH_FILES ||
      nextJsons.length > MAX_EXTRACTION_BATCH_FILES
    ) {
      setItems([]);
      setPhase("error");
      setMessage(`เลือกได้ไม่เกิน ${MAX_EXTRACTION_BATCH_FILES} PDF และ ${MAX_EXTRACTION_BATCH_FILES} JSON ต่อครั้ง`);
      return;
    }

    setPhase("validating");
    const parsedJsons: ParsedExtractionBatchFile[] = await Promise.all(
      nextJsons.map(async (file) => {
        try {
          const extraction = await readExtractionFile(file);
          return {
            error: null,
            extraction,
            name: file.name,
            sourceFilename: extraction.source_document.filename,
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : "ตรวจ JSON ไม่สำเร็จ",
            extraction: null,
            name: file.name,
            sourceFilename: error instanceof ExtractionFileValidationError
              ? error.sourceFilename
              : null,
          };
        }
      }),
    );
    if (requestId !== latestPreparationRequest.current) return;

    const plan = buildExtractionBatchPlan({ jsonFiles: parsedJsons, pdfFiles: nextPdfs });
    const nextItems = plan.map((item): ExtractionBatchItem => {
      const pairingError = item.error ?? "";
      return {
        error: pairingError,
        excludedDuplicateModels: item.excludedDuplicateModels,
        extraction: item.extraction,
        json: item.jsonIndex === null ? null : (nextJsons[item.jsonIndex] ?? null),
        key: item.key,
        pairingError,
        pdf: item.pdfIndex === null ? null : (nextPdfs[item.pdfIndex] ?? null),
        preflight: null,
        status: pairingError ? "invalid" : "ready",
      };
    });
    const readyCount = nextItems.filter((item) => item.status === "ready").length;
    const invalidCount = nextItems.length - readyCount;
    setItems(nextItems);
    setPhase("idle");
    setMessage(
      invalidCount === 0
        ? `จับคู่พร้อมตรวจ ${readyCount} PDF`
        : `พร้อมตรวจ ${readyCount} PDF · ต้องแก้การจับคู่ ${invalidCount} รายการ`,
    );
  }

  function handlePdfChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPdfFiles(files);
    void prepareBatch(files, jsonFiles);
  }

  function handleJsonChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setJsonFiles(files);
    void prepareBatch(pdfFiles, files);
  }

  async function handlePreflight() {
    const candidates = items.filter(
      (item) => !item.pairingError && item.extraction && item.status !== "success",
    );
    if (candidates.length === 0) return;
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
    let readyCount = 0;
    let blockedCount = 0;
    for (const item of candidates) {
      if (requestId !== latestPreflightRequest.current || !item.extraction) break;
      updateItem(item.key, { error: "", preflight: null, status: "checking" });
      try {
        const response = await fetch(
          "/api/v1/admin/datasheets/extracted-imports/preflight",
          {
            body: JSON.stringify({ extraction: item.extraction, market, revisionLabel }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        );
        const result = await readApiResponse<ExtractedImportPreflightResult>(response);
        if (requestId !== latestPreflightRequest.current) break;
        updateItem(item.key, {
          error: result.canImport ? "" : `ติดปัญหา ${result.summary.blocked} Model`,
          preflight: result,
          status: result.canImport ? "ready" : "blocked",
        });
        if (result.canImport) readyCount += 1;
        else blockedCount += 1;
      } catch (error) {
        if (requestId !== latestPreflightRequest.current) break;
        updateItem(item.key, {
          error: error instanceof Error ? error.message : "ตรวจรายการเดิมไม่สำเร็จ",
          preflight: null,
          status: "error",
        });
        blockedCount += 1;
      }
    }
    if (requestId !== latestPreflightRequest.current) return;
    setIsPreflighting(false);
    setPhase("idle");
    setMessage(`พร้อมนำเข้า ${readyCount} PDF${blockedCount ? ` · ต้องแก้ ${blockedCount} รายการ` : ""}`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const candidates = items.filter(
      (item) => item.pdf && item.extraction && item.preflight?.canImport && item.status !== "success",
    );
    if (candidates.length === 0) {
      setPhase("error");
      setMessage("ยังไม่มีคู่ PDF–JSON ที่ผ่านการตรวจและพร้อมสร้าง Draft");
      return;
    }
    setPhase("creating");
    let successCount = 0;
    let failedCount = 0;
    let modelCount = 0;
    for (const item of candidates) {
      const pdf = item.pdf;
      const extraction = item.extraction;
      if (!pdf || !extraction) continue;
      updateItem(item.key, { error: "", status: "importing" });
      try {
        const checksum = await createFileChecksums(pdf);
        const intentResponse = await fetch(
          "/api/v1/admin/datasheets/extracted-imports/upload-intents",
          {
            body: JSON.stringify({
              extraction,
              filename: pdf.name,
              language,
              market,
              mediaType: pdf.type,
              revisionLabel,
              sha256Base64: checksum.base64,
              sha256Hex: checksum.hex,
              sizeBytes: pdf.size,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        );
        const intent = await readApiResponse<UploadIntentResponse>(intentResponse);
        await uploadPdf(intent, pdf);
        const finalizeResponse = await fetch(
          `/api/v1/admin/datasheets/${intent.assetId}/finalize`,
          { method: "POST" },
        );
        await readApiResponse<{ message: string; state: string }>(finalizeResponse);
        updateItem(item.key, { status: "success" });
        successCount += 1;
        modelCount += intent.revisions.length;
      } catch (error) {
        updateItem(item.key, {
          error: error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ",
          status: "error",
        });
        failedCount += 1;
      }
    }
    setPhase(failedCount === 0 ? "success" : "error");
    setMessage(
      failedCount === 0
        ? `สร้าง Draft ${modelCount} Models จาก ${successCount} PDF แล้ว`
        : `นำเข้าสำเร็จ ${successCount} PDF · ต้องลองใหม่ ${failedCount} PDF`,
    );
    router.refresh();
  }

  const isBusy = ["validating", "hashing", "creating", "uploading", "finalizing"].includes(phase);
  const validPairCount = items.filter((item) => !item.pairingError && item.extraction && item.pdf).length;
  const preflightableCount = items.filter(
    (item) => !item.pairingError && item.extraction && item.status !== "success",
  ).length;
  const importableCount = items.filter(
    (item) => item.preflight?.canImport && item.status !== "success",
  ).length;
  const successCount = items.filter((item) => item.status === "success").length;
  const invalidCount = items.filter((item) => item.pairingError).length;
  const phaseLabel = {
    creating: "กำลังสร้าง Draft จากคู่ที่พร้อม…",
    error: "ต้องแก้ไขก่อนลองใหม่",
    finalizing: "กำลังตรวจไฟล์…",
    hashing: "กำลังคำนวณ SHA-256…",
    idle: "รอชุด PDF และ JSON ที่สร้างจาก EasySolar Prompt",
    success: "นำเข้าสำเร็จ",
    uploading: "กำลังอัปโหลด PDF หลายไฟล์…",
    validating: "กำลังจับคู่และตรวจ JSON…",
  }[phase];

  const statusLabels: Record<BatchItemStatus, string> = {
    blocked: "ติดปัญหา",
    checking: "กำลังตรวจ",
    error: "ลองใหม่ได้",
    importing: "กำลังนำเข้า",
    invalid: "จับคู่ไม่ได้",
    ready: "พร้อม",
    success: "สร้าง Draft แล้ว",
  };

  return (
    <section className="datasheet-intake extraction-intake" aria-labelledby="extraction-intake-title">
      <div className="datasheet-intake__head">
        <div>
          <p className="eyebrow eyebrow--dark">EXTERNAL AI EXTRACTION</p>
          <h2 id="extraction-intake-title">นำเข้า PDF หลายไฟล์จาก JSON</h2>
          <p>
            ใช้ Prompt และ Template กลางกับ ChatGPT ภายนอก แล้วเลือก PDF และ JSON หลายไฟล์พร้อมกัน
            EasySolar จะจับคู่ ตรวจ และสร้างเฉพาะ Draft โดยไม่เรียก AI API และไม่ Publish อัตโนมัติ
          </p>
        </div>
        <span className={`intake-state intake-state--${capabilities.ready ? "ready" : "blocked"}`}>
          {capabilities.ready ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {capabilities.ready ? "MANUAL GPT READY" : "CONFIG REQUIRED"}
        </span>
      </div>

      <div className="extraction-downloads" aria-label="ไฟล์กลางสำหรับใช้งานกับ ChatGPT">
        <a download href="/easysolar-extraction/easysolar-extraction-prompt-v1.txt">
          <Download size={16} aria-hidden="true" /> Prompt v1.2
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
            <span>เตรียม JSON หนึ่งไฟล์ต่อ PDF · ชื่อ PDF ต้องตรงกับ source_document.filename ทุกตัวอักษร</span>
          </div>
          <label className="datasheet-intake__file">
            <span>1. เลือก Datasheet PDF ทั้งหมด</span>
            <input accept="application/pdf,.pdf" multiple onChange={handlePdfChange} type="file" />
            <small>สูงสุด {MAX_EXTRACTION_BATCH_FILES} PDF · ไฟล์ละไม่เกิน {formatMegabytes(MAX_DATASHEET_SIZE_BYTES)}</small>
          </label>
          <label className="datasheet-intake__file">
            <span>2. เลือก JSON ผลลัพธ์ทั้งหมด</span>
            <input accept="application/json,.json" multiple onChange={handleJsonChange} type="file" />
            <small>สูงสุด {MAX_EXTRACTION_BATCH_FILES} JSON · Template v1.1 · Prompt v1.2 · ไฟล์ละไม่เกิน 1 MB</small>
          </label>

          {items.length > 0 ? (
            <section className="extraction-batch" aria-labelledby="extraction-batch-title">
              <div className="extraction-batch__head">
                <div>
                  <p className="eyebrow eyebrow--dark">BATCH PAIRING</p>
                  <h3 id="extraction-batch-title">คู่ PDF–JSON</h3>
                </div>
                <dl>
                  <div><dt>พร้อมจับคู่</dt><dd>{validPairCount}</dd></div>
                  <div><dt>ต้องแก้</dt><dd>{invalidCount}</dd></div>
                  <div><dt>สำเร็จ</dt><dd>{successCount}</dd></div>
                </dl>
              </div>
              <div className="extraction-batch__list">
                {items.map((item) => {
                  const extraction = item.extraction;
                  return (
                    <article data-status={item.status} key={item.key}>
                      <div className="extraction-batch__files">
                        <span><FileText size={16} aria-hidden="true" /> {item.pdf?.name ?? extraction?.source_document.filename ?? "ไม่พบ PDF"}</span>
                        <small><FileJson2 size={14} aria-hidden="true" /> {item.json?.name ?? "ไม่พบ JSON"}</small>
                      </div>
                      <div className="extraction-batch__models">
                        {extraction ? (
                          <>
                            <strong>{extraction.manufacturer.value}</strong>
                            <small>{extraction.models.map((model) => model.exact_model).join(" · ")}</small>
                            {item.excludedDuplicateModels.length > 0 ? (
                              <small>ตัดรุ่นซ้ำที่มี PDF เจ้าของแล้ว: {item.excludedDuplicateModels.join(" · ")}</small>
                            ) : null}
                          </>
                        ) : <small>ยังอ่านรายละเอียดไม่ได้</small>}
                      </div>
                      <div className="extraction-batch__metrics">
                        <span>{extraction?.detected_model_count ?? 0} Models</span>
                        <span>{extraction ? countAttentionFields(extraction) : 0} ต้องตรวจ</span>
                      </div>
                      <div className="extraction-batch__result">
                        <span>{item.status === "checking" || item.status === "importing" ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null}{statusLabels[item.status]}</span>
                        {item.error ? <small>{item.error}</small> : null}
                        {item.preflight?.canImport ? (
                          <small>เพิ่ม {item.preflight.summary.newModels} Model · {item.preflight.summary.newRevisions} Revision</small>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="extraction-batch__action">
                <span>ตรวจ Manufacturer, Model, Market และ Revision ทุกคู่ก่อนสร้าง Draft</span>
                <button
                  className="button button--outline"
                  disabled={isBusy || isPreflighting || preflightableCount === 0}
                  onClick={() => void handlePreflight()}
                  type="button"
                >
                  {isPreflighting ? "กำลังตรวจ…" : `ตรวจรายการ ${preflightableCount} PDF`}
                </button>
              </div>
            </section>
          ) : null}

          {preflightError ? (
            <p className="extraction-preflight__error" role="alert">{preflightError}</p>
          ) : null}

          <div className="datasheet-intake__action">
            <div aria-live="polite">
              {phase === "success" ? <CheckCircle2 size={17} /> : null}
              {phase === "error" ? <AlertTriangle size={17} /> : null}
              {isBusy ? <LoaderCircle className="spin" size={17} /> : null}
              <span>{message || phaseLabel}</span>
            </div>
            <button
              className="button button--ink"
              disabled={isBusy || isPreflighting || importableCount === 0}
              type="submit"
            >
              <Files size={17} aria-hidden="true" />
              {isBusy ? "กำลังดำเนินการ" : `สร้าง Draft จาก ${importableCount} PDF`}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
