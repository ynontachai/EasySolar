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

function extractedPmax(value: number) {
  return {
    confidence: "high" as const,
    evidence: `Peak Power Watts-PMAX ${value}`,
    raw_unit: "Wp",
    raw_value: value,
    source_label: "Peak Power Watts-PMAX",
    source_page: 2,
    status: "extracted" as const,
    unit: "Wp",
    value,
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
        identifier_provenance: {
          anchor_model: null,
          anchor_power_wp: null,
          composition_rule: null,
          evidence: [
            {
              evidence: "ES-550M",
              source_label: "Model",
              source_page: 1,
              source_type: "pdf",
            },
          ],
          method: "explicit",
          variant_power_wp: null,
        },
        model_evidence: { evidence: "ES-550M", source_label: "Model", source_page: 1 },
        model_family: "ES-M",
        trackers: [],
        warnings: [],
      },
    ],
    prompt_version: "1.2",
    schema_id: "easysolar-spec-extraction",
    schema_version: "1.1",
    source_document: { filename: "datasheet.pdf", page_count: 2 },
    template_id: "pv-module",
    template_version: "1.1",
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

  it("accepts a composed power-variant identifier with PDF and filename evidence", () => {
    const output = pvOutput();
    output.models[0].exact_model = "TSM-625NEG19RC.20";
    output.models[0].fields.pmaxWp = extractedPmax(625);
    output.models[0].model_family = "TSM-NEG19RC.20";
    output.models[0].identifier_provenance = {
      anchor_model: "TSM-625NEG19RC.20",
      anchor_power_wp: 625,
      composition_rule: "power_variant_substitution",
      evidence: [
        {
          evidence: "TSM-NEG19RC.20 625-650W",
          source_label: "Product family",
          source_page: 1,
          source_type: "pdf",
        },
        {
          evidence: "Trina Solar Vertex N-Type 625W (TSM-625NEG19RC.20).pdf",
          source_label: "Attached PDF filename",
          source_page: null,
          source_type: "filename",
        },
      ],
      method: "composed",
      variant_power_wp: 625,
    };
    expect(extractedSpecSchema.safeParse(output).success).toBe(true);
  });

  it("accepts the Leapton identifier pattern established by a PDF anchor model", () => {
    const output = pvOutput();
    output.models[0].exact_model = "LP182*210-M-66-NB-620W";
    output.models[0].fields.pmaxWp = extractedPmax(620);
    output.models[0].model_family = "LP182*210-M-66-NB";
    output.models[0].identifier_provenance = {
      anchor_model: "LP182*210-M-66-NB-610W",
      anchor_power_wp: 610,
      composition_rule: "power_variant_substitution",
      evidence: [
        {
          evidence: "LP182*210-M-66-NB-610W",
          source_label: "Characteristics chart model",
          source_page: 2,
          source_type: "pdf",
        },
        {
          evidence: "Electrical parameters at STC: 620W",
          source_label: "Power column",
          source_page: 2,
          source_type: "pdf",
        },
      ],
      method: "composed",
      variant_power_wp: 620,
    };
    expect(extractedSpecSchema.safeParse(output).success).toBe(true);
  });

  it("rejects a composed identifier without the approved composition rule", () => {
    const output = pvOutput();
    output.models[0].identifier_provenance.method = "composed";
    expect(extractedSpecSchema.safeParse(output).success).toBe(false);
  });

  it("rejects a composed identifier that changes more than the power token", () => {
    const output = pvOutput();
    output.models[0].exact_model = "TSM-630NEG19RC.20-ALTERED";
    output.models[0].model_family = "TSM-NEG19RC.20";
    output.models[0].identifier_provenance = {
      anchor_model: "TSM-625NEG19RC.20",
      anchor_power_wp: 625,
      composition_rule: "power_variant_substitution",
      evidence: [
        {
          evidence: "TSM-NEG19RC.20 625-650W",
          source_label: "Product family",
          source_page: 1,
          source_type: "pdf",
        },
      ],
      method: "composed",
      variant_power_wp: 630,
    };
    expect(extractedSpecSchema.safeParse(output).success).toBe(false);
  });

  it("rejects filename evidence with a PDF page number", () => {
    const output = pvOutput();
    output.models[0].identifier_provenance.evidence[0] = {
      evidence: "datasheet.pdf",
      source_label: "Attached PDF filename",
      source_page: 1,
      source_type: "filename",
    };
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

  it("documents the canonical inverter type mapping in the template and prompt", () => {
    const templatePath = resolve(
      process.cwd(),
      "public",
      "easysolar-extraction",
      "easysolar-inverter-extraction-v1.json",
    );
    const template = JSON.parse(readFileSync(templatePath, "utf8")) as {
      field_contract: Array<{
        allowed_values?: string[];
        field_key: string;
        value_mapping?: Record<string, string[]>;
      }>;
      rules: string[];
    };
    const inverterType = template.field_contract.find(
      (field) => field.field_key === "inverterType",
    );
    expect(inverterType?.allowed_values).toEqual(["string", "hybrid", "micro"]);
    expect(inverterType?.value_mapping?.string).toContain("on-grid");
    expect(inverterType?.value_mapping?.hybrid).toContain("hybrid");
    expect(inverterType?.value_mapping?.micro).toContain("microinverter");
    expect(template.rules.some((rule) => rule.includes("grid-tied") && rule.includes("string"))).toBe(true);

    const promptPath = resolve(
      process.cwd(),
      "public",
      "easysolar-extraction",
      "easysolar-extraction-prompt-v1.txt",
    );
    const prompt = readFileSync(promptPath, "utf8");
    expect(prompt).toContain("One ZIP archive containing manufacturer datasheet PDFs");
    expect(prompt).toContain("one actual downloadable .json file for each PDF");
    expect(prompt).toContain("Do not paste JSON content into the conversation");
    expect(prompt).toContain("must equal the number of PDFs in the ZIP archive");
    expect(prompt).toContain('grid-connected inverter to "string"');
    expect(prompt).toContain('hybrid inverter to "hybrid"');
    expect(prompt).toContain('microinverter to "micro"');
    expect(prompt).toContain("Do not infer inverterType from the model name");
  });

  it("requires prompt v1.2 in both extraction templates", () => {
    for (const filename of [
      "easysolar-pv-module-extraction-v1.json",
      "easysolar-inverter-extraction-v1.json",
    ]) {
      const path = resolve(process.cwd(), "public", "easysolar-extraction", filename);
      const template = JSON.parse(readFileSync(path, "utf8")) as { prompt_version: string };
      expect(template.prompt_version).toBe("1.2");
    }
  });
});
