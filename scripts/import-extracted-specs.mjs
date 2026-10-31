import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vaalsrnkiluepgzgifnb.supabase.co";
const IMPORT_ACTOR_ID = "d3afe4a7-cf00-41b2-a1a1-4de7acaf78cb";
const SOURCE_PAGE = "2";

function pv(model, pmaxWp, vocV, vmpV, iscA, impA, options) {
  return {
    category: "pv_module",
    model,
    spec: {
      betaVmpPercentPerC: null,
      betaVocPercentPerC: options.betaVocPercentPerC,
      bifacialityFactor: options.bifacialityFactor,
      impA,
      iscA,
      maxSystemVoltageV: options.maxSystemVoltageV,
      pmaxWp,
      sourcePages: {
        impA: SOURCE_PAGE,
        iscA: SOURCE_PAGE,
        maxSystemVoltageV: SOURCE_PAGE,
        pmaxWp: SOURCE_PAGE,
        vmpV: SOURCE_PAGE,
        vocV: SOURCE_PAGE,
      },
      vmpV,
      vocV,
    },
  };
}

function inverter(model, ratedAcKw, maxDcVoltageV, trackers, options) {
  return {
    category: "inverter",
    model,
    spec: {
      inverterType: options.inverterType,
      maxDcPowerWp: options.maxDcPowerWp ?? null,
      maxDcVoltageV,
      maxRecommendedPvWp: options.maxRecommendedPvWp ?? null,
      ratedAcKw,
      sourcePages: {
        maxDcVoltageV: SOURCE_PAGE,
        mpptCurrent: SOURCE_PAGE,
        mpptRange: SOURCE_PAGE,
        ratedAcKw: SOURCE_PAGE,
      },
      startupVoltageV: options.startupVoltageV ?? null,
      trackers,
    },
  };
}

function repeatedTrackers(count, inputCount, maxOperatingCurrentA, maxShortCircuitCurrentA, mpptMinV, mpptMaxV) {
  return Array.from({ length: count }, () => ({
    inputCount,
    maxOperatingCurrentA,
    maxShortCircuitCurrentA,
    mpptMaxV,
    mpptMinV,
  }));
}

const aikoOptions = {
  betaVocPercentPerC: -0.22,
  bifacialityFactor: 0.8,
  maxSystemVoltageV: 1500,
};
const longiOptions = {
  betaVocPercentPerC: -0.2,
  bifacialityFactor: 0.7,
  maxSystemVoltageV: 1500,
};

const specs = [
  pv("AIKO-A645-GRH66Dw", 645, 49.6, 40.59, 16.55, 15.89, aikoOptions),
  pv("AIKO-A650-GRH66Dw", 650, 49.7, 40.68, 16.64, 15.98, aikoOptions),
  pv("AIKO-A655-GRH66Dw", 655, 49.8, 40.8, 16.72, 16.06, aikoOptions),
  pv("AIKO-A660-GRH66Dw", 660, 49.9, 40.9, 16.8, 16.14, aikoOptions),
  pv("AIKO-A665-GRH66Dw", 665, 50, 41, 16.88, 16.22, aikoOptions),
  pv("AIKO-A670-GRH66Dw", 670, 50.1, 41.11, 16.96, 16.3, aikoOptions),
  pv("AIKO-A675-GRH66Dw", 675, 50.2, 41.21, 17.04, 16.38, aikoOptions),
  pv("AIKO-A765-GRH78Dw", 765, 58.62, 48.67, 16.57, 15.72, aikoOptions),
  pv("AIKO-A770-GRH78Dw", 770, 58.72, 48.77, 16.64, 15.79, aikoOptions),
  pv("AIKO-A775-GRH78Dw", 775, 58.82, 48.87, 16.71, 15.86, aikoOptions),
  pv("AIKO-A780-GRH78Dw", 780, 58.92, 48.97, 16.78, 15.93, aikoOptions),
  pv("AIKO-A785-GRH78Dw", 785, 59.02, 49.07, 16.85, 16, aikoOptions),
  pv("AIKO-A790-GRH78Dw", 790, 59.12, 49.17, 16.92, 16.07, aikoOptions),
  pv("AIKO-A795-GRH78Dw", 795, 59.22, 49.27, 16.99, 16.14, aikoOptions),
  pv("LR7-72HVD-625M", 625, 53.3, 44.16, 14.85, 14.16, longiOptions),
  pv("LR7-72HVD-630M", 630, 53.4, 44.26, 14.93, 14.24, longiOptions),
  pv("LR7-72HVD-635M", 635, 53.5, 44.36, 15.01, 14.32, longiOptions),
  pv("LR7-72HVD-640M", 640, 53.6, 44.46, 15.09, 14.4, longiOptions),
  pv("LR7-72HVD-645M", 645, 53.7, 44.56, 15.17, 14.48, longiOptions),
  pv("LP210*210-M-66-NB-715W", 715, 48.8, 40.8, 18.61, 17.52, {
    betaVocPercentPerC: -0.25,
    bifacialityFactor: 0.8,
    maxSystemVoltageV: 1500,
  }),

  inverter("SUN2000-3KTL-M1", 3, 1100, repeatedTrackers(2, 1, 11, 15, 140, 980), {
    inverterType: "hybrid", maxRecommendedPvWp: 4500, startupVoltageV: 200,
  }),
  inverter("SUN2000-4KTL-M1", 4, 1100, repeatedTrackers(2, 1, 11, 15, 140, 980), {
    inverterType: "hybrid", maxRecommendedPvWp: 6000, startupVoltageV: 200,
  }),
  inverter("SUN2000-5KTL-M1", 5, 1100, repeatedTrackers(2, 1, 11, 15, 140, 980), {
    inverterType: "hybrid", maxRecommendedPvWp: 7500, startupVoltageV: 200,
  }),
  inverter("SUN2000-6KTL-M1", 6, 1100, repeatedTrackers(2, 1, 11, 15, 140, 980), {
    inverterType: "hybrid", maxRecommendedPvWp: 9000, startupVoltageV: 200,
  }),
  inverter("SUN2000-8KTL-M1", 8, 1100, repeatedTrackers(2, 1, 11, 15, 140, 980), {
    inverterType: "hybrid", maxRecommendedPvWp: 12000, startupVoltageV: 200,
  }),
  inverter("SUN2000-10KTL-M1", 10, 1100, repeatedTrackers(2, 1, 11, 15, 140, 980), {
    inverterType: "hybrid", maxRecommendedPvWp: 15000, startupVoltageV: 200,
  }),
  inverter("SUN2000-8K-LC0", 8, 600, repeatedTrackers(3, 1, 16, 20, 40, 560), {
    inverterType: "hybrid", maxRecommendedPvWp: 12000, startupVoltageV: 50,
  }),
  inverter("SUN2000-10K-LC0", 10, 600, repeatedTrackers(3, 1, 16, 20, 40, 560), {
    inverterType: "hybrid", maxRecommendedPvWp: 15000, startupVoltageV: 50,
  }),

  inverter("SUN-3.6K-SG05LP1-EU", 3.6, 500, repeatedTrackers(2, 1, 13, 17, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 4680, startupVoltageV: 125,
  }),
  inverter("SUN-5K-SG05LP1-EU", 5, 500, repeatedTrackers(2, 1, 13, 17, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 6500, startupVoltageV: 125,
  }),
  inverter("SUN-6K-SG05LP1-EU", 6, 500, repeatedTrackers(2, 1, 13, 17, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 7800, startupVoltageV: 125,
  }),
  inverter("SUN-7.6K-SG05LP1-EU", 7.6, 500, repeatedTrackers(2, 2, 26, 34, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 9880, startupVoltageV: 125,
  }),
  inverter("SUN-8K-SG05LP1-EU", 8, 500, repeatedTrackers(2, 2, 26, 34, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 10400, startupVoltageV: 125,
  }),
  inverter("SUN-7.6K-SG02LP1-EU-AM2", 7.6, 500, repeatedTrackers(2, 2, 26, 44, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 12160, maxRecommendedPvWp: 15200, startupVoltageV: 125,
  }),
  inverter("SUN-8K-SG02LP1-EU-AM2", 8, 500, repeatedTrackers(2, 2, 26, 44, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 12800, maxRecommendedPvWp: 16000, startupVoltageV: 125,
  }),
  inverter("SUN-10K-SG02LP1-EU-AM3", 10, 500, repeatedTrackers(3, 2, 26, 44, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 16000, maxRecommendedPvWp: 20000, startupVoltageV: 125,
  }),
  inverter("SUN-12K-SG02LP1-EU-AM3", 12, 500, repeatedTrackers(3, 2, 26, 44, 150, 425), {
    inverterType: "hybrid", maxDcPowerWp: 19200, maxRecommendedPvWp: 24000, startupVoltageV: 125,
  }),

  inverter("S6-GR1P3K-M", 3, 550, repeatedTrackers(1, 1, 14, 22, 80, 500), {
    inverterType: "string", maxRecommendedPvWp: 4500, startupVoltageV: 90,
  }),
  inverter("S6-GR1P5K", 5, 600, repeatedTrackers(2, 1, 14, 22, 90, 520), {
    inverterType: "string", maxRecommendedPvWp: 7500, startupVoltageV: 120,
  }),
  inverter("S5-GR1P10K", 10, 600, repeatedTrackers(3, 1, 14, 22, 100, 500), {
    inverterType: "string", maxRecommendedPvWp: 15000, startupVoltageV: 120,
  }),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSpec(item) {
  const { spec } = item;
  if (item.category === "pv_module") {
    assert(spec.vmpV < spec.vocV, `${item.model}: Vmp must be below Voc`);
    assert(spec.impA < spec.iscA, `${item.model}: Imp must be below Isc`);
    assert(spec.maxSystemVoltageV > 0, `${item.model}: max system voltage missing`);
    return;
  }
  assert(spec.ratedAcKw > 0, `${item.model}: rated AC missing`);
  assert(spec.maxDcVoltageV > 0, `${item.model}: max DC voltage missing`);
  assert(spec.trackers.length > 0 && spec.trackers.length <= 12, `${item.model}: tracker count invalid`);
  for (const tracker of spec.trackers) {
    assert(tracker.mpptMinV < tracker.mpptMaxV, `${item.model}: MPPT range invalid`);
    assert(tracker.maxOperatingCurrentA > 0, `${item.model}: MPPT current missing`);
    assert(tracker.maxShortCircuitCurrentA > 0, `${item.model}: MPPT Isc missing`);
    assert(Number.isInteger(tracker.inputCount) && tracker.inputCount > 0, `${item.model}: input count invalid`);
  }
}

async function query(client, table, columns) {
  const { data, error } = await client.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function cleanup(client, created) {
  if (created.auditEventId) await client.from("audit_event").delete().eq("id", created.auditEventId);
  if (created.verificationEventId) await client.from("verification_event").delete().eq("id", created.verificationEventId);
  if (created.category === "inverter") {
    await client.from("mppt_tracker").delete().eq("inverter_revision_id", created.revisionId);
    await client.from("inverter_spec").delete().eq("datasheet_revision_id", created.revisionId);
  } else {
    await client.from("pv_module_spec").delete().eq("datasheet_revision_id", created.revisionId);
  }
}

async function insertOrThrow(operation, label) {
  const { data, error } = await operation.select();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.codex_datasheet_import;
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY_MISSING");
const shouldApply = process.argv.includes("--apply");
const client = createClient(SUPABASE_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

assert(specs.length === 40, `Expected 40 extracted specs, got ${specs.length}`);
assert(new Set(specs.map((item) => item.model)).size === specs.length, "Duplicate model in extracted specs");
for (const item of specs) validateSpec(item);

const [revisions, products, pvRows, inverterRows, trackers, actorRows] = await Promise.all([
  query(client, "datasheet_revision", "id,product_model_id,state"),
  query(client, "product_model", "id,category,exact_model"),
  query(client, "pv_module_spec", "datasheet_revision_id"),
  query(client, "inverter_spec", "datasheet_revision_id"),
  query(client, "mppt_tracker", "inverter_revision_id"),
  query(client, "role_assignment", "user_id,role_code,expires_at"),
]);

const productById = new Map(products.map((row) => [row.id, row]));
const revisionByModel = new Map(
  revisions.map((revision) => [productById.get(revision.product_model_id)?.exact_model, revision]),
);
const existingSpecIds = new Set([
  ...pvRows.map((row) => row.datasheet_revision_id),
  ...inverterRows.map((row) => row.datasheet_revision_id),
]);
assert(
  actorRows.some((row) => row.user_id === IMPORT_ACTOR_ID && row.role_code === "super_admin" && !row.expires_at),
  "Configured import actor is not an active Super Admin",
);

const targets = specs.map((item) => {
  const revision = revisionByModel.get(item.model);
  assert(revision, `${item.model}: revision not found`);
  assert(revision.state === "draft", `${item.model}: expected draft, got ${revision.state}`);
  assert(!existingSpecIds.has(revision.id), `${item.model}: spec already exists`);
  const product = productById.get(revision.product_model_id);
  assert(product.category === item.category, `${item.model}: category mismatch`);
  assert(
    !trackers.some((tracker) => tracker.inverter_revision_id === revision.id),
    `${item.model}: tracker rows already exist`,
  );
  return { ...item, revisionId: revision.id };
});

console.log(JSON.stringify({
  actorId: IMPORT_ACTOR_ID,
  categories: {
    inverter: targets.filter((item) => item.category === "inverter").length,
    pv_module: targets.filter((item) => item.category === "pv_module").length,
  },
  mode: shouldApply ? "apply" : "dry-run",
  targetCount: targets.length,
}, null, 2));

if (!shouldApply) process.exit(0);

for (const item of targets) {
  const created = { category: item.category, revisionId: item.revisionId };
  try {
    if (item.category === "pv_module") {
      await insertOrThrow(
        client.from("pv_module_spec").insert({
          beta_vmp_per_c: item.spec.betaVmpPercentPerC === null ? null : item.spec.betaVmpPercentPerC / 100,
          beta_voc_per_c: item.spec.betaVocPercentPerC === null ? null : item.spec.betaVocPercentPerC / 100,
          bifaciality_factor: item.spec.bifacialityFactor,
          datasheet_revision_id: item.revisionId,
          imp_a: item.spec.impA,
          isc_a: item.spec.iscA,
          max_system_voltage_v: item.spec.maxSystemVoltageV,
          pmax_wp: item.spec.pmaxWp,
          vmp_v: item.spec.vmpV,
          voc_v: item.spec.vocV,
        }),
        `${item.model} pv spec`,
      );
    } else {
      await insertOrThrow(
        client.from("inverter_spec").insert({
          datasheet_revision_id: item.revisionId,
          inverter_type: item.spec.inverterType,
          max_dc_power_wp: item.spec.maxDcPowerWp,
          max_dc_voltage_v: item.spec.maxDcVoltageV,
          max_recommended_pv_wp: item.spec.maxRecommendedPvWp,
          rated_ac_kw: item.spec.ratedAcKw,
          startup_voltage_v: item.spec.startupVoltageV,
        }),
        `${item.model} inverter spec`,
      );
      await insertOrThrow(
        client.from("mppt_tracker").insert(item.spec.trackers.map((tracker, index) => ({
          input_count: tracker.inputCount,
          inverter_revision_id: item.revisionId,
          max_operating_current_a: tracker.maxOperatingCurrentA,
          max_short_circuit_current_a: tracker.maxShortCircuitCurrentA,
          mppt_max_v: tracker.mpptMaxV,
          mppt_min_v: tracker.mpptMinV,
          tracker_index: index + 1,
        }))),
        `${item.model} MPPT trackers`,
      );
    }

    const [verificationEvent] = await insertOrThrow(
      client.from("verification_event").insert({
        actor_id: IMPORT_ACTOR_ID,
        datasheet_revision_id: item.revisionId,
        field_path: "state",
        new_value: { state: "extracted_unverified" },
        old_value: { state: "draft" },
        reason: "Bulk spec extraction from linked official Datasheet PDF page 2",
      }),
      `${item.model} verification event`,
    );
    created.verificationEventId = verificationEvent.id;

    const [auditEvent] = await insertOrThrow(
      client.from("audit_event").insert({
        action: "revision.enter_spec",
        actor_id: IMPORT_ACTOR_ID,
        after_json: { source: "linked_pdf", sourcePages: item.spec.sourcePages, state: "extracted_unverified" },
        before_json: { state: "draft" },
        entity_id: item.revisionId,
        entity_type: "datasheet_revision",
        organization_id: null,
      }),
      `${item.model} audit event`,
    );
    created.auditEventId = auditEvent.id;

    const enteredAt = new Date().toISOString();
    const { data: updated, error: updateError } = await client
      .from("datasheet_revision")
      .update({
        review_note: null,
        spec_entered_at: enteredAt,
        spec_entered_by: IMPORT_ACTOR_ID,
        spec_source_pages: item.spec.sourcePages,
        state: "extracted_unverified",
      })
      .eq("id", item.revisionId)
      .eq("state", "draft")
      .select("id");
    if (updateError || updated.length !== 1) {
      throw new Error(`${item.model} revision update: ${updateError?.message ?? "draft state changed"}`);
    }
    console.log(`entered ${item.model}`);
  } catch (error) {
    await cleanup(client, created);
    throw error;
  }
}

console.log(`Applied ${targets.length} extracted specs.`);
