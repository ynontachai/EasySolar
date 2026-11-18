import "server-only";
import { randomUUID } from "node:crypto";
import type { ExtractedImportUploadIntent } from "@/domain/catalog/extraction-schema";
import type { AdminPrincipal } from "./admin-auth";
import { getDb } from "./db";
import { HttpError } from "./http-error";
import { createDatasheetImportObjectKey } from "./object-storage";
import { getStorageRuntimeConfig } from "./runtime-config";

export interface ExtractedImportUploadRecord {
  assetId: string;
  importId: string;
  objectKey: string;
  revisions: Array<{ exactModel: string; revisionId: string }>;
}

export async function createExtractedImportUploadRecord(
  principal: AdminPrincipal,
  input: ExtractedImportUploadIntent,
): Promise<ExtractedImportUploadRecord> {
  const sql = getDb();
  const storage = getStorageRuntimeConfig();
  const importId = randomUUID();
  const assetId = randomUUID();
  const objectKey = createDatasheetImportObjectKey({ assetId, importId });
  const category = input.extraction.template_id === "pv-module" ? "pv_module" : "inverter";

  try {
    return await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO asset (
          id, purpose, storage_provider, bucket, object_key, original_filename,
          media_type, size_bytes, sha256, state, uploaded_by
        ) VALUES (
          ${assetId}, 'datasheet', 's3', ${storage.bucket}, ${objectKey},
          ${input.filename}, ${input.mediaType}, ${input.sizeBytes}, ${input.sha256Hex},
          'pending_upload', ${principal.userId}::uuid
        )
      `;

      await transaction`
        INSERT INTO datasheet_extraction_import (
          id, asset_id, schema_id, schema_version, template_id, template_version,
          prompt_version, source_output, created_by
        ) VALUES (
          ${importId}::uuid,
          ${assetId}::uuid,
          ${input.extraction.schema_id},
          ${input.extraction.schema_version},
          ${input.extraction.template_id},
          ${input.extraction.template_version},
          ${input.extraction.prompt_version},
          ${transaction.json(input.extraction)},
          ${principal.userId}::uuid
        )
      `;

      const matchedManufacturers = await transaction<Array<{ id: string }>>`
        SELECT id::text AS id
        FROM manufacturer
        WHERE lower(name) = lower(${input.extraction.manufacturer.value})
        LIMIT 1
      `;
      const [manufacturer] = matchedManufacturers.length
        ? matchedManufacturers
        : await transaction<Array<{ id: string }>>`
            INSERT INTO manufacturer (name, status)
            VALUES (${input.extraction.manufacturer.value}, 'draft')
            RETURNING id::text AS id
          `;
      if (!manufacturer) throw new Error("MANUFACTURER_INSERT_FAILED");

      const revisions: ExtractedImportUploadRecord["revisions"] = [];
      for (const [modelIndex, model] of input.extraction.models.entries()) {
        const matchedProducts = await transaction<
          Array<{ category: "inverter" | "pv_module"; id: string }>
        >`
          SELECT id::text AS id, category::text AS category
          FROM product_model
          WHERE manufacturer_id = ${manufacturer.id}::uuid
            AND lower(exact_model) = lower(${model.exact_model})
            AND market = ${input.market.toUpperCase()}
          LIMIT 1
        `;
        const matchedProduct = matchedProducts[0];
        if (matchedProduct && matchedProduct.category !== category) {
          throw new HttpError(
            409,
            "PRODUCT_MODEL_CATEGORY_CONFLICT",
            `Model ${model.exact_model} มีอยู่แล้วในประเภทอื่น`,
          );
        }

        let productModelId = matchedProduct?.id;
        if (!productModelId) {
          const [createdProduct] = await transaction<Array<{ id: string }>>`
            INSERT INTO product_model (
              manufacturer_id, category, exact_model, market, status
            ) VALUES (
              ${manufacturer.id}::uuid,
              ${category},
              ${model.exact_model},
              ${input.market.toUpperCase()},
              'draft'
            )
            RETURNING id::text AS id
          `;
          productModelId = createdProduct?.id;
        }
        if (!productModelId) throw new Error("PRODUCT_MODEL_INSERT_FAILED");

        const existingRevisions = await transaction<Array<{ id: string }>>`
          SELECT id::text AS id
          FROM datasheet_revision
          WHERE product_model_id = ${productModelId}::uuid
            AND revision_label = ${input.revisionLabel}
          LIMIT 1
        `;
        if (existingRevisions[0]) {
          throw new HttpError(
            409,
            "DATASHEET_REVISION_EXISTS",
            `Model ${model.exact_model} มี revision ${input.revisionLabel} อยู่แล้ว`,
          );
        }

        const revisionId = randomUUID();
        await transaction`
          INSERT INTO datasheet_revision (
            id, product_model_id, revision_label, storage_key, sha256, language, state
          ) VALUES (
            ${revisionId}::uuid,
            ${productModelId}::uuid,
            ${input.revisionLabel},
            ${objectKey},
            ${input.sha256Hex},
            ${input.language.toLowerCase()},
            'draft'
          )
        `;
        await transaction`
          INSERT INTO datasheet_asset (datasheet_revision_id, asset_id, role)
          VALUES (${revisionId}::uuid, ${assetId}::uuid, 'original')
        `;
        await transaction`
          INSERT INTO datasheet_extraction_candidate (
            import_id, revision_id, model_index, model_json
          ) VALUES (
            ${importId}::uuid,
            ${revisionId}::uuid,
            ${modelIndex},
            ${transaction.json(model)}
          )
        `;
        revisions.push({ exactModel: model.exact_model, revisionId });
      }

      await transaction`
        INSERT INTO audit_event (
          actor_id, organization_id, action, entity_type, entity_id, after_json
        ) VALUES (
          ${principal.userId}::uuid,
          NULL,
          'datasheet.external_extraction_import.created',
          'datasheet_extraction_import',
          ${importId}::uuid,
          ${transaction.json({
            assetId,
            category,
            modelCount: revisions.length,
            revisionIds: revisions.map((revision) => revision.revisionId),
            schemaVersion: input.extraction.schema_version,
            templateId: input.extraction.template_id,
            templateVersion: input.extraction.template_version,
          })}
        )
      `;

      return { assetId, importId, objectKey, revisions };
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
        "EXTRACTED_IMPORT_CONFLICT",
        "มี Model หรือ Revision ในชุดนำเข้านี้อยู่แล้ว กรุณาตรวจรายการเดิม",
      );
    }
    throw error;
  }
}
