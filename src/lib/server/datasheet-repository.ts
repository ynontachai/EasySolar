import "server-only";
import { randomUUID } from "node:crypto";
import type { AssetState } from "@/domain/assets/config";
import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";
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

export interface PendingScanAsset {
  assetId: string;
  filename: string;
  objectKey: string;
  sha256: string;
  sizeBytes: number;
}

export interface PublishedCatalogItem {
  assetState: AssetState | null;
  category: "pv_module" | "inverter";
  downloadPath: string | null;
  exactModel: string;
  id: string;
  imageAlt: string | null;
  imageAssetId: string | null;
  manufacturer: string;
  primarySpec: string;
  revisionId: string;
  revisionLabel: string;
  secondarySpec: string;
  verificationStatus: "verified" | "published";
}

export interface PublishedEquipmentOption {
  category: "inverter" | "pv_module";
  id: string;
  label: string;
  revisionLabel: string;
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
    const [existing] = await transaction<{ sha256: string; state: AssetState }[]>`
      SELECT sha256, state FROM asset WHERE id = ${input.assetId} FOR UPDATE
    `;

    if (!existing) {
      throw new HttpError(404, "ASSET_NOT_FOUND", "ไม่พบไฟล์ที่ระบุ");
    }

    if (existing.state !== "scanning") {
      throw new HttpError(
        409,
        "ASSET_NOT_SCANNING",
        `ไฟล์อยู่ในสถานะ ${existing.state} และไม่รับผลสแกนซ้ำ`,
      );
    }

    const targetAssetIds =
      input.verdict === "error"
        ? [input.assetId]
        : (
            await transaction<Array<{ assetId: string }>>`
              SELECT id::text AS "assetId"
              FROM asset
              WHERE purpose = 'datasheet'
                AND state = 'scanning'
                AND sha256 = ${existing.sha256}
              FOR UPDATE
            `
          ).map((asset) => asset.assetId);

    await transaction`
      INSERT INTO asset_scan_event (asset_id, scanner, verdict, details_json)
      SELECT
        target.id,
        ${input.scanner},
        ${input.verdict},
        ${JSON.stringify(input.details)}::jsonb
      FROM unnest(${targetAssetIds}::uuid[]) AS target(id)
    `;

    const nextState: AssetState =
      input.verdict === "clean"
        ? "available"
        : input.verdict === "infected"
          ? "quarantined"
          : "scanning";

    const updated = await transaction<Array<{ state: AssetState }>>`
      UPDATE asset
      SET
        state = ${nextState},
        available_at = CASE WHEN ${nextState} = 'available' THEN now() ELSE available_at END,
        quarantined_at = CASE WHEN ${nextState} = 'quarantined' THEN now() ELSE quarantined_at END,
        updated_at = now()
      WHERE id = ANY(${targetAssetIds}::uuid[])
      RETURNING state
    `;

    return { affectedAssetCount: updated.length, state: nextState };
  });
}

export async function listPendingScanAssets(limit: number): Promise<PendingScanAsset[]> {
  const sql = getDb();
  const rows = await sql<Array<Omit<PendingScanAsset, "sizeBytes"> & { sizeBytes: string }>>`
    SELECT DISTINCT ON (asset.sha256)
      asset.id::text AS "assetId",
      asset.original_filename AS filename,
      asset.object_key AS "objectKey",
      asset.sha256,
      asset.size_bytes::text AS "sizeBytes"
    FROM asset
    WHERE asset.purpose = 'datasheet'
      AND asset.state = 'scanning'
    ORDER BY asset.sha256, asset.created_at
    LIMIT ${limit}
  `;

  return rows.map((row) => ({ ...row, sizeBytes: Number(row.sizeBytes) }));
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

export async function listPublishedCatalogItems(filters: {
  categories?: Array<"inverter" | "pv_module">;
  query?: string;
} = {}): Promise<
  PublishedCatalogItem[] | null
> {
  if (!isDatabaseConfigured()) return null;

  const sql = getDb();
  const search = filters.query?.trim();
  const categories = filters.categories ?? [];
  const searchFilter = search
    ? sql`AND (
        manufacturer.name ILIKE ${`%${search}%`}
        OR product_model.exact_model ILIKE ${`%${search}%`}
      )`
    : sql``;
  const categoryFilter = categories.length
    ? sql`AND product_model.category IN ${sql(categories)}`
    : sql``;
  const rows = await sql<
    Array<{
      assetState: AssetState | null;
      category: "pv_module" | "inverter";
      exactModel: string;
      id: string;
      imageAlt: string | null;
      imageAssetId: string | null;
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
      primary_media.asset_id::text AS "imageAssetId",
      primary_media.alt_text AS "imageAlt",
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
    LEFT JOIN LATERAL (
      SELECT product_media.asset_id, product_media.alt_text
      FROM product_media
      JOIN asset AS media_asset ON media_asset.id = product_media.asset_id
      WHERE product_media.product_model_id = product_model.id
        AND product_media.role = 'primary'
        AND media_asset.state = 'available'
      ORDER BY product_media.created_at DESC
      LIMIT 1
    ) AS primary_media ON true
    WHERE product_model.status = 'published'
      AND datasheet_revision.state = 'published'
      ${searchFilter}
      ${categoryFilter}
    GROUP BY
      product_model.id,
      manufacturer.name,
      primary_media.asset_id,
      primary_media.alt_text,
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
      imageAlt: row.imageAlt,
      imageAssetId: row.imageAssetId,
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

export async function listPublishedEquipmentOptions(): Promise<PublishedEquipmentOption[]> {
  const items = await listPublishedCatalogItems();
  if (!items) return [];
  return items.map((item) => ({
    category: item.category,
    id: item.id,
    label: `${item.manufacturer} · ${item.exactModel}`,
    revisionLabel: item.revisionLabel,
  }));
}

export async function findPublishedPvModule(id: string): Promise<PvModuleSpec | null> {
  if (!isDatabaseConfigured()) return null;
  const sql = getDb();
  const [row] = await sql<Array<{
    betaVmpPerC: string | null;
    betaVocPerC: string | null;
    exactModel: string;
    impA: string;
    iscA: string;
    manufacturer: string;
    market: string;
    maxSystemVoltageV: string;
    pmaxWp: string;
    revisionId: string;
    revisionLabel: string;
    verifiedAt: string;
    vmpV: string;
    vocV: string;
    bifacialityFactor: string | null;
  }>>`
    SELECT
      manufacturer.name AS manufacturer,
      product_model.exact_model AS "exactModel",
      product_model.market,
      datasheet_revision.id::text AS "revisionId",
      datasheet_revision.revision_label AS "revisionLabel",
      datasheet_revision.verified_at::text AS "verifiedAt",
      pv_module_spec.pmax_wp::text AS "pmaxWp",
      pv_module_spec.voc_v::text AS "vocV",
      pv_module_spec.vmp_v::text AS "vmpV",
      pv_module_spec.isc_a::text AS "iscA",
      pv_module_spec.imp_a::text AS "impA",
      pv_module_spec.beta_voc_per_c::text AS "betaVocPerC",
      pv_module_spec.beta_vmp_per_c::text AS "betaVmpPerC",
      pv_module_spec.max_system_voltage_v::text AS "maxSystemVoltageV",
      pv_module_spec.bifaciality_factor::text AS "bifacialityFactor"
    FROM product_model
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    JOIN datasheet_revision ON datasheet_revision.product_model_id = product_model.id
    JOIN pv_module_spec ON pv_module_spec.datasheet_revision_id = datasheet_revision.id
    WHERE product_model.id = ${id}
      AND product_model.category = 'pv_module'
      AND product_model.status = 'published'
      AND datasheet_revision.state = 'published'
    ORDER BY datasheet_revision.published_at DESC NULLS LAST
    LIMIT 1
  `;
  if (!row) return null;
  return {
    betaVmpPerC: row.betaVmpPerC === null ? null : Number(row.betaVmpPerC),
    betaVocPerC: row.betaVocPerC === null ? null : Number(row.betaVocPerC),
    datasheet: {
      revisionId: row.revisionId,
      revisionLabel: row.revisionLabel,
      sourceNote: "EasySolar verified datasheet",
      sourceUrl: null,
      verificationStatus: "verified",
      verifiedAt: row.verifiedAt,
    },
    id,
    impA: Number(row.impA),
    isBifacial: Number(row.bifacialityFactor ?? 0) > 0,
    iscA: Number(row.iscA),
    manufacturer: row.manufacturer,
    market: row.market,
    maxSystemVoltageV: Number(row.maxSystemVoltageV),
    model: row.exactModel,
    pmaxWp: Number(row.pmaxWp),
    vmpV: Number(row.vmpV),
    vocV: Number(row.vocV),
  };
}

export async function findPublishedInverter(id: string): Promise<InverterSpec | null> {
  if (!isDatabaseConfigured()) return null;
  const sql = getDb();
  const rows = await sql<Array<{
    exactModel: string;
    inputCount: number;
    manufacturer: string;
    market: string;
    maxDcPowerWp: string | null;
    maxDcVoltageV: string;
    maxOperatingCurrentA: string;
    maxRecommendedPvWp: string | null;
    maxShortCircuitCurrentA: string;
    mpptMaxV: string;
    mpptMinV: string;
    ratedAcKw: string;
    revisionId: string;
    revisionLabel: string;
    startupVoltageV: string | null;
    trackerIndex: number;
    verifiedAt: string;
  }>>`
    SELECT
      manufacturer.name AS manufacturer,
      product_model.exact_model AS "exactModel",
      product_model.market,
      datasheet_revision.id::text AS "revisionId",
      datasheet_revision.revision_label AS "revisionLabel",
      datasheet_revision.verified_at::text AS "verifiedAt",
      inverter_spec.rated_ac_kw::text AS "ratedAcKw",
      inverter_spec.max_dc_voltage_v::text AS "maxDcVoltageV",
      inverter_spec.max_dc_power_wp::text AS "maxDcPowerWp",
      inverter_spec.max_recommended_pv_wp::text AS "maxRecommendedPvWp",
      inverter_spec.startup_voltage_v::text AS "startupVoltageV",
      mppt_tracker.tracker_index AS "trackerIndex",
      mppt_tracker.mppt_min_v::text AS "mpptMinV",
      mppt_tracker.mppt_max_v::text AS "mpptMaxV",
      mppt_tracker.max_operating_current_a::text AS "maxOperatingCurrentA",
      mppt_tracker.max_short_circuit_current_a::text AS "maxShortCircuitCurrentA",
      mppt_tracker.input_count AS "inputCount"
    FROM product_model
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    JOIN datasheet_revision ON datasheet_revision.product_model_id = product_model.id
    JOIN inverter_spec ON inverter_spec.datasheet_revision_id = datasheet_revision.id
    JOIN mppt_tracker ON mppt_tracker.inverter_revision_id = datasheet_revision.id
    WHERE product_model.id = ${id}
      AND product_model.category = 'inverter'
      AND product_model.status = 'published'
      AND datasheet_revision.state = 'published'
    ORDER BY datasheet_revision.published_at DESC NULLS LAST, mppt_tracker.tracker_index
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    datasheet: {
      revisionId: row.revisionId,
      revisionLabel: row.revisionLabel,
      sourceNote: "EasySolar verified datasheet",
      sourceUrl: null,
      verificationStatus: "verified",
      verifiedAt: row.verifiedAt,
    },
    id,
    manufacturer: row.manufacturer,
    market: row.market,
    maxDcPowerWp: row.maxDcPowerWp === null ? null : Number(row.maxDcPowerWp),
    maxDcVoltageV: Number(row.maxDcVoltageV),
    maxRecommendedPvWp: row.maxRecommendedPvWp === null ? null : Number(row.maxRecommendedPvWp),
    model: row.exactModel,
    ratedAcKw: Number(row.ratedAcKw),
    startupVoltageV: row.startupVoltageV === null ? null : Number(row.startupVoltageV),
    trackers: rows
      .filter((item) => item.revisionId === row.revisionId)
      .map((item) => ({
        inputCount: item.inputCount,
        maxOperatingCurrentA: Number(item.maxOperatingCurrentA),
        maxShortCircuitCurrentA: Number(item.maxShortCircuitCurrentA),
        mpptMaxV: Number(item.mpptMaxV),
        mpptMinV: Number(item.mpptMinV),
        trackerIndex: item.trackerIndex,
      })),
  };
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
