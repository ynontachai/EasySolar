import { unzip } from "fflate";
import { DATASHEET_MEDIA_TYPE, MAX_DATASHEET_SIZE_BYTES } from "@/domain/assets/config";

export const MAX_INVERTER_ZIP_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_INVERTER_ZIP_PDFS = 50;
export const MAX_INVERTER_ZIP_EXPANDED_BYTES = 500 * 1024 * 1024;

export type InverterZipType = "hybrid" | "string";

export interface InverterZipEntry {
  exactModel: string;
  file: File;
  inverterType: InverterZipType;
  path: string;
  proposedRatedAcKw: number | null;
}

export interface InverterZipResult {
  entries: InverterZipEntry[];
  warnings: string[];
}

function normalizedFolderName(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[\s_-]+/g, "");
}

export function inverterTypeFromZipPath(path: string): InverterZipType | null {
  const segments = path.replaceAll("\\", "/").split("/").slice(0, -1);
  if (segments.some((segment) => normalizedFolderName(segment) === "hybrid")) {
    return "hybrid";
  }
  if (segments.some((segment) => normalizedFolderName(segment) === "ongrid")) {
    return "string";
  }
  return null;
}

export function exactModelFromPdfFilename(filename: string) {
  return filename.replace(/\.pdf$/i, "").trim();
}

export function proposedRatedAcKwFromModel(model: string) {
  const match = model.match(/(\d+(?:\.\d+)?)K/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isSafeArchivePath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  return (
    !normalized.startsWith("/") &&
    !/^[a-z]:\//i.test(normalized) &&
    !normalized.split("/").includes("..")
  );
}

export async function extractInverterZip(file: File): Promise<InverterZipResult> {
  if (!file.name.toLocaleLowerCase("en-US").endsWith(".zip")) {
    throw new Error("กรุณาเลือกไฟล์ .zip");
  }
  if (file.size > MAX_INVERTER_ZIP_SIZE_BYTES) {
    throw new Error("ZIP ต้องมีขนาดไม่เกิน 100 MB");
  }

  const warnings: string[] = [];
  let expandedBytes = 0;
  let acceptedPdfs = 0;
  let limitError = "";
  const archive = new Uint8Array(await file.arrayBuffer());

  const extracted = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      archive,
      {
        filter: (entry) => {
          const path = entry.name.replaceAll("\\", "/");
          if (path.endsWith("/") || path.includes("/__MACOSX/") || !path.toLowerCase().endsWith(".pdf")) {
            return false;
          }
          if (!isSafeArchivePath(path)) {
            warnings.push(`ข้าม path ที่ไม่ปลอดภัย: ${path}`);
            return false;
          }
          if (!inverterTypeFromZipPath(path)) {
            warnings.push(`ข้าม PDF ที่ไม่ได้อยู่ในโฟลเดอร์ Hybrid หรือ On Grid: ${path}`);
            return false;
          }
          if (entry.originalSize > MAX_DATASHEET_SIZE_BYTES) {
            warnings.push(`ข้าม PDF ที่ใหญ่เกินกำหนด: ${path}`);
            return false;
          }
          acceptedPdfs += 1;
          expandedBytes += entry.originalSize;
          if (acceptedPdfs > MAX_INVERTER_ZIP_PDFS) {
            limitError = `ZIP มี PDF มากกว่า ${MAX_INVERTER_ZIP_PDFS} ไฟล์`;
            return false;
          }
          if (expandedBytes > MAX_INVERTER_ZIP_EXPANDED_BYTES) {
            limitError = "ขนาด PDF หลังแตก ZIP รวมกันต้องไม่เกิน 500 MB";
            return false;
          }
          return true;
        },
      },
      (error, data) => {
        if (error) reject(error);
        else resolve(data);
      },
    );
  });

  if (limitError) throw new Error(limitError);

  const entries = Object.entries(extracted).flatMap(([rawPath, bytes]) => {
    const path = rawPath.replaceAll("\\", "/");
    const inverterType = inverterTypeFromZipPath(path);
    if (!inverterType) return [];
    const filename = path.split("/").at(-1) ?? "";
    const exactModel = exactModelFromPdfFilename(filename);
    if (!exactModel) {
      warnings.push(`ข้าม PDF ที่ไม่มีชื่อ Model: ${path}`);
      return [];
    }
    const fileBytes = bytes.slice().buffer;
    return [{
      exactModel,
      file: new File([fileBytes], filename, { type: DATASHEET_MEDIA_TYPE }),
      inverterType,
      path,
      proposedRatedAcKw: proposedRatedAcKwFromModel(exactModel),
    }];
  });

  if (entries.length === 0) {
    throw new Error("ไม่พบ PDF ในโฟลเดอร์ Hybrid หรือ On Grid");
  }

  const duplicateModels = entries
    .map((entry) => entry.exactModel.toLocaleLowerCase("en-US"))
    .filter((model, index, models) => models.indexOf(model) !== index);
  if (duplicateModels.length > 0) {
    throw new Error(`พบชื่อ Model ซ้ำใน ZIP: ${Array.from(new Set(duplicateModels)).join(", ")}`);
  }

  return {
    entries: entries.sort((left, right) =>
      left.inverterType.localeCompare(right.inverterType) || left.exactModel.localeCompare(right.exactModel),
    ),
    warnings,
  };
}
