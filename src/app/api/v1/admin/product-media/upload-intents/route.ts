import { productImageUploadIntentSchema } from "@/domain/assets/schemas";
import { errorResponse, HttpError, parseJsonRequest } from "@/lib/server/http-error";
import { createProductImageUploadUrl } from "@/lib/server/object-storage";
import { createProductImageUploadRecord } from "@/lib/server/product-media-repository";
import { requireAdminRequest } from "@/lib/server/request-auth";
import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!getDatasheetRuntimeCapabilities().ready) {
      throw new HttpError(503, "MEDIA_SERVICE_NOT_CONFIGURED", "Storage หรือ Admin Auth ยังไม่พร้อมใช้งาน");
    }
    const principal = await requireAdminRequest();
    const parsed = productImageUploadIntentSchema.safeParse(await parseJsonRequest(request));
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_IMAGE_UPLOAD", parsed.error.issues[0]?.message ?? "ข้อมูลรูปไม่ถูกต้อง");
    }

    const record = await createProductImageUploadRecord(principal, parsed.data);
    const uploadUrl = await createProductImageUploadUrl({
      assetId: record.assetId,
      checksumBase64: parsed.data.sha256Base64,
      mediaType: parsed.data.mediaType,
      objectKey: record.objectKey,
      sha256Hex: parsed.data.sha256Hex,
    });
    return Response.json({
      assetId: record.assetId,
      uploadHeaders: {
        "content-type": parsed.data.mediaType,
        "x-amz-checksum-sha256": parsed.data.sha256Base64,
        "x-amz-meta-assetid": record.assetId,
        "x-amz-meta-sha256hex": parsed.data.sha256Hex,
      },
      uploadUrl,
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
