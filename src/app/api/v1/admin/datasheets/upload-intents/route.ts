import { datasheetUploadIntentSchema } from "@/domain/assets/schemas";
import { createDatasheetUploadRecord } from "@/lib/server/datasheet-repository";
import {
  errorResponse,
  HttpError,
  parseJsonRequest,
} from "@/lib/server/http-error";
import { createDatasheetUploadUrl } from "@/lib/server/object-storage";
import { requireAdminRequest } from "@/lib/server/request-auth";
import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const capabilities = getDatasheetRuntimeCapabilities();
    if (!capabilities.ready) {
      throw new HttpError(
        503,
        "DATASHEET_SERVICE_NOT_CONFIGURED",
        "ต้องตั้งค่า PostgreSQL, S3 storage และ admin token ก่อนใช้งาน",
      );
    }

    await requireAdminRequest();
    const parsed = datasheetUploadIntentSchema.safeParse(
      await parseJsonRequest(request),
    );

    if (!parsed.success) {
      throw new HttpError(
        400,
        "INVALID_UPLOAD_INTENT",
        parsed.error.issues[0]?.message ?? "ข้อมูลไฟล์ไม่ถูกต้อง",
      );
    }

    const record = await createDatasheetUploadRecord(parsed.data);
    const uploadUrl = await createDatasheetUploadUrl({
      assetId: record.assetId,
      checksumBase64: parsed.data.sha256Base64,
      objectKey: record.objectKey,
      sha256Hex: parsed.data.sha256Hex,
    });

    return Response.json(
      {
        assetId: record.assetId,
        expiresInSeconds: 600,
        productModelId: record.productModelId,
        revisionId: record.revisionId,
        uploadHeaders: {
          "content-type": parsed.data.mediaType,
          "x-amz-checksum-sha256": parsed.data.sha256Base64,
          "x-amz-meta-assetid": record.assetId,
          "x-amz-meta-sha256hex": parsed.data.sha256Hex,
        },
        uploadUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
