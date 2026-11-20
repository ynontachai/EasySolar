import {
  extractedImportPreflightSchema,
  MAX_EXTRACTION_JSON_SIZE_BYTES,
} from "@/domain/catalog/extraction-schema";
import { requireAdminPrincipal } from "@/lib/server/admin-auth";
import { previewExtractedImport } from "@/lib/server/extracted-import-repository";
import { errorResponse, HttpError } from "@/lib/server/http-error";
import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";

export const runtime = "nodejs";

const MAX_REQUEST_SIZE_BYTES = MAX_EXTRACTION_JSON_SIZE_BYTES + 16 * 1024;

async function readLimitedJson(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_SIZE_BYTES) {
    throw new HttpError(413, "EXTRACTION_JSON_TOO_LARGE", "ไฟล์ JSON ต้องไม่เกิน 1 MB");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_SIZE_BYTES) {
    throw new HttpError(413, "EXTRACTION_JSON_TOO_LARGE", "ไฟล์ JSON ต้องไม่เกิน 1 MB");
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "รูปแบบ JSON ไม่ถูกต้อง");
  }
}

export async function POST(request: Request) {
  try {
    const capabilities = getDatasheetRuntimeCapabilities();
    if (!capabilities.ready) {
      throw new HttpError(
        503,
        "DATASHEET_SERVICE_NOT_CONFIGURED",
        "ต้องตั้งค่า PostgreSQL, S3 storage และ admin auth ก่อนใช้งาน",
      );
    }
    await requireAdminPrincipal(["account_admin", "super_admin"]);
    const parsed = extractedImportPreflightSchema.safeParse(await readLimitedJson(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        "INVALID_EXTRACTED_IMPORT_PREFLIGHT",
        parsed.error.issues[0]?.message ?? "ข้อมูลตรวจสอบก่อนนำเข้าไม่ถูกต้อง",
      );
    }
    return Response.json(await previewExtractedImport(parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}
