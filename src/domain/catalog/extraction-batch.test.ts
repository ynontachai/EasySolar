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
        { error: null, extraction: extraction("one.pdf", "ONE"), name: "one.json" },
        { error: null, extraction: extraction("two.pdf", "TWO"), name: "two.json" },
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
        { error: null, extraction: extraction("missing.pdf"), name: "missing.json" },
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
        { error: null, extraction: extraction("one.pdf"), name: "one.json" },
        { error: null, extraction: extraction("two.pdf"), name: "two.json" },
      ],
      pdfFiles: [pdf("one.pdf"), pdf("two.pdf")],
    });

    expect(items.every((item) => item.error?.includes("Exact model ซ้ำ"))).toBe(true);
  });

  it("blocks duplicate JSON declarations for the same PDF", () => {
    const items = buildExtractionBatchPlan({
      jsonFiles: [
        { error: null, extraction: extraction("one.pdf", "ONE"), name: "one-a.json" },
        { error: null, extraction: extraction("one.pdf", "TWO"), name: "one-b.json" },
      ],
      pdfFiles: [pdf("one.pdf")],
    });

    expect(items.every((item) => item.error?.includes("JSON มากกว่าหนึ่งไฟล์"))).toBe(true);
  });
});
