import { describe, expect, it } from "vitest";
import type { ExtractedSpec } from "./extraction-schema";
import { buildExtractionBatchPlan } from "./extraction-batch";

function extraction(filename: string, exactModel = "S6-GR1P5K-S", manufacturer = "Solis") {
  return {
    manufacturer: { value: manufacturer },
    models: [{ exact_model: exactModel }],
    source_document: { filename },
  } as ExtractedSpec;
}

const pdf = (name: string) => ({ name, size: 1_000, type: "application/pdf" });

describe("external extraction batch pairing", () => {
  it("pairs each JSON with the exact PDF filename declared by the extraction", () => {
    const items = buildExtractionBatchPlan({
      jsonFiles: [
        { error: null, extraction: extraction("one.pdf", "ONE"), name: "one.json", sourceFilename: "one.pdf" },
        { error: null, extraction: extraction("two.pdf", "TWO"), name: "two.json", sourceFilename: "two.pdf" },
      ],
      pdfFiles: [pdf("two.pdf"), pdf("one.pdf")],
    });

    expect(items.map((item) => [item.pdfIndex, item.jsonIndex, item.error])).toEqual([
      [1, 0, null],
      [0, 1, null],
    ]);
  });

  it("reports PDFs and JSON outputs that have no matching partner", () => {
    const items = buildExtractionBatchPlan({
      jsonFiles: [
        { error: null, extraction: extraction("missing.pdf"), name: "missing.json", sourceFilename: "missing.pdf" },
      ],
      pdfFiles: [pdf("orphan.pdf")],
    });

    expect(items.map((item) => item.error)).toEqual([
      "ไม่พบ PDF ชื่อ missing.pdf",
      "ไม่พบ JSON ที่อ้างถึง orphan.pdf",
    ]);
  });

  it("blocks duplicate manufacturer and model identities across PDFs", () => {
    const items = buildExtractionBatchPlan({
      jsonFiles: [
        { error: null, extraction: extraction("one.pdf"), name: "one.json", sourceFilename: "one.pdf" },
        { error: null, extraction: extraction("two.pdf"), name: "two.json", sourceFilename: "two.pdf" },
      ],
      pdfFiles: [pdf("one.pdf"), pdf("two.pdf")],
    });

    expect(items.every((item) => item.error?.includes("ระบุ PDF เจ้าของรุ่นไม่ได้"))).toBe(true);
  });

  it("keeps a duplicated model only in the PDF whose filename matches that model", () => {
    const familyExtraction = (filename: string, models: string[]) => ({
      ...extraction(filename, models[0]),
      detected_model_count: models.length,
      models: models.map((exact_model) => ({ exact_model })),
    }) as ExtractedSpec;
    const items = buildExtractionBatchPlan({
      jsonFiles: [
        {
          error: null,
          extraction: familyExtraction("S5-GR3P5K.pdf", ["S5-GR3P5K", "S5-GR3P10K"]),
          name: "5k.json",
          sourceFilename: "S5-GR3P5K.pdf",
        },
        {
          error: null,
          extraction: familyExtraction("S5-GR3P10K.pdf", ["S5-GR3P5K", "S5-GR3P10K"]),
          name: "10k.json",
          sourceFilename: "S5-GR3P10K.pdf",
        },
      ],
      pdfFiles: [pdf("S5-GR3P5K.pdf"), pdf("S5-GR3P10K.pdf")],
    });

    expect(items.map((item) => item.extraction?.models.map((model) => model.exact_model))).toEqual([
      ["S5-GR3P5K"],
      ["S5-GR3P10K"],
    ]);
    expect(items.map((item) => item.excludedDuplicateModels)).toEqual([
      ["S5-GR3P10K"],
      ["S5-GR3P5K"],
    ]);
    expect(items.every((item) => item.error === null)).toBe(true);
  });

  it("blocks duplicate JSON declarations for the same PDF", () => {
    const items = buildExtractionBatchPlan({
      jsonFiles: [
        { error: null, extraction: extraction("one.pdf", "ONE"), name: "one-a.json", sourceFilename: "one.pdf" },
        { error: null, extraction: extraction("one.pdf", "TWO"), name: "one-b.json", sourceFilename: "one.pdf" },
      ],
      pdfFiles: [pdf("one.pdf")],
    });

    expect(items.every((item) => item.error?.includes("JSON มากกว่าหนึ่งไฟล์"))).toBe(true);
  });

  it("keeps an invalid JSON paired when its source filename is readable", () => {
    const items = buildExtractionBatchPlan({
      jsonFiles: [{
        error: "detected_model_count ต้องมีอย่างน้อย 1 Model",
        extraction: null,
        name: "one.easysolar.json",
        sourceFilename: "one.pdf",
      }],
      pdfFiles: [pdf("one.pdf")],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      error: "detected_model_count ต้องมีอย่างน้อย 1 Model",
      jsonIndex: 0,
      pdfIndex: 0,
    });
  });
});
