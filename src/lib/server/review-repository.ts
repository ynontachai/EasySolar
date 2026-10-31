import "server-only";
import {
  percentToFraction,
  type InverterSpecInput,
  type PvSpecInput,
} from "@/domain/catalog/spec-schemas";
import {
  canPerform,
  evaluateFourEyes,
  evaluatePublishGates,
  evaluateVerifyGates,
  type ReviewRole,
  type RevisionAction,
  type RevisionState,
} from "@/domain/catalog/review-workflow";
import type { AdminPrincipal } from "./admin-auth";
import { getDb } from "./db";
import { HttpError } from "./http-error";

export interface ReviewQueueRow {
  assetState: string | null;
  category: "inverter" | "pv_module";
  exactModel: string;
  hasSourceUrl: boolean;
  manufacturer: string;
  productModelId: string;
  revisionId: string;
  revisionLabel: string;
  specEnteredBy: string | null;
  state: RevisionState;
}

const nextState: Record<RevisionAction, RevisionState> = {
  enter_spec: "extracted_unverified",
  publish: "published",
  recall: "recalled",
  reject: "draft",
  verify: "verified",
};

export async function listReviewQueue(): Promise<ReviewQueueRow[]> {
  const sql = getDb();

  return sql<ReviewQueueRow[]>`
    SELECT
      datasheet_revision.id::text AS "revisionId",
      datasheet_revision.revision_label AS "revisionLabel",
      datasheet_revision.state::text AS state,
      datasheet_revision.spec_entered_by::text AS "specEnteredBy",
      (datasheet_revision.source_url IS NOT NULL) AS "hasSourceUrl",
      asset.state::text AS "assetState",
      product_model.id::text AS "productModelId",
      product_model.exact_model AS "exactModel",
      product_model.category::text AS category,
      manufacturer.name AS manufacturer
    FROM datasheet_revision
    JOIN product_model ON product_model.id = datasheet_revision.product_model_id
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    LEFT JOIN datasheet_asset
      ON datasheet_asset.datasheet_revision_id = datasheet_revision.id
      AND datasheet_asset.role = 'original'
    LEFT JOIN asset ON asset.id = datasheet_asset.asset_id
    WHERE datasheet_revision.state IN ('draft', 'extracted_unverified', 'verified')
    ORDER BY datasheet_revision.created_at DESC
    LIMIT 100
  `;
}

export async function applyReviewAction(input: {
  action: RevisionAction;
  actor: AdminPrincipal;
  confirmedFields: string[];
  note: string | null;
  overrideReason: string | null;
  reason: string | null;
  revisionId: string;
}) {
  const sql = getDb();
  const roles = input.actor.roles.map((role) => role.code as ReviewRole);
  const eventReason =
    input.reason ?? input.overrideReason ?? input.note ?? `${input.action} by reviewer`;

  return sql.begin(async (transaction) => {
    const [revision] = await transaction<
      Array<{
        category: "inverter" | "pv_module";
        hasAvailableFile: boolean;
        hasSourceUrl: boolean;
        hasSpec: boolean;
        productModelId: string;
        sourcePages: Record<string, string | undefined>;
        specEnteredBy: string | null;
        state: RevisionState;
      }>
    >`
      SELECT
        datasheet_revision.state::text AS state,
        datasheet_revision.product_model_id::text AS "productModelId",
        product_model.category::text AS category,
        datasheet_revision.spec_entered_by::text AS "specEnteredBy",
        datasheet_revision.spec_source_pages AS "sourcePages",
        (datasheet_revision.source_url IS NOT NULL) AS "hasSourceUrl",
        EXISTS (
          SELECT 1
          FROM datasheet_asset
          JOIN asset ON asset.id = datasheet_asset.asset_id
          WHERE datasheet_asset.datasheet_revision_id = datasheet_revision.id
            AND datasheet_asset.role = 'original'
            AND asset.state = 'available'
        ) AS "hasAvailableFile",
        (
          EXISTS (SELECT 1 FROM pv_module_spec WHERE pv_module_spec.datasheet_revision_id = datasheet_revision.id)
          OR EXISTS (SELECT 1 FROM inverter_spec WHERE inverter_spec.datasheet_revision_id = datasheet_revision.id)
        ) AS "hasSpec"
      FROM datasheet_revision
      JOIN product_model ON product_model.id = datasheet_revision.product_model_id
      WHERE datasheet_revision.id = ${input.revisionId}
      FOR UPDATE OF datasheet_revision
    `;

    if (!revision) {
      throw new HttpError(404, "REVISION_NOT_FOUND", "ไม่พบ Datasheet revision ที่ระบุ");
    }

    if (!canPerform(input.action, revision.state, roles)) {
      throw new HttpError(
        403,
        "REVIEW_ACTION_NOT_ALLOWED",
        "สิทธิ์หรือสถานะของ revision นี้ไม่อนุญาตให้ทำรายการนี้",
      );
    }

    if (input.action === "verify") {
      if (!revision.hasSpec) {
        throw new HttpError(409, "SPEC_MISSING", "ยังไม่มีสเปกที่กรอกสำหรับ revision นี้");
      }

      const fourEyes = evaluateFourEyes({
        actorId: input.actor.userId,
        overrideReason: input.overrideReason,
        specEnteredBy: revision.specEnteredBy,
      });
      if (!fourEyes.allowed) {
        throw new HttpError(
          403,
          "FOUR_EYES_REQUIRED",
          "ผู้ที่กรอกสเปกยืนยันเองได้ต่อเมื่อระบุเหตุผลอย่างน้อย 10 ตัวอักษร (บันทึกไว้)",
        );
      }

      const gate = evaluateVerifyGates({
        category: revision.category,
        confirmedFields: input.confirmedFields,
        sourcePages: revision.sourcePages,
        state: revision.state,
      });
      if (!gate.ready) throw new HttpError(409, "VERIFY_GATES_FAILED", gate.blockers.join(" · "));
    }

    if (input.action === "publish") {
      const gate = evaluatePublishGates({
        hasAvailableFile: revision.hasAvailableFile,
        hasSourceUrl: revision.hasSourceUrl,
        state: revision.state,
      });
      if (!gate.ready) throw new HttpError(409, "PUBLISH_GATES_FAILED", gate.blockers.join(" · "));
    }

    const next = nextState[input.action];

    // Supersede the previous published revision first so the one-published index holds.
    if (next === "published") {
      await transaction`
        UPDATE datasheet_revision
        SET state = 'superseded'
        WHERE product_model_id = ${revision.productModelId}::uuid
          AND state = 'published'
          AND id <> ${input.revisionId}::uuid
      `;
    }

    await transaction`
      UPDATE datasheet_revision
      SET
        state = ${next}::record_status,
        verified_at = CASE WHEN ${next} = 'verified' THEN now() ELSE verified_at END,
        verified_by = CASE WHEN ${next} = 'verified' THEN ${input.actor.userId}::uuid ELSE verified_by END,
        published_at = CASE WHEN ${next} = 'published' THEN now() ELSE published_at END,
        review_note = COALESCE(${eventReason}, review_note)
      WHERE id = ${input.revisionId}::uuid
    `;

    if (next === "published") {
      await transaction`
        UPDATE product_model SET status = 'published', updated_at = now()
        WHERE id = ${revision.productModelId}::uuid
      `;
    }
    if (next === "recalled") {
      await transaction`
        UPDATE product_model SET status = 'recalled', updated_at = now()
        WHERE id = ${revision.productModelId}::uuid
      `;
    }

    await transaction`
      INSERT INTO verification_event (
        datasheet_revision_id, field_path, old_value, new_value, reason, actor_id
      ) VALUES (
        ${input.revisionId}::uuid,
        'state',
        ${transaction.json({ state: revision.state })},
        ${transaction.json({
          confirmedFields: input.confirmedFields,
          selfVerified: input.action === "verify" && revision.specEnteredBy === input.actor.userId,
          state: next,
        })},
        ${eventReason},
        ${input.actor.userId}::uuid
      )
    `;

    await transaction`
      INSERT INTO audit_event (
        actor_id, organization_id, action, entity_type, entity_id, before_json, after_json
      ) VALUES (
        ${input.actor.userId}::uuid,
        NULL,
        ${`revision.${input.action}`},
        'datasheet_revision',
        ${input.revisionId}::uuid,
        ${transaction.json({ state: revision.state })},
        ${transaction.json({ state: next })}
      )
    `;

    return { next };
  });
}

const specValueKeys = [
  "betaVmpPercentPerC",
  "betaVocPercentPerC",
  "bifacialityFactor",
  "iscA",
  "impA",
  "inverterType",
  "maxDcPowerWp",
  "maxDcVoltageV",
  "maxRecommendedPvWp",
  "maxSystemVoltageV",
  "pmaxWp",
  "ratedAcKw",
  "startupVoltageV",
  "vmpV",
  "vocV",
] as const;

export interface RevisionSpecTarget {
  category: "inverter" | "pv_module";
  exactModel: string;
  manufacturer: string;
  revisionId: string;
  revisionLabel: string;
  state: RevisionState;
  // Flat form defaults keyed by input name. Empty when the spec has not been entered yet.
  values: Record<string, string>;
  trackers: Array<Record<string, string>>;
}

export async function getRevisionSpecTarget(revisionId: string): Promise<RevisionSpecTarget | null> {
  const sql = getDb();

  const [row] = await sql<
    Array<{
      category: "inverter" | "pv_module";
      exactModel: string;
      manufacturer: string;
      revisionLabel: string;
      sourcePages: Record<string, string>;
      sourceUrl: string | null;
      state: RevisionState;
      betaVmpPercentPerC: string | null;
      betaVocPercentPerC: string | null;
      bifacialityFactor: string | null;
      iscA: string | null;
      impA: string | null;
      maxDcPowerWp: string | null;
      maxDcVoltageV: string | null;
      maxRecommendedPvWp: string | null;
      maxSystemVoltageV: string | null;
      pmaxWp: string | null;
      ratedAcKw: string | null;
      startupVoltageV: string | null;
      inverterType: string | null;
      vmpV: string | null;
      vocV: string | null;
    }>
  >`
    SELECT
      product_model.category::text AS category,
      product_model.exact_model AS "exactModel",
      manufacturer.name AS manufacturer,
      datasheet_revision.revision_label AS "revisionLabel",
      datasheet_revision.state::text AS state,
      datasheet_revision.source_url AS "sourceUrl",
      datasheet_revision.spec_source_pages AS "sourcePages",
      (pv_module_spec.beta_voc_per_c * 100)::text AS "betaVocPercentPerC",
      (pv_module_spec.beta_vmp_per_c * 100)::text AS "betaVmpPercentPerC",
      pv_module_spec.bifaciality_factor::text AS "bifacialityFactor",
      pv_module_spec.isc_a::text AS "iscA",
      pv_module_spec.imp_a::text AS "impA",
      pv_module_spec.max_system_voltage_v::text AS "maxSystemVoltageV",
      pv_module_spec.pmax_wp::text AS "pmaxWp",
      pv_module_spec.voc_v::text AS "vocV",
      pv_module_spec.vmp_v::text AS "vmpV",
      inverter_spec.inverter_type AS "inverterType",
      inverter_spec.max_dc_power_wp::text AS "maxDcPowerWp",
      inverter_spec.max_dc_voltage_v::text AS "maxDcVoltageV",
      inverter_spec.max_recommended_pv_wp::text AS "maxRecommendedPvWp",
      inverter_spec.rated_ac_kw::text AS "ratedAcKw",
      inverter_spec.startup_voltage_v::text AS "startupVoltageV"
    FROM datasheet_revision
    JOIN product_model ON product_model.id = datasheet_revision.product_model_id
    JOIN manufacturer ON manufacturer.id = product_model.manufacturer_id
    LEFT JOIN pv_module_spec ON pv_module_spec.datasheet_revision_id = datasheet_revision.id
    LEFT JOIN inverter_spec ON inverter_spec.datasheet_revision_id = datasheet_revision.id
    WHERE datasheet_revision.id = ${revisionId}::uuid
  `;

  if (!row) return null;

  const trackerRows = await sql<Array<Record<string, string>>>`
    SELECT
      input_count::text AS "inputCount",
      max_operating_current_a::text AS "maxOperatingCurrentA",
      max_short_circuit_current_a::text AS "maxShortCircuitCurrentA",
      mppt_min_v::text AS "mpptMinV",
      mppt_max_v::text AS "mpptMaxV"
    FROM mppt_tracker
    WHERE inverter_revision_id = ${revisionId}::uuid
    ORDER BY tracker_index
  `;

  const { category, exactModel, manufacturer, revisionLabel, sourcePages, sourceUrl, state } = row;
  const values: Record<string, string> = {};
  for (const key of specValueKeys) {
    const value = row[key];
    if (value) values[key] = value;
  }
  if (sourceUrl) values.sourceUrl = sourceUrl;
  for (const [key, value] of Object.entries(sourcePages ?? {})) {
    if (typeof value === "string") values[`sourcePages.${key}`] = value;
  }

  return {
    category,
    exactModel,
    manufacturer,
    revisionId,
    revisionLabel,
    state,
    trackers: trackerRows,
    values,
  };
}

export type EnterSpecInput =
  | { actor: AdminPrincipal; category: "pv_module"; revisionId: string; spec: PvSpecInput }
  | { actor: AdminPrincipal; category: "inverter"; revisionId: string; spec: InverterSpecInput };

// Writes the entered spec and moves the revision to extracted_unverified. Replaces any spec
// already on the revision so re-entry after "send back" does not leave stale rows.
export async function enterRevisionSpec(input: EnterSpecInput) {
  const sql = getDb();
  const roles = input.actor.roles.map((role) => role.code as ReviewRole);
  const sourcePages = input.spec.sourcePages;

  return sql.begin(async (transaction) => {
    const [revision] = await transaction<
      Array<{ category: "inverter" | "pv_module"; state: RevisionState }>
    >`
      SELECT
        datasheet_revision.state::text AS state,
        product_model.category::text AS category
      FROM datasheet_revision
      JOIN product_model ON product_model.id = datasheet_revision.product_model_id
      WHERE datasheet_revision.id = ${input.revisionId}::uuid
      FOR UPDATE OF datasheet_revision
    `;

    if (!revision) {
      throw new HttpError(404, "REVISION_NOT_FOUND", "ไม่พบ Datasheet revision ที่ระบุ");
    }
    if (revision.category !== input.category) {
      throw new HttpError(409, "CATEGORY_MISMATCH", "ประเภทสินค้าไม่ตรงกับ revision นี้");
    }
    if (!canPerform("enter_spec", revision.state, roles)) {
      throw new HttpError(
        403,
        "REVIEW_ACTION_NOT_ALLOWED",
        "สิทธิ์หรือสถานะของ revision นี้ไม่อนุญาตให้ทำรายการนี้",
      );
    }

    if (input.category === "pv_module") {
      const spec = input.spec;
      await transaction`
        DELETE FROM pv_module_spec WHERE datasheet_revision_id = ${input.revisionId}::uuid
      `;
      await transaction`
        INSERT INTO pv_module_spec (
          datasheet_revision_id,
          pmax_wp,
          voc_v,
          vmp_v,
          isc_a,
          imp_a,
          beta_voc_per_c,
          beta_vmp_per_c,
          bifaciality_factor,
          max_system_voltage_v
        )
        VALUES (
          ${input.revisionId}::uuid,
          ${spec.pmaxWp},
          ${spec.vocV},
          ${spec.vmpV},
          ${spec.iscA},
          ${spec.impA},
          ${percentToFraction(spec.betaVocPercentPerC)},
          ${percentToFraction(spec.betaVmpPercentPerC)},
          ${spec.bifacialityFactor},
          ${spec.maxSystemVoltageV}
        )
      `;
    } else {
      const spec = input.spec;
      await transaction`
        DELETE FROM mppt_tracker WHERE inverter_revision_id = ${input.revisionId}::uuid
      `;
      await transaction`
        DELETE FROM inverter_spec WHERE datasheet_revision_id = ${input.revisionId}::uuid
      `;
      await transaction`
        INSERT INTO inverter_spec (
          datasheet_revision_id,
          rated_ac_kw,
          max_dc_voltage_v,
          max_recommended_pv_wp,
          max_dc_power_wp,
          startup_voltage_v,
          inverter_type
        )
        VALUES (
          ${input.revisionId}::uuid,
          ${spec.ratedAcKw},
          ${spec.maxDcVoltageV},
          ${spec.maxRecommendedPvWp},
          ${spec.maxDcPowerWp},
          ${spec.startupVoltageV},
          ${spec.inverterType}
        )
      `;
      for (const [index, tracker] of spec.trackers.entries()) {
        await transaction`
          INSERT INTO mppt_tracker (
            inverter_revision_id,
            tracker_index,
            mppt_min_v,
            mppt_max_v,
            max_operating_current_a,
            max_short_circuit_current_a,
            input_count
          )
          VALUES (
            ${input.revisionId}::uuid,
            ${index + 1},
            ${tracker.mpptMinV},
            ${tracker.mpptMaxV},
            ${tracker.maxOperatingCurrentA},
            ${tracker.maxShortCircuitCurrentA},
            ${tracker.inputCount}
          )
        `;
      }
    }

    // source_url is kept when the form leaves it blank: uploaded revisions rely on storage_key,
    // and the table requires one of the two.
    await transaction`
      UPDATE datasheet_revision
      SET
        state = 'extracted_unverified',
        source_url = COALESCE(${input.spec.sourceUrl}, source_url),
        spec_source_pages = ${transaction.json(sourcePages)},
        spec_entered_by = ${input.actor.userId}::uuid,
        spec_entered_at = now(),
        review_note = NULL
      WHERE id = ${input.revisionId}::uuid
    `;

    await transaction`
      INSERT INTO verification_event (
        datasheet_revision_id, field_path, old_value, new_value, reason, actor_id
      ) VALUES (
        ${input.revisionId}::uuid,
        'state',
        ${transaction.json({ state: revision.state })},
        ${transaction.json({ state: "extracted_unverified" })},
        'enter_spec by reviewer',
        ${input.actor.userId}::uuid
      )
    `;

    await transaction`
      INSERT INTO audit_event (
        actor_id, organization_id, action, entity_type, entity_id, before_json, after_json
      ) VALUES (
        ${input.actor.userId}::uuid,
        NULL,
        'revision.enter_spec',
        'datasheet_revision',
        ${input.revisionId}::uuid,
        ${transaction.json({ state: revision.state })},
        ${transaction.json({ state: "extracted_unverified" })}
      )
    `;
  });
}
