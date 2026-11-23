import { DATASHEET_MEDIA_TYPE, MAX_DATASHEET_SIZE_BYTES } from "@/domain/assets/config";
import type { ExtractedSpec } from "./extraction-schema";

export const MAX_EXTRACTION_BATCH_FILES = 50;

export interface ExtractionBatchFile {
  name: string;
  size: number;
  type: string;
}

export interface ParsedExtractionBatchFile {
  error: string | null;
  extraction: ExtractedSpec | null;
  name: string;
  sourceFilename: string | null;
}

export interface ExtractionBatchPlanItem {
  error: string | null;
  extraction: ExtractedSpec | null;
  jsonIndex: number | null;
  key: string;
  pdfIndex: number | null;
}

function normalizedIdentity(extraction: ExtractedSpec, exactModel: string) {
  return `${extraction.manufacturer.value.trim().toLocaleLowerCase("en-US")}\u0000${exactModel.trim().toLocaleLowerCase("en-US")}`;
}

export function buildExtractionBatchPlan(input: {
  jsonFiles: ParsedExtractionBatchFile[];
  pdfFiles: ExtractionBatchFile[];
}) {
  const pdfIndexesByName = new Map<string, number[]>();
  input.pdfFiles.forEach((file, index) => {
    const indexes = pdfIndexesByName.get(file.name) ?? [];
    indexes.push(index);
    pdfIndexesByName.set(file.name, indexes);
  });

  const sourceCounts = new Map<string, number>();
  for (const file of input.jsonFiles) {
    const sourceName = file.extraction?.source_document.filename ?? file.sourceFilename;
    if (sourceName) sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1);
  }

  const matchedPdfIndexes = new Set<number>();
  const items: ExtractionBatchPlanItem[] = input.jsonFiles.map((file, jsonIndex) => {
    const extraction = file.extraction;
    if (!extraction) {
      const sourceName = file.sourceFilename;
      const pdfIndexes = sourceName ? (pdfIndexesByName.get(sourceName) ?? []) : [];
      const pdfIndex = pdfIndexes.length === 1 ? (pdfIndexes[0] ?? null) : null;
      if (pdfIndex !== null) matchedPdfIndexes.add(pdfIndex);
      let pairingError = file.error ?? "JSON ไม่ตรงกับ EasySolar template";
      if (sourceName && (sourceCounts.get(sourceName) ?? 0) > 1) {
        pairingError = `มี JSON มากกว่าหนึ่งไฟล์ที่อ้างถึง ${sourceName}`;
      } else if (sourceName && pdfIndexes.length === 0) {
        pairingError = `${pairingError} · ไม่พบ PDF ชื่อ ${sourceName}`;
      } else if (sourceName && pdfIndexes.length > 1) {
        pairingError = `${pairingError} · มี PDF ชื่อ ${sourceName} ซ้ำในชุดที่เลือก`;
      }
      return {
        error: pairingError,
        extraction: null,
        jsonIndex,
        key: `json:${jsonIndex}:${file.name}`,
        pdfIndex,
      };
    }

    const sourceName = extraction.source_document.filename;
    const pdfIndexes = pdfIndexesByName.get(sourceName) ?? [];
    let error: string | null = null;
    let pdfIndex: number | null = null;

    if ((sourceCounts.get(sourceName) ?? 0) > 1) {
      error = `มี JSON มากกว่าหนึ่งไฟล์ที่อ้างถึง ${sourceName}`;
    } else if (pdfIndexes.length === 0) {
      error = `ไม่พบ PDF ชื่อ ${sourceName}`;
    } else if (pdfIndexes.length > 1) {
      error = `มี PDF ชื่อ ${sourceName} ซ้ำในชุดที่เลือก`;
    } else {
      pdfIndex = pdfIndexes[0] ?? null;
      if (pdfIndex !== null) {
        const pdf = input.pdfFiles[pdfIndex];
        matchedPdfIndexes.add(pdfIndex);
        if (!pdf.name.toLocaleLowerCase("en-US").endsWith(".pdf") || pdf.type !== DATASHEET_MEDIA_TYPE) {
          error = `${pdf.name} ต้องเป็นไฟล์ PDF`;
        } else if (pdf.size > MAX_DATASHEET_SIZE_BYTES) {
          error = `${pdf.name} มีขนาดเกินกำหนด`;
        }
      }
    }

    return {
      error,
      extraction,
      jsonIndex,
      key: `pair:${jsonIndex}:${sourceName}`,
      pdfIndex,
    };
  });

  input.pdfFiles.forEach((pdf, pdfIndex) => {
    if (matchedPdfIndexes.has(pdfIndex)) return;
    const hasNamedJson = input.jsonFiles.some(
      (file) => (file.extraction?.source_document.filename ?? file.sourceFilename) === pdf.name,
    );
    if (hasNamedJson) return;
    items.push({
      error: `ไม่พบ JSON ที่อ้างถึง ${pdf.name}`,
      extraction: null,
      jsonIndex: null,
      key: `pdf:${pdfIndex}:${pdf.name}`,
      pdfIndex,
    });
  });

  const modelOwners = new Map<string, number[]>();
  items.forEach((item, itemIndex) => {
    if (item.error || !item.extraction) return;
    for (const model of item.extraction.models) {
      const identity = normalizedIdentity(item.extraction, model.exact_model);
      const owners = modelOwners.get(identity) ?? [];
      owners.push(itemIndex);
      modelOwners.set(identity, owners);
    }
  });
  for (const ownerIndexes of modelOwners.values()) {
    if (ownerIndexes.length < 2) continue;
    for (const itemIndex of ownerIndexes) {
      const item = items[itemIndex];
      if (item) item.error = "Manufacturer และ Exact model ซ้ำกับ PDF อื่นในชุดนี้";
    }
  }

  return items;
}
