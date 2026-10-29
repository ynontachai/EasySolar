import { DATASHEET_MEDIA_TYPE } from "@/domain/assets/config";
import { assetIdSchema } from "@/domain/assets/schemas";
import {
  finalizeAssetRecord,
  getFinalizableAsset,
} from "@/lib/server/datasheet-repository";
import { errorResponse, HttpError } from "@/lib/server/http-error";
import {
  inspectStoredObject,
  isStoredObjectMissingError,
} from "@/lib/server/object-storage";
import { requireAdminRequest } from "@/lib/server/request-auth";
import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    requireAdminRequest(request);
    const { assetId: rawAssetId } = await context.params;
    const assetId = assetIdSchema.safeParse(rawAssetId);

    if (!assetId.success) {
      throw new HttpError(400, "INVALID_ASSET_ID", "Asset ID ไม่ถูกต้อง");
    }

    const asset = await getFinalizableAsset(assetId.data);
    let storedObject: Awaited<ReturnType<typeof inspectStoredObject>>;

    try {
      storedObject = await inspectStoredObject(asset.objectKey);
    } catch (error) {
      if (isStoredObjectMissingError(error)) {
        throw new HttpError(
          409,
          "ASSET_UPLOAD_NOT_FOUND",
          "ยังไม่พบไฟล์ใน Storage กรุณาอัปโหลดให้เสร็จก่อน finalize",
        );
      }

      throw error;
    }

    if (storedObject.contentLength !== asset.sizeBytes) {
      throw new HttpError(
        409,
        "ASSET_SIZE_MISMATCH",
        "ขนาดไฟล์ที่จัดเก็บไม่ตรงกับ upload intent",
      );
    }

    if (storedObject.contentType !== DATASHEET_MEDIA_TYPE) {
      throw new HttpError(
        409,
        "ASSET_MEDIA_TYPE_MISMATCH",
        "ไฟล์ที่จัดเก็บไม่ใช่ PDF",
      );
    }

    if (storedObject.sha256Hex !== asset.sha256) {
      throw new HttpError(
        409,
        "ASSET_CHECKSUM_MISMATCH",
        "Checksum ของไฟล์ไม่ตรงกับ upload intent",
      );
    }

    const capabilities = getDatasheetRuntimeCapabilities();
    const nextState = capabilities.scanMode === "trusted-dev" ? "available" : "scanning";
    const state = await finalizeAssetRecord({
      assetId: asset.assetId,
      etag: storedObject.etag,
      state: nextState,
    });

    return Response.json({
      assetId: asset.assetId,
      message:
        state === "available"
          ? "อัปโหลดสำเร็จและพร้อมสำหรับการตรวจข้อมูล"
          : "อัปโหลดสำเร็จและกำลังรอผลตรวจไฟล์",
      state,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
