import "server-only";
import type { CreateSkuInput } from "@/domain/catalog/admin-schemas";
import {
  getPrincipalOrganizationIds,
  isSuperAdmin,
  type AdminPrincipal,
} from "./admin-auth";
import { getDb } from "./db";
import { HttpError } from "./http-error";

export interface CatalogProductOption {
  category: "inverter" | "pv_module";
  exactModel: string;
  id: string;
  manufacturer: string;
  manufacturerId: string;
}

export interface CatalogManufacturerOption {
  id: string;
  name: string;
}

export interface CatalogOrganizationOption {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogSkuRow {
  category: "inverter" | "pv_module";
  exactModel: string;
  id: string;
  imageAlt: string | null;
  imageAssetId: string | null;
  manufacturer: string;
  organizationName: string;
  sku: string;
  status: string;
  updatedAt: Date;
  variantLabel: string;
}

function canManageOrganization(principal: AdminPrincipal, organizationId: string) {
  return (
    isSuperAdmin(principal) ||
    principal.roles.some(
      (role) =>
        role.code === "account_admin" && role.organizationId === organizationId,
    )
  );
}

export async function listCatalogProductOptions() {
  const sql = getDb();
  return sql<CatalogProductOption[]>`
    SELECT
      product_model.id::text AS id,
      manufacturer.id::text AS "manufacturerId",
      manufacturer.name AS manufacturer,
      product_model.exact_model AS "exactModel",
      product_model.category::text AS category
    FROM product_model
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    ORDER BY manufacturer.name, product_model.exact_model
  `;
}

export async function listCatalogManufacturerOptions() {
  const sql = getDb();
  return sql<CatalogManufacturerOption[]>`
    SELECT id::text AS id, name
    FROM manufacturer
    WHERE status <> 'recalled'
    ORDER BY name
  `;
}

export async function listOrganizationsForPrincipal(principal: AdminPrincipal) {
  const sql = getDb();

  if (isSuperAdmin(principal)) {
    return sql<CatalogOrganizationOption[]>`
      SELECT id::text AS id, name, slug::text AS slug
      FROM organization
      WHERE status = 'active'
      ORDER BY name
    `;
  }

  const organizationIds = getPrincipalOrganizationIds(principal);
  if (organizationIds.length === 0) return [];

  return sql<CatalogOrganizationOption[]>`
    SELECT id::text AS id, name, slug::text AS slug
    FROM organization
    WHERE status = 'active'
      AND id = ANY(${sql.array(organizationIds)}::uuid[])
    ORDER BY name
  `;
}

export async function listCatalogSkus(principal: AdminPrincipal) {
  const sql = getDb();
  const organizationIds = getPrincipalOrganizationIds(principal);

  if (!isSuperAdmin(principal) && organizationIds.length === 0) return [];

  const scope = isSuperAdmin(principal)
    ? sql``
    : sql`WHERE product_variant.organization_id = ANY(${sql.array(organizationIds)}::uuid[])`;

  return sql<CatalogSkuRow[]>`
    SELECT
      product_variant.id::text AS id,
      product_variant.sku::text AS sku,
      product_variant.variant_label AS "variantLabel",
      product_variant.status::text AS status,
      product_variant.updated_at AS "updatedAt",
      primary_media.asset_id::text AS "imageAssetId",
      primary_media.alt_text AS "imageAlt",
      organization.name AS "organizationName",
      manufacturer.name AS manufacturer,
      product_model.exact_model AS "exactModel",
      product_model.category::text AS category
    FROM product_variant
    JOIN organization ON organization.id = product_variant.organization_id
    JOIN product_model ON product_model.id = product_variant.product_model_id
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    LEFT JOIN LATERAL (
      SELECT product_media.asset_id, product_media.alt_text
      FROM product_media
      JOIN asset ON asset.id = product_media.asset_id
      WHERE product_media.product_model_id = product_model.id
        AND product_media.role = 'primary'
        AND asset.state = 'available'
      ORDER BY product_media.created_at DESC
      LIMIT 1
    ) AS primary_media ON true
    ${scope}
    ORDER BY product_variant.updated_at DESC
    LIMIT 200
  `;
}

export async function createCatalogSku(
  principal: AdminPrincipal,
  input: CreateSkuInput,
) {
  if (!canManageOrganization(principal, input.organizationId)) {
    throw new HttpError(
      403,
      "ORGANIZATION_PERMISSION_REQUIRED",
      "คุณไม่มีสิทธิ์เพิ่ม SKU ให้ organization นี้",
    );
  }

  const sql = getDb();

  try {
    return await sql.begin(async (transaction) => {
      let productModelId = input.productModelId;
      let manufacturerCreated = false;
      let productModelCreated = false;

      if (productModelId) {
        const models = await transaction<Array<{ category: "inverter" | "pv_module"; id: string }>>`
          SELECT id::text AS id, category::text AS category
          FROM product_model
          WHERE id = ${productModelId}
          LIMIT 1
        `;
        if (!models[0]) {
          throw new HttpError(400, "PRODUCT_MODEL_NOT_FOUND", "ไม่พบ Product Model ที่เลือก");
        }
        if (models[0].category !== input.category) {
          throw new HttpError(
            400,
            "PRODUCT_CATEGORY_MISMATCH",
            "ประเภทสินค้าไม่ตรงกับ Product Model ที่เลือก",
          );
        }
      } else {
        let manufacturerId = input.manufacturerId;

        if (manufacturerId) {
          const manufacturers = await transaction<Array<{ id: string }>>`
            SELECT id::text AS id
            FROM manufacturer
            WHERE id = ${manufacturerId}
            LIMIT 1
          `;
          if (!manufacturers[0]) {
            throw new HttpError(400, "MANUFACTURER_NOT_FOUND", "ไม่พบ Brand ที่เลือก");
          }
        } else if (input.manufacturerName) {
          const matchedManufacturers = await transaction<Array<{ id: string }>>`
            SELECT id::text AS id
            FROM manufacturer
            WHERE lower(name) = lower(${input.manufacturerName})
            LIMIT 1
          `;

          if (matchedManufacturers[0]) {
            manufacturerId = matchedManufacturers[0].id;
          } else {
            const createdManufacturers = await transaction<Array<{ id: string }>>`
              INSERT INTO manufacturer (name)
              VALUES (${input.manufacturerName})
              RETURNING id::text AS id
            `;
            manufacturerId = createdManufacturers[0]?.id ?? null;
            manufacturerCreated = true;
          }
        }

        if (!manufacturerId || !input.exactModel) {
          throw new HttpError(400, "PRODUCT_IDENTITY_REQUIRED", "ข้อมูล Brand และ Model ไม่ครบ");
        }

        const duplicateModels = await transaction<Array<{
          category: "inverter" | "pv_module";
          id: string;
        }>>`
          SELECT id::text AS id, category::text AS category
          FROM product_model
          WHERE manufacturer_id = ${manufacturerId}
            AND lower(exact_model) = lower(${input.exactModel})
            AND market = 'TH'
          LIMIT 1
        `;
        const duplicateModel = duplicateModels[0];
        if (duplicateModel) {
          if (duplicateModel.category !== input.category) {
            throw new HttpError(
              409,
              "PRODUCT_MODEL_CATEGORY_CONFLICT",
              "Brand และ Model นี้มีอยู่แล้ว แต่อยู่คนละประเภทสินค้า",
            );
          }
          productModelId = duplicateModel.id;
        } else {
          const createdModels = await transaction<Array<{ id: string }>>`
            INSERT INTO product_model (
              manufacturer_id,
              category,
              exact_model,
              market
            ) VALUES (
              ${manufacturerId},
              ${input.category},
              ${input.exactModel},
              'TH'
            )
            RETURNING id::text AS id
          `;
          productModelId = createdModels[0]?.id ?? null;
          productModelCreated = true;
        }
      }

      if (!productModelId) {
        throw new Error("PRODUCT_MODEL_INSERT_FAILED");
      }

      const rows = await transaction<Array<{ id: string }>>`
        INSERT INTO product_variant (
          organization_id,
          product_model_id,
          sku,
          variant_label,
          manufacturer_part_number,
          created_by,
          updated_by
        ) VALUES (
          ${input.organizationId},
          ${productModelId},
          ${input.sku.toUpperCase()},
          ${input.variantLabel},
          ${input.manufacturerPartNumber},
          ${principal.userId},
          ${principal.userId}
        )
        RETURNING id::text AS id
      `;
      const created = rows[0];
      if (!created) throw new Error("SKU_INSERT_FAILED");

      await transaction`
        INSERT INTO audit_event (
          actor_id,
          organization_id,
          action,
          entity_type,
          entity_id,
          after_json
        ) VALUES (
          ${principal.userId},
          ${input.organizationId},
          'catalog.product_and_sku.created',
          'product_variant',
          ${created.id},
          ${transaction.json({
            category: input.category,
            manufacturerCreated,
            productModelCreated,
            productModelId,
            sku: input.sku.toUpperCase(),
            variantLabel: input.variantLabel,
          })}
        )
      `;

      return { id: created.id, productModelId };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new HttpError(
        409,
        "CATALOG_RECORD_ALREADY_EXISTS",
        "SKU หรือข้อมูลสินค้านี้มีอยู่ในระบบแล้ว กรุณาตรวจรายการเดิม",
      );
    }
    throw error;
  }
}
