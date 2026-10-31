import "server-only";
import { randomUUID } from "node:crypto";
import type { ProductImageUploadIntentInput } from "@/domain/assets/schemas";
import {
  getPrincipalOrganizationIds,
  isSuperAdmin,
  type AdminPrincipal,
} from "./admin-auth";
import { getDb } from "./db";
import { HttpError } from "./http-error";
import { createProductImageObjectKey } from "./object-storage";
import { getStorageRuntimeConfig } from "./runtime-config";

// Only Account Admins of the owning organization (and Super Admin) may change product media.
function canManageOrganization(principal: AdminPrincipal, organizationId: string) {
  return (
    isSuperAdmin(principal) ||
    principal.roles.some(
      (role) =>
        role.code === "account_admin" && role.organizationId === organizationId,
    )
  );
}

export async function createProductImageUploadRecord(
  principal: AdminPrincipal,
  input: ProductImageUploadIntentInput,
) {
  if (!canManageOrganization(principal, input.organizationId)) {
    throw new HttpError(403, "ORGANIZATION_PERMISSION_REQUIRED", "คุณไม่มีสิทธิ์เพิ่มรูปให้ Organization นี้");
  }

  const sql = getDb();
  const storage = getStorageRuntimeConfig();
  const assetId = randomUUID();
  const objectKey = createProductImageObjectKey({
    assetId,
    mediaType: input.mediaType,
    productModelId: input.productModelId,
  });

  return sql.begin(async (transaction) => {
    const [variant] = await transaction<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM product_variant
      WHERE id = ${input.productVariantId}
        AND organization_id = ${input.organizationId}
        AND product_model_id = ${input.productModelId}
      LIMIT 1
    `;
    if (!variant) {
      throw new HttpError(404, "PRODUCT_VARIANT_NOT_FOUND", "ไม่พบ SKU ที่จะผูกกับรูปนี้");
    }

    if (input.role === "primary") {
      await transaction`
        UPDATE product_media
        SET role = 'gallery', sort_order = GREATEST(sort_order, 1)
        WHERE product_model_id = ${input.productModelId}
          AND role = 'primary'
      `;
    }

    await transaction`
      INSERT INTO asset (
        id, purpose, storage_provider, bucket, object_key, original_filename,
        media_type, size_bytes, sha256, state, uploaded_by
      ) VALUES (
        ${assetId}, 'product_image', 's3', ${storage.bucket}, ${objectKey},
        ${input.filename}, ${input.mediaType}, ${input.sizeBytes},
        ${input.sha256Hex}, 'pending_upload', ${principal.userId}
      )
    `;

    await transaction`
      INSERT INTO product_media (
        organization_id, product_model_id, product_variant_id, asset_id,
        role, alt_text, sort_order, created_by
      ) VALUES (
        ${input.organizationId}, ${input.productModelId}, ${input.productVariantId},
        ${assetId}, ${input.role}, ${input.altText}, ${input.sortOrder}, ${principal.userId}
      )
    `;

    return { assetId, objectKey };
  });
}

export async function assertCanManageProductMediaAsset(
  principal: AdminPrincipal,
  assetId: string,
) {
  const sql = getDb();
  const [media] = await sql<Array<{ organizationId: string }>>`
    SELECT organization_id::text AS "organizationId"
    FROM product_media
    WHERE asset_id = ${assetId}
    LIMIT 1
  `;
  if (!media) throw new HttpError(404, "PRODUCT_IMAGE_NOT_FOUND", "ไม่พบรูปสินค้าที่ระบุ");
  if (!canManageOrganization(principal, media.organizationId)) {
    throw new HttpError(403, "ORGANIZATION_PERMISSION_REQUIRED", "คุณไม่มีสิทธิ์จัดการรูปของ Organization นี้");
  }
}

// Published products are public. Draft or unpublished product images are served only to
// admins whose role is scoped to the owning organization (super_admin sees all).
export async function findViewableProductImage(
  assetId: string,
  principal: AdminPrincipal | null,
) {
  const sql = getDb();
  const [image] = await sql<
    Array<{
      mediaType: string;
      objectKey: string;
      organizationId: string;
      productStatus: string;
    }>
  >`
    SELECT
      asset.media_type AS "mediaType",
      asset.object_key AS "objectKey",
      product_media.organization_id::text AS "organizationId",
      product_model.status::text AS "productStatus"
    FROM product_media
    JOIN asset ON asset.id = product_media.asset_id
    JOIN product_model ON product_model.id = product_media.product_model_id
    WHERE asset.id = ${assetId}
      AND asset.purpose = 'product_image'
      AND asset.state = 'available'
    LIMIT 1
  `;
  if (!image) throw new HttpError(404, "PRODUCT_IMAGE_NOT_FOUND", "ไม่พบรูปสินค้าที่พร้อมใช้งาน");

  const isPublic = image.productStatus === "published";
  const canView =
    isPublic ||
    (principal !== null &&
      (isSuperAdmin(principal) ||
        getPrincipalOrganizationIds(principal).includes(image.organizationId)));
  if (!canView) throw new HttpError(404, "PRODUCT_IMAGE_NOT_FOUND", "ไม่พบรูปสินค้าที่พร้อมใช้งาน");

  return { isPublic, mediaType: image.mediaType, objectKey: image.objectKey };
}
