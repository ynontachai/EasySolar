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
      manufacturer.name AS manufacturer,
      product_model.exact_model AS "exactModel",
      product_model.category::text AS category
    FROM product_model
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    ORDER BY manufacturer.name, product_model.exact_model
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
      organization.name AS "organizationName",
      manufacturer.name AS manufacturer,
      product_model.exact_model AS "exactModel",
      product_model.category::text AS category
    FROM product_variant
    JOIN organization ON organization.id = product_variant.organization_id
    JOIN product_model ON product_model.id = product_variant.product_model_id
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
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
      const models = await transaction<Array<{ id: string }>>`
        SELECT id::text AS id
        FROM product_model
        WHERE id = ${input.productModelId}
        LIMIT 1
      `;
      if (!models[0]) {
        throw new HttpError(400, "PRODUCT_MODEL_NOT_FOUND", "ไม่พบ Product Model ที่เลือก");
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
          ${input.productModelId},
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
          'catalog.sku.created',
          'product_variant',
          ${created.id},
          ${transaction.json({
            productModelId: input.productModelId,
            sku: input.sku.toUpperCase(),
            variantLabel: input.variantLabel,
          })}
        )
      `;

      return created;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new HttpError(409, "SKU_ALREADY_EXISTS", "SKU นี้มีอยู่ในระบบแล้ว");
    }
    throw error;
  }
}
