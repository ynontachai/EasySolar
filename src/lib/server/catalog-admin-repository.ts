import "server-only";
import type {
  CreateSkuInput,
  SpecActivationInput,
} from "@/domain/catalog/admin-schemas";
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

export interface CatalogSpecRow {
  brandActive: boolean;
  category: "inverter" | "pv_module";
  exactModel: string;
  manufacturer: string;
  manufacturerId: string;
  modelActive: boolean;
  modelId: string;
  revisionLabel: string;
  specSummary: string;
  updatedAt: Date;
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
    LEFT JOIN manufacturer_category_status
      ON manufacturer_category_status.manufacturer_id = manufacturer.id
      AND manufacturer_category_status.category = product_model.category
    WHERE product_model.is_active = true
      AND COALESCE(manufacturer_category_status.is_active, true) = true
    ORDER BY manufacturer.name, product_model.exact_model
  `;
}

export async function listCatalogSpecs(
  category: "inverter" | "pv_module",
): Promise<CatalogSpecRow[]> {
  const sql = getDb();
  const rows = await sql<Array<{
    brandActive: boolean;
    category: "inverter" | "pv_module";
    exactModel: string;
    manufacturer: string;
    manufacturerId: string;
    maxDcVoltageV: string | null;
    modelActive: boolean;
    modelId: string;
    pmaxWp: string | null;
    ratedAcKw: string | null;
    revisionLabel: string;
    updatedAt: Date;
    vocV: string | null;
  }>>`
    SELECT
      COALESCE(manufacturer_category_status.is_active, true) AS "brandActive",
      product_model.category::text AS category,
      product_model.exact_model AS "exactModel",
      manufacturer.name AS manufacturer,
      manufacturer.id::text AS "manufacturerId",
      product_model.is_active AS "modelActive",
      product_model.id::text AS "modelId",
      product_model.updated_at AS "updatedAt",
      current_revision.revision_label AS "revisionLabel",
      pv_module_spec.pmax_wp::text AS "pmaxWp",
      pv_module_spec.voc_v::text AS "vocV",
      inverter_spec.rated_ac_kw::text AS "ratedAcKw",
      inverter_spec.max_dc_voltage_v::text AS "maxDcVoltageV"
    FROM product_model
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    JOIN LATERAL (
      SELECT id, revision_label
      FROM datasheet_revision
      WHERE datasheet_revision.product_model_id = product_model.id
        AND datasheet_revision.state = 'published'
      ORDER BY datasheet_revision.published_at DESC NULLS LAST, datasheet_revision.created_at DESC
      LIMIT 1
    ) AS current_revision ON true
    LEFT JOIN pv_module_spec
      ON pv_module_spec.datasheet_revision_id = current_revision.id
    LEFT JOIN inverter_spec
      ON inverter_spec.datasheet_revision_id = current_revision.id
    LEFT JOIN manufacturer_category_status
      ON manufacturer_category_status.manufacturer_id = manufacturer.id
      AND manufacturer_category_status.category = product_model.category
    WHERE product_model.category = ${category}
    ORDER BY manufacturer.name, product_model.exact_model
  `;

  return rows.map((row) => ({
    brandActive: row.brandActive,
    category: row.category,
    exactModel: row.exactModel,
    manufacturer: row.manufacturer,
    manufacturerId: row.manufacturerId,
    modelActive: row.modelActive,
    modelId: row.modelId,
    revisionLabel: row.revisionLabel,
    specSummary:
      row.category === "pv_module"
        ? row.pmaxWp === null || row.vocV === null
          ? "Spec ไม่ครบ"
          : `${Number(row.pmaxWp)} Wp · ${Number(row.vocV)} Voc`
        : row.ratedAcKw === null || row.maxDcVoltageV === null
          ? "Spec ไม่ครบ"
          : `${Number(row.ratedAcKw)} kW · ${Number(row.maxDcVoltageV)} Vdc max`,
    updatedAt: row.updatedAt,
  }));
}

export async function setCatalogSpecActivation(
  principal: AdminPrincipal,
  input: SpecActivationInput,
) {
  const sql = getDb();

  await sql.begin(async (transaction) => {
    if (input.targetType === "model") {
      const [model] = await transaction<Array<{
        isActive: boolean;
        manufacturer: string;
        model: string;
      }>>`
        SELECT
          product_model.is_active AS "isActive",
          manufacturer.name AS manufacturer,
          product_model.exact_model AS model
        FROM product_model
        JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
        WHERE product_model.id = ${input.targetId}
          AND product_model.category = ${input.category}
        FOR UPDATE
      `;
      if (!model) {
        throw new HttpError(404, "PRODUCT_MODEL_NOT_FOUND", "ไม่พบ Model ที่เลือก");
      }

      await transaction`
        UPDATE product_model
        SET is_active = ${input.isActive}, updated_at = now()
        WHERE id = ${input.targetId}
      `;
      await transaction`
        INSERT INTO audit_event (
          actor_id, action, entity_type, entity_id, before_json, after_json
        ) VALUES (
          ${principal.userId},
          'catalog.spec_activation.updated',
          'product_model',
          ${input.targetId},
          ${transaction.json({
            category: input.category,
            isActive: model.isActive,
            manufacturer: model.manufacturer,
            model: model.model,
          })},
          ${transaction.json({
            category: input.category,
            isActive: input.isActive,
            manufacturer: model.manufacturer,
            model: model.model,
          })}
        )
      `;
      return;
    }

    const [manufacturer] = await transaction<Array<{ name: string }>>`
      SELECT name
      FROM manufacturer
      WHERE id = ${input.targetId}
      FOR UPDATE
    `;
    if (!manufacturer) {
      throw new HttpError(404, "MANUFACTURER_NOT_FOUND", "ไม่พบ Brand ที่เลือก");
    }

    const [existing] = await transaction<Array<{ isActive: boolean }>>`
      SELECT is_active AS "isActive"
      FROM manufacturer_category_status
      WHERE manufacturer_id = ${input.targetId}
        AND category = ${input.category}
      FOR UPDATE
    `;
    await transaction`
      INSERT INTO manufacturer_category_status (
        manufacturer_id, category, is_active, updated_by, updated_at
      ) VALUES (
        ${input.targetId}, ${input.category}, ${input.isActive}, ${principal.userId}, now()
      )
      ON CONFLICT (manufacturer_id, category)
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
    `;
    await transaction`
      INSERT INTO audit_event (
        actor_id, action, entity_type, entity_id, before_json, after_json
      ) VALUES (
        ${principal.userId},
        'catalog.brand_activation.updated',
        'manufacturer_category_status',
        ${input.targetId},
        ${transaction.json({
          category: input.category,
          isActive: existing?.isActive ?? true,
          manufacturer: manufacturer.name,
        })},
        ${transaction.json({
          category: input.category,
          isActive: input.isActive,
          manufacturer: manufacturer.name,
        })}
      )
    `;
  });
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
