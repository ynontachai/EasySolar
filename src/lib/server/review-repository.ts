import "server-only";
import {
  canPerform,
  evaluateFourEyes,
  evaluatePublishGates,
  evaluateVerifyGates,
  type ReviewRole,
  type RevisionAction,
  type RevisionState,
} from "@/domain/catalog/review-workflow";
import { isSuperAdmin, type AdminPrincipal } from "./admin-auth";
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
        isSuperAdmin: isSuperAdmin(input.actor),
        overrideReason: input.overrideReason,
        specEnteredBy: revision.specEnteredBy,
      });
      if (!fourEyes.allowed) {
        throw new HttpError(
          403,
          "FOUR_EYES_REQUIRED",
          "ผู้ที่กรอกสเปกห้ามยืนยันเอง Super Admin ต้องระบุเหตุผลเพื่อ override",
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
        ${transaction.json({ state: next, confirmedFields: input.confirmedFields })},
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
