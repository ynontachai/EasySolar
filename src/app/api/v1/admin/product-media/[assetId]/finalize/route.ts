import { PRODUCT_IMAGE_MEDIA_TYPES } from "@/domain/assets/config";
import { assetIdSchema } from "@/domain/assets/schemas";
import { finalizeAssetRecord, getFinalizableAsset } from "@/lib/server/datasheet-repository";
import { errorResponse, HttpError } from "@/lib/server/http-error";
import { inspectStoredObject, isStoredObjectMissingError } from "@/lib/server/object-storage";
import { assertCanManageProductMediaAsset } from "@/lib/server/product-media-repository";
import { requireAdminRequest } from "@/lib/server/request-auth";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const principal = await requireAdminRequest();
    const assetId = assetIdSchema.safeParse((await context.params).assetId);
    if (!assetId.success) throw new HttpError(400, "INVALID_ASSET_ID", "Asset ID ไม่ถูกต้อง");
    await assertCanManageProductMediaAsset(principal, assetId.data);
    const asset = await getFinalizableAsset(assetId.data);
    if (!(PRODUCT_IMAGE_MEDIA_TYPES as readonly string[]).includes(asset.mediaType)) {
      throw new HttpError(409, "ASSET_MEDIA_TYPE_MISMATCH", "ไฟล์นี้ไม่ใช่รูปสินค้าที่รองรับ");
    }

    let storedObject: Awaited<ReturnType<typeof inspectStoredObject>>;
    try {
      storedObject = await inspectStoredObject(asset.objectKey);
    } catch (error) {
      if (isStoredObjectMissingError(error)) {
        throw new HttpError(409, "ASSET_UPLOAD_NOT_FOUND", "ยังไม่พบรูปใน Storage");
      }
      throw error;
    }
    if (storedObject.contentLength !== asset.sizeBytes || storedObject.contentType !== asset.mediaType) {
      throw new HttpError(409, "ASSET_METADATA_MISMATCH", "ชนิดหรือขนาดรูปไม่ตรงกับ upload intent");
    }
    if (storedObject.sha256Hex !== asset.sha256) {
      throw new HttpError(409, "ASSET_CHECKSUM_MISMATCH", "Checksum ของรูปไม่ตรงกับ upload intent");
    }
    const state = await finalizeAssetRecord({ assetId: asset.assetId, etag: storedObject.etag, state: "available" });
    return Response.json({ assetId: asset.assetId, state });
  } catch (error) {
    return errorResponse(error);
  }
}
