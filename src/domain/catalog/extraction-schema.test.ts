import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractedSpecSchema,
  extractionModelToSpecDefaults,
  pvExtractionFieldKeys,
  type ExtractedSpec,
} from "./extraction-schema";

function missingField() {
  return {
    confidence: "low" as const,
    evidence: null,
    raw_unit: null,
    raw_value: null,
    source_label: null,
    source_page: null,
    status: "not_found" as const,
    unit: null,
    value: null,
  };
}

function pvOutput(): ExtractedSpec {
  return {
    detected_model_count: 1,
    document_warnings: [],
    manufacturer: { confidence: "high", source_page: 1, value: "Example Solar" },
    models: [
      {
        exact_model: "ES-550M",
        fields: Object.fromEntries(pvExtractionFieldKeys.map((key) => [key, missingField()])),
        model_evidence: { evidence: "ES-550M", source_label: "Model", source_page: 1 },
        model_family: "ES-M",
        trackers: [],
        warnings: [],
      },
    ],
    prompt_version: "1.0",
    schema_id: "easysolar-spec-extraction",
    schema_version: "1.0",
    source_document: { filename: "datasheet.pdf", page_count: 2 },
    template_id: "pv-module",
    template_version: "1.0",
    unresolved_model_labels: [],
  };
}

describe("external datasheet extraction schema", () => {
  it("accepts a complete multi-field PV result with explicit missing values", () => {
    expect(extractedSpecSchema.safeParse(pvOutput()).success).toBe(true);
  });

  it("rejects duplicate exact models", () => {
    const output = pvOutput();
    output.models.push({ ...output.models[0] });
    output.detected_model_count = 2;
    const result = extractedSpecSchema.safeParse(output);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("ซ้ำ"))).toBe(true);
    }
  });

  it("rejects evidence pages beyond the declared PDF page count", () => {
    const output = pvOutput();
    output.models[0].model_evidence.source_page = 3;
    expect(extractedSpecSchema.safeParse(output).success).toBe(false);
  });

  it("maps unambiguous proposals to existing spec form defaults", () => {
    const output = pvOutput();
    output.models[0].fields.pmaxWp = {
      confidence: "high",
      evidence: "Pmax 550 W",
      raw_unit: "W",
      raw_value: "550",
      source_label: "Pmax",
      source_page: 2,
      status: "extracted",
      unit: "Wp",
      value: 550,
    };
    const parsed = extractedSpecSchema.parse(output);
    const defaults = extractionModelToSpecDefaults(parsed.models[0]);
    expect(defaults.values.pmaxWp).toBe("550");
    expect(defaults.values["sourcePages.pmaxWp"]).toBe("2");
  });

  it("ships valid central template JSON files", () => {
    for (const filename of [
      "easysolar-pv-module-extraction-v1.json",
      "easysolar-inverter-extraction-v1.json",
    ]) {
      const path = resolve(process.cwd(), "public", "easysolar-extraction", filename);
      expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow();
    }
  });
});
