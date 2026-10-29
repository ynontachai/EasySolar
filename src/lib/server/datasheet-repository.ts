import "server-only";
import { randomUUID } from "node:crypto";
import type { AssetState } from "@/domain/assets/config";
import {
  assetIdSchema,
  type DatasheetUploadIntentInput,
} from "@/domain/assets/schemas";
import { getDb, isDatabaseConfigured } from "./db";
import { HttpError } from "./http-error";
import { createDatasheetObjectKey } from "./object-storage";
import { getStorageRuntimeConfig } from "./runtime-config";

export interface DatasheetUploadRecord {
  assetId: string;
  objectKey: string;
  productModelId: string;
  revisionId: string;
}

export interface FinalizableAsset {
  assetId: string;
  mediaType: string;
  objectKey: string;
  originalFilename: string;
  sha256: string;
  sizeBytes: number;
  state: AssetState;
}

export interface PublishedCatalogItem {
  assetState: AssetState | null;
  category: "pv_module" | "inverter";
  downloadPath: string | null;
  exactModel: string;
  id: string;
  manufacturer: string;
  primarySpec: string;
  revisionId: string;
  revisionLabel: string;
  secondarySpec: string;
  verificationStatus: "verified" | "published";
}

export async function createDatasheetUploadRecord(
  input: DatasheetUploadIntentInput,
): Promise<DatasheetUploadRecord> {
  const sql = getDb();
  const storage = getStorageRuntimeConfig();
  const productModelId = randomUUID();
  const revisionId = randomUUID();
  const assetId = randomUUID();
  const objectKey = createDatasheetObjectKey({
    assetId,
    productModelId,
    revisionId,
  });

  return sql.begin(async (transaction) => {
    const [manufacturer] = await transaction<{ id: string }[]>`
      INSERT INTO manufacturer (name, status)
      VALUES (${input.manufacturer}, 'draft')
      ON CONFLICT (name)
      DO UPDATE SET updated_at = now()
      RETURNING id::text
    `;

    const [product] = await transaction<{ id: string }[]>`
      INSERT INTO product_model (
        id,
        manufacturer_id,
        category,
        exact_model,
        market,
        status
      )
      VALUES (
        ${productModelId},
        ${manufacturer.id},
        ${input.category},
        ${input.exactModel},
        ${input.market.toUpperCase()},
        'draft'
      )
      ON CONFLICT (manufacturer_id, exact_model, market)
      DO UPDATE SET updated_at = now()
      RETURNING id::text
    `;

    const [existingRevision] = await transaction<{ id: string }[]>`
      SELECT id::text
      FROM datasheet_revision
      WHERE product_model_id = ${product.id}
        AND revision_label = ${input.revisionLabel}
      LIMIT 1
    `;

    if (existingRevision) {
      throw new HttpError(
        409,
        "DATASHEET_REVISION_EXISTS",
        "Revision นี้มีอยู่แล้ว กรุณาสร้าง revision label ใหม่",
      );
    }

    await transaction`
      INSERT INTO datasheet_revision (
        id,
        product_model_id,
        revision_label,
        storage_key,
        sha256,
        language,
        state
      )
      VALUES (
        ${revisionId},
        ${product.id},
        ${input.revisionLabel},
        ${objectKey},
        ${input.sha256Hex},
        ${input.language.toLowerCase()},
        'draft'
      )
    `;

    await transaction`
      INSERT INTO asset (
        id,
        purpose,
        storage_provider,
        bucket,
        object_key,
        original_filename,
        media_type,
        size_bytes,
        sha256,
        state
      )
      VALUES (
        ${assetId},
        'datasheet',
        's3',
        ${storage.bucket},
        ${objectKey},
        ${input.filename},
        ${input.mediaType},
        ${input.sizeBytes},
        ${input.sha256Hex},
        'pending_upload'
      )
    `;

    await transaction`
      INSERT INTO datasheet_asset (datasheet_revision_id, asset_id, role)
      VALUES (${revisionId}, ${assetId}, 'original')
    `;

    return {
      assetId,
      objectKey,
      productModelId: product.id,
      revisionId,
    };
  });
}

export async function getFinalizableAsset(assetId: string): Promise<FinalizableAsset> {
  const sql = getDb();
  const [asset] = await sql<
    Array<{
      assetId: string;
      mediaType: string;
      objectKey: string;
      originalFilename: string;
      sha256: string;
      sizeBytes: string;
      state: AssetState;
    }>
  >`
    SELECT
      id::text AS "assetId",
      media_type AS "mediaType",
      object_key AS "objectKey",
      original_filename AS "originalFilename",
      sha256,
      size_bytes::text AS "sizeBytes",
      state
    FROM asset
    WHERE id = ${assetId}
    LIMIT 1
  `;

  if (!asset) {
    throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์ที่ระบุ");
  }

  if (asset.state !== "pending_upload" && asset.state !== "uploaded") {
    throw new HttpError(
      409,
      "ASSET_NOT_FINALIZABLE",
      `ไฟล์อยู่ในสถานะ ${asset.state} และ finalize ไม่ได้`,
    );
  }

  return { ...asset, sizeBytes: Number(asset.sizeBytes) };
}

export async function finalizeAssetRecord(input: {
  assetId: string;
  etag: string | null;
  state: "available" | "scanning";
}) {
  const sql = getDb();
  const [asset] = await sql<Array<{ state: AssetState }>>`
    UPDATE asset
    SET
      etag = ${input.etag},
      state = ${input.state},
      uploaded_at = COALESCE(uploaded_at, now()),
      available_at = CASE WHEN ${input.state} = 'available' THEN now() ELSE available_at END,
      updated_at = now()
    WHERE id = ${input.assetId}
    RETURNING state
  `;

  return asset.state;
}

export async function recordAssetScanVerdict(input: {
  assetId: string;
  details: Record<string, unknown>;
  scanner: string;
  verdict: "clean" | "infected" | "error";
}) {
  const sql = getDb();

  return sql.begin(async (transaction) => {
    const [existing] = await transaction<{ state: AssetState }[]>`
      SELECT state FROM asset WHERE id = ${input.assetId} FOR UPDATE
    `;

    if (!existing) {
      throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์ที่ระบุ");
    }

    await transaction`
      INSERT INTO asset_scan_event (asset_id, scanner, verdict, details_json)
      VALUES (
        ${input.assetId},
        ${input.scanner},
        ${input.verdict},
        ${JSON.stringify(input.details)}::jsonb
      )
    `;

    const nextState: AssetState =
      input.verdict === "clean"
        ? "available"
        : input.verdict === "infected"
          ? "quarantined"
          : "scanning";

    const [updated] = await transaction<{ state: AssetState }[]>`
      UPDATE asset
      SET
        state = ${nextState},
        available_at = CASE WHEN ${nextState} = 'available' THEN now() ELSE available_at END,
        quarantined_at = CASE WHEN ${nextState} = 'quarantined' THEN now() ELSE quarantined_at END,
        updated_at = now()
      WHERE id = ${input.assetId}
      RETURNING state
    `;

    return updated.state;
  });
}

export async function findDownloadableDatasheet(revisionId: string) {
  const sql = getDb();
  const [asset] = await sql<
    Array<{ filename: string; objectKey: string }>
  >`
    SELECT
      asset.original_filename AS filename,
      asset.object_key AS "objectKey"
    FROM datasheet_revision
    JOIN datasheet_asset
      ON datasheet_asset.datasheet_revision_id = datasheet_revision.id
      AND datasheet_asset.role = 'original'
    JOIN asset ON asset.id = datasheet_asset.asset_id
    WHERE datasheet_revision.id = ${revisionId}
      AND datasheet_revision.state IN ('verified', 'published')
      AND asset.state = 'available'
    LIMIT 1
  `;

  if (!asset) {
    throw new HttpError(
      404,
      "DATASHEET_NOT_AVAILABLE",
      "Datasheet นี้ยังไม่ผ่านการตรวจหรือยังไม่พร้อมดาวน์โหลด",
    );
  }

  return asset;
}

export async function listPublishedCatalogItems(): Promise<
  PublishedCatalogItem[] | null
> {
  if (!isDatabaseConfigured()) return null;

  const sql = getDb();
  const rows = await sql<
    Array<{
      assetState: AssetState | null;
      category: "pv_module" | "inverter";
      exactModel: string;
      id: string;
      manufacturer: string;
      pmaxWp: string | null;
      ratedAcKw: string | null;
      revisionId: string;
      revisionLabel: string;
      trackerCount: string | null;
      verificationStatus: "verified" | "published";
      vmpV: string | null;
      vocV: string | null;
      maxDcVoltageV: string | null;
    }>
  >`
    SELECT
      product_model.id::text AS id,
      product_model.category,
      product_model.exact_model AS "exactModel",
      manufacturer.name AS manufacturer,
      datasheet_revision.id::text AS "revisionId",
      datasheet_revision.revision_label AS "revisionLabel",
      datasheet_revision.state AS "verificationStatus",
      asset.state AS "assetState",
      pv_module_spec.pmax_wp::text AS "pmaxWp",
      pv_module_spec.voc_v::text AS "vocV",
      pv_module_spec.vmp_v::text AS "vmpV",
      inverter_spec.rated_ac_kw::text AS "ratedAcKw",
      inverter_spec.max_dc_voltage_v::text AS "maxDcVoltageV",
      COUNT(mppt_tracker.id)::text AS "trackerCount"
    FROM product_model
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    JOIN datasheet_revision ON datasheet_revision.product_model_id = product_model.id
    LEFT JOIN pv_module_spec
      ON pv_module_spec.datasheet_revision_id = datasheet_revision.id
    LEFT JOIN inverter_spec
      ON inverter_spec.datasheet_revision_id = datasheet_revision.id
    LEFT JOIN mppt_tracker
      ON mppt_tracker.inverter_revision_id = inverter_spec.datasheet_revision_id
    LEFT JOIN datasheet_asset
      ON datasheet_asset.datasheet_revision_id = datasheet_revision.id
      AND datasheet_asset.role = 'original'
    LEFT JOIN asset ON asset.id = datasheet_asset.asset_id
    WHERE product_model.status IN ('verified', 'published')
      AND datasheet_revision.state IN ('verified', 'published')
    GROUP BY
      product_model.id,
      manufacturer.name,
      datasheet_revision.id,
      asset.state,
      pv_module_spec.pmax_wp,
      pv_module_spec.voc_v,
      pv_module_spec.vmp_v,
      inverter_spec.rated_ac_kw,
      inverter_spec.max_dc_voltage_v
    ORDER BY manufacturer.name, product_model.exact_model
  `;

  return rows.map((row) => {
    const isModule = row.category === "pv_module";
    return {
      assetState: row.assetState,
      category: row.category,
      downloadPath:
        row.assetState === "available"
          ? `/api/v1/datasheets/${row.revisionId}/download`
          : null,
      exactModel: row.exactModel,
      id: row.id,
      manufacturer: row.manufacturer,
      primarySpec: isModule
        ? `${Number(row.pmaxWp)} Wp`
        : `${Number(row.ratedAcKw)} kW`,
      revisionId: row.revisionId,
      revisionLabel: row.revisionLabel,
      secondarySpec: isModule
        ? `${Number(row.vocV)} Voc · ${Number(row.vmpV)} Vmp`
        : `${Number(row.trackerCount)} MPPT · ${Number(row.maxDcVoltageV)} Vdc max`,
      verificationStatus: row.verificationStatus,
    };
  });
}

export async function findPublishedEquipmentRevisions(equipmentId: string) {
  if (!isDatabaseConfigured()) return null;
  if (!assetIdSchema.safeParse(equipmentId).success) return [];

  const sql = getDb();
  const revisions = await sql<
    Array<{
      assetState: AssetState | null;
      revisionId: string;
      revisionLabel: string;
      verificationStatus: "verified" | "published";
      verifiedAt: string | null;
    }>
  >`
    SELECT
      datasheet_revision.id::text AS "revisionId",
      datasheet_revision.revision_label AS "revisionLabel",
      datasheet_revision.state AS "verificationStatus",
      datasheet_revision.verified_at::text AS "verifiedAt",
      asset.state AS "assetState"
    FROM datasheet_revision
    LEFT JOIN datasheet_asset
      ON datasheet_asset.datasheet_revision_id = datasheet_revision.id
      AND datasheet_asset.role = 'original'
    LEFT JOIN asset ON asset.id = datasheet_asset.asset_id
    WHERE datasheet_revision.product_model_id = ${equipmentId}
      AND datasheet_revision.state IN ('verified', 'published')
    ORDER BY datasheet_revision.issue_date DESC NULLS LAST, datasheet_revision.created_at DESC
  `;

  return revisions.map((revision) => ({
    ...revision,
    downloadPath:
      revision.assetState === "available"
        ? `/api/v1/datasheets/${revision.revisionId}/download`
        : null,
  }));
}
