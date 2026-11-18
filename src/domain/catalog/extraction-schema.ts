import { z } from "zod";
import {
  DATASHEET_MEDIA_TYPE,
  MAX_DATASHEET_SIZE_BYTES,
} from "@/domain/assets/config";

export const EXTRACTION_SCHEMA_ID = "easysolar-spec-extraction";
export const EXTRACTION_SCHEMA_VERSION = "1.0";
export const EXTRACTION_PROMPT_VERSION = "1.0";
export const MAX_EXTRACTION_JSON_SIZE_BYTES = 1024 * 1024;
export const MAX_EXTRACTED_MODELS = 50;

export const extractionTemplates = {
  inverter: {
    category: "inverter",
    templateId: "inverter",
    templateVersion: "1.0",
  },
  "pv-module": {
    category: "pv_module",
    templateId: "pv-module",
    templateVersion: "1.0",
  },
} as const;

export type ExtractionCategory = "inverter" | "pv_module";

export const pvExtractionFieldKeys = [
  "alphaIscPercentPerC",
  "betaVmpPercentPerC",
  "betaVocPercentPerC",
  "bifacialityFactor",
  "gammaPmaxPercentPerC",
  "impA",
  "iscA",
  "maxSystemVoltageV",
  "pmaxWp",
  "vmpV",
  "vocV",
] as const;

export const inverterExtractionFieldKeys = [
  "inverterType",
  "maxDcPowerWp",
  "maxDcVoltageV",
  "maxRecommendedPvWp",
  "ratedAcKw",
  "startupVoltageV",
] as const;

export const trackerExtractionFieldKeys = [
  "inputCount",
  "maxOperatingCurrentA",
  "maxShortCircuitCurrentA",
  "mpptMaxV",
  "mpptMinV",
] as const;

interface NumericFieldRule {
  kind: "number";
  max: number;
  min: number;
  minExclusive?: boolean;
  unit: string;
}

interface StringFieldRule {
  allowed: readonly string[];
  kind: "string";
  unit: null;
}

type FieldRule = NumericFieldRule | StringFieldRule;

const extractionFieldRules: Record<string, FieldRule> = {
  alphaIscPercentPerC: { kind: "number", min: 0, minExclusive: true, max: 2, unit: "%/°C" },
  betaVmpPercentPerC: { kind: "number", min: -2, max: 0, unit: "%/°C" },
  betaVocPercentPerC: { kind: "number", min: -2, max: 0, unit: "%/°C" },
  bifacialityFactor: { kind: "number", min: 0, max: 1, unit: "ratio" },
  gammaPmaxPercentPerC: { kind: "number", min: -2, max: 0, unit: "%/°C" },
  impA: { kind: "number", min: 0, minExclusive: true, max: 100, unit: "A" },
  inputCount: { kind: "number", min: 1, max: 12, unit: "count" },
  inverterType: { allowed: ["string", "hybrid", "micro"], kind: "string", unit: null },
  iscA: { kind: "number", min: 0, minExclusive: true, max: 100, unit: "A" },
  maxDcPowerWp: { kind: "number", min: 0, minExclusive: true, max: 10_000_000, unit: "Wp" },
  maxDcVoltageV: { kind: "number", min: 0, minExclusive: true, max: 5000, unit: "V" },
  maxOperatingCurrentA: { kind: "number", min: 0, minExclusive: true, max: 200, unit: "A" },
  maxRecommendedPvWp: { kind: "number", min: 0, minExclusive: true, max: 10_000_000, unit: "Wp" },
  maxShortCircuitCurrentA: { kind: "number", min: 0, minExclusive: true, max: 300, unit: "A" },
  maxSystemVoltageV: { kind: "number", min: 0, minExclusive: true, max: 5000, unit: "V" },
  mpptMaxV: { kind: "number", min: 0, minExclusive: true, max: 2000, unit: "V" },
  mpptMinV: { kind: "number", min: 0, minExclusive: true, max: 2000, unit: "V" },
  pmaxWp: { kind: "number", min: 0, minExclusive: true, max: 2000, unit: "Wp" },
  ratedAcKw: { kind: "number", min: 0, minExclusive: true, max: 10_000, unit: "kW" },
  startupVoltageV: { kind: "number", min: 0, minExclusive: true, max: 2000, unit: "V" },
  vmpV: { kind: "number", min: 0, minExclusive: true, max: 500, unit: "V" },
  vocV: { kind: "number", min: 0, minExclusive: true, max: 500, unit: "V" },
};

const extractionStatusSchema = z.enum([
  "extracted",
  "derived",
  "shared_across_models",
  "ambiguous",
  "not_found",
  "conflict",
]);

const rawValueSchema = z.union([z.number(), z.string(), z.boolean()]).nullable();

export const extractedFieldSchema = z
  .object({
    value: rawValueSchema,
    unit: z.string().trim().max(40).nullable(),
    raw_value: rawValueSchema,
    raw_unit: z.string().trim().max(40).nullable(),
    status: extractionStatusSchema,
    source_page: z.number().int().positive().nullable(),
    source_label: z.string().trim().max(240).nullable(),
    evidence: z.string().trim().max(500).nullable(),
    confidence: z.enum(["high", "medium", "low"]),
    formula: z.string().trim().max(500).nullable().optional(),
    input_fields: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.status === "not_found" && field.value !== null) {
      context.addIssue({
        code: "custom",
        message: "field ที่มี status not_found ต้องมี value เป็น null",
        path: ["value"],
      });
    }
    if (field.value !== null && field.source_page === null) {
      context.addIssue({
        code: "custom",
        message: "field ที่มีค่าต้องระบุ source_page",
        path: ["source_page"],
      });
    }
    if (field.status === "derived" && !field.formula) {
      context.addIssue({
        code: "custom",
        message: "field ที่ derive ต้องระบุ formula",
        path: ["formula"],
      });
    }
    if (field.status === "derived" && (!field.input_fields || field.input_fields.length === 0)) {
      context.addIssue({
        code: "custom",
        message: "field ที่ derive ต้องระบุ input_fields",
        path: ["input_fields"],
      });
    }
  });

const extractedTrackerSchema = z
  .object({
    tracker_index: z.number().int().min(1).max(12),
    fields: z.record(z.string(), extractedFieldSchema),
  })
  .strict();

export const extractedModelSchema = z
  .object({
    exact_model: z.string().trim().min(1).max(200),
    model_family: z.string().trim().max(200).nullable().optional(),
    model_evidence: z
      .object({
        source_page: z.number().int().positive(),
        source_label: z.string().trim().max(240),
        evidence: z.string().trim().min(1).max(500),
      })
      .strict(),
    fields: z.record(z.string(), extractedFieldSchema),
    trackers: z.array(extractedTrackerSchema).max(12).default([]),
    warnings: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict();

export const extractedSpecSchema = z
  .object({
    schema_id: z.literal(EXTRACTION_SCHEMA_ID),
    schema_version: z.literal(EXTRACTION_SCHEMA_VERSION),
    template_id: z.enum(["pv-module", "inverter"]),
    template_version: z.literal("1.0"),
    prompt_version: z.literal(EXTRACTION_PROMPT_VERSION),
    source_document: z
      .object({
        filename: z.string().trim().min(1).max(255),
        page_count: z.number().int().positive().max(2_000),
      })
      .strict(),
    manufacturer: z
      .object({
        value: z.string().trim().min(2).max(160),
        source_page: z.number().int().positive(),
        confidence: z.enum(["high", "medium", "low"]),
      })
      .strict(),
    detected_model_count: z.number().int().min(1).max(MAX_EXTRACTED_MODELS),
    models: z.array(extractedModelSchema).min(1).max(MAX_EXTRACTED_MODELS),
    unresolved_model_labels: z.array(z.string().trim().min(1).max(500)).max(100),
    document_warnings: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict()
  .superRefine((output, context) => {
    const template = extractionTemplates[output.template_id];
    const expectedFieldKeys =
      template.category === "pv_module"
        ? pvExtractionFieldKeys
        : inverterExtractionFieldKeys;
    const expectedFields = new Set<string>(expectedFieldKeys);
    const expectedTrackerFields = new Set<string>(trackerExtractionFieldKeys);

    if (output.detected_model_count !== output.models.length) {
      context.addIssue({
        code: "custom",
        message: "detected_model_count ไม่ตรงกับจำนวน models",
        path: ["detected_model_count"],
      });
    }

    if (output.manufacturer.source_page > output.source_document.page_count) {
      context.addIssue({
        code: "custom",
        message: "หน้าอ้างอิงผู้ผลิตเกินจำนวนหน้า PDF",
        path: ["manufacturer", "source_page"],
      });
    }

    const modelNames = new Set<string>();
    output.models.forEach((model, modelIndex) => {
      const normalizedModel = model.exact_model.toLocaleLowerCase("en-US");
      if (modelNames.has(normalizedModel)) {
        context.addIssue({
          code: "custom",
          message: "exact_model ซ้ำในไฟล์ผลลัพธ์",
          path: ["models", modelIndex, "exact_model"],
        });
      }
      modelNames.add(normalizedModel);

      if (model.model_evidence.source_page > output.source_document.page_count) {
        context.addIssue({
          code: "custom",
          message: "หน้าอ้างอิง Model เกินจำนวนหน้า PDF",
          path: ["models", modelIndex, "model_evidence", "source_page"],
        });
      }

      const suppliedFieldKeys = Object.keys(model.fields);
      for (const key of expectedFieldKeys) {
        if (!(key in model.fields)) {
          context.addIssue({
            code: "custom",
            message: `ขาด field ${key}`,
            path: ["models", modelIndex, "fields", key],
          });
        }
      }
      for (const key of suppliedFieldKeys) {
        if (!expectedFields.has(key)) {
          context.addIssue({
            code: "custom",
            message: `ไม่รองรับ field ${key}`,
            path: ["models", modelIndex, "fields", key],
          });
        }
      }

      if (template.category === "pv_module" && model.trackers.length > 0) {
        context.addIssue({
          code: "custom",
          message: "PV Module ต้องไม่มี trackers",
          path: ["models", modelIndex, "trackers"],
        });
      }

      const trackerIndexes = new Set<number>();
      model.trackers.forEach((tracker, trackerIndex) => {
        if (trackerIndexes.has(tracker.tracker_index)) {
          context.addIssue({
            code: "custom",
            message: "tracker_index ซ้ำ",
            path: ["models", modelIndex, "trackers", trackerIndex, "tracker_index"],
          });
        }
        trackerIndexes.add(tracker.tracker_index);
        for (const key of trackerExtractionFieldKeys) {
          if (!(key in tracker.fields)) {
            context.addIssue({
              code: "custom",
              message: `ขาด tracker field ${key}`,
              path: ["models", modelIndex, "trackers", trackerIndex, "fields", key],
            });
          }
        }
        for (const key of Object.keys(tracker.fields)) {
          if (!expectedTrackerFields.has(key)) {
            context.addIssue({
              code: "custom",
              message: `ไม่รองรับ tracker field ${key}`,
              path: ["models", modelIndex, "trackers", trackerIndex, "fields", key],
            });
          }
        }
      });

      for (const [fieldKey, field] of Object.entries(model.fields)) {
        if (
          field.source_page !== null &&
          field.source_page > output.source_document.page_count
        ) {
          context.addIssue({
            code: "custom",
            message: `หน้าอ้างอิง ${fieldKey} เกินจำนวนหน้า PDF`,
            path: ["models", modelIndex, "fields", fieldKey, "source_page"],
          });
        }
        const rule = extractionFieldRules[fieldKey];
        if (rule && field.value !== null) {
          if (rule.kind === "string") {
            if (typeof field.value !== "string" || !rule.allowed.includes(field.value)) {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} ต้องเป็น ${rule.allowed.join(", ")}`,
                path: ["models", modelIndex, "fields", fieldKey, "value"],
              });
            }
          } else {
            if (typeof field.value !== "number") {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} ต้องเป็นตัวเลข`,
                path: ["models", modelIndex, "fields", fieldKey, "value"],
              });
            } else if (
              (rule.minExclusive ? field.value <= rule.min : field.value < rule.min) ||
              field.value > rule.max
            ) {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} อยู่นอกช่วงที่รองรับ`,
                path: ["models", modelIndex, "fields", fieldKey, "value"],
              });
            }
            if (field.unit !== rule.unit) {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} ต้อง normalize เป็นหน่วย ${rule.unit}`,
                path: ["models", modelIndex, "fields", fieldKey, "unit"],
              });
            }
          }
        }
      }

      const vmp = model.fields.vmpV?.value;
      const voc = model.fields.vocV?.value;
      if (typeof vmp === "number" && typeof voc === "number" && vmp >= voc) {
        context.addIssue({
          code: "custom",
          message: "Vmp ต้องน้อยกว่า Voc",
          path: ["models", modelIndex, "fields", "vmpV", "value"],
        });
      }
      const imp = model.fields.impA?.value;
      const isc = model.fields.iscA?.value;
      if (typeof imp === "number" && typeof isc === "number" && imp >= isc) {
        context.addIssue({
          code: "custom",
          message: "Imp ต้องน้อยกว่า Isc",
          path: ["models", modelIndex, "fields", "impA", "value"],
        });
      }

      model.trackers.forEach((tracker, trackerIndex) => {
        for (const [fieldKey, field] of Object.entries(tracker.fields)) {
          if (field.source_page !== null && field.source_page > output.source_document.page_count) {
            context.addIssue({
              code: "custom",
              message: `หน้าอ้างอิง ${fieldKey} เกินจำนวนหน้า PDF`,
              path: ["models", modelIndex, "trackers", trackerIndex, "fields", fieldKey, "source_page"],
            });
          }
          const rule = extractionFieldRules[fieldKey];
          if (rule?.kind === "number" && field.value !== null) {
            if (typeof field.value !== "number") {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} ต้องเป็นตัวเลข`,
                path: ["models", modelIndex, "trackers", trackerIndex, "fields", fieldKey, "value"],
              });
            } else if (
              (rule.minExclusive ? field.value <= rule.min : field.value < rule.min) ||
              field.value > rule.max ||
              (fieldKey === "inputCount" && !Number.isInteger(field.value))
            ) {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} อยู่นอกช่วงที่รองรับ`,
                path: ["models", modelIndex, "trackers", trackerIndex, "fields", fieldKey, "value"],
              });
            }
            if (field.unit !== rule.unit) {
              context.addIssue({
                code: "custom",
                message: `${fieldKey} ต้อง normalize เป็นหน่วย ${rule.unit}`,
                path: ["models", modelIndex, "trackers", trackerIndex, "fields", fieldKey, "unit"],
              });
            }
          }
        }
        const mpptMin = tracker.fields.mpptMinV?.value;
        const mpptMax = tracker.fields.mpptMaxV?.value;
        if (typeof mpptMin === "number" && typeof mpptMax === "number" && mpptMin >= mpptMax) {
          context.addIssue({
            code: "custom",
            message: "MPPT min ต้องน้อยกว่า MPPT max",
            path: ["models", modelIndex, "trackers", trackerIndex, "fields", "mpptMinV", "value"],
          });
        }
      });
    });
  });

export const extractedImportUploadIntentSchema = z
  .object({
    extraction: extractedSpecSchema,
    filename: z.string().trim().min(1).max(255),
    language: z.string().trim().min(2).max(16).default("en"),
    market: z.string().trim().min(2).max(16).default("TH"),
    mediaType: z.literal(DATASHEET_MEDIA_TYPE),
    revisionLabel: z.string().trim().min(1).max(100),
    sha256Base64: z
      .string()
      .regex(/^[A-Za-z0-9+/]{43}=$/, "Checksum SHA-256 base64 ไม่ถูกต้อง"),
    sha256Hex: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "SHA-256 ต้องเป็น lowercase hexadecimal 64 ตัวอักษร"),
    sizeBytes: z.number().int().positive().max(MAX_DATASHEET_SIZE_BYTES),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.filename !== input.extraction.source_document.filename) {
      context.addIssue({
        code: "custom",
        message: "ชื่อ PDF ไม่ตรงกับ source_document.filename ใน JSON",
        path: ["filename"],
      });
    }
  });

export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type ExtractedModel = z.infer<typeof extractedModelSchema>;
export type ExtractedSpec = z.infer<typeof extractedSpecSchema>;
export type ExtractedImportUploadIntent = z.infer<
  typeof extractedImportUploadIntentSchema
>;

function fieldValue(field: ExtractedField | undefined) {
  if (!field || field.value === null || field.status === "ambiguous" || field.status === "conflict") {
    return undefined;
  }
  return String(field.value);
}

export function extractionModelToSpecDefaults(model: ExtractedModel) {
  const values: Record<string, string> = {};
  for (const [key, field] of Object.entries(model.fields)) {
    const value = fieldValue(field);
    if (value !== undefined) values[key] = value;
    if (field.source_page !== null) {
      values[`sourcePages.${key}`] = String(field.source_page);
    }
  }

  const betaVmp = model.fields.betaVmpPercentPerC;
  if (betaVmp?.status === "derived") {
    values.betaVmpSource = "derived";
    if (betaVmp.formula) values.betaVmpDerivation = betaVmp.formula;
  } else if (betaVmp?.value !== null && betaVmp?.value !== undefined) {
    values.betaVmpSource = "datasheet";
  } else {
    values.betaVmpSource = "missing";
  }

  const trackers = [...model.trackers]
    .sort((a, b) => a.tracker_index - b.tracker_index)
    .map((tracker) =>
      Object.fromEntries(
        Object.entries(tracker.fields).flatMap(([key, field]) => {
          const value = fieldValue(field);
          return value === undefined ? [] : [[key, value]];
        }),
      ),
    );

  const firstTracker = model.trackers[0];
  const trackerPageMappings = {
    mpptOperatingCurrent: firstTracker?.fields.maxOperatingCurrentA,
    mpptRange: firstTracker?.fields.mpptMinV,
    mpptShortCircuitCurrent: firstTracker?.fields.maxShortCircuitCurrentA,
    mpptTopology: firstTracker?.fields.inputCount,
  };
  for (const [key, field] of Object.entries(trackerPageMappings)) {
    if (field?.source_page) values[`sourcePages.${key}`] = String(field.source_page);
  }

  return { trackers, values };
}
