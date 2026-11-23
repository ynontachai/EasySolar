import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  exactModelFromPdfFilename,
  extractInverterZip,
  inverterTypeFromZipPath,
  proposedRatedAcKwFromModel,
} from "./inverter-zip-import";

describe("inverter ZIP intake helpers", () => {
  it("maps Hybrid and On Grid folders regardless of spacing and case", () => {
    expect(inverterTypeFromZipPath("Solis Inverter/hybrid/S6-EH1P6K-L-PLUS.pdf")).toBe("hybrid");
    expect(inverterTypeFromZipPath("Solis Inverter/On Grid/S6-GR1P5K-S.pdf")).toBe("string");
    expect(inverterTypeFromZipPath("Solis Inverter/on-grid/S5-GR3P10K.pdf")).toBe("string");
  });

  it("does not guess a type when the folder is not recognized", () => {
    expect(inverterTypeFromZipPath("Solis Inverter/unknown/S5-GR3P10K.pdf")).toBeNull();
  });

  it("keeps exact filename variants and proposes their rated AC output", () => {
    const model = exactModelFromPdfFilename("S6-EH1P10K-L-PLUS (21A).pdf");
    expect(model).toBe("S6-EH1P10K-L-PLUS (21A)");
    expect(proposedRatedAcKwFromModel(model)).toBe(10);
    expect(proposedRatedAcKwFromModel("MODEL-WITHOUT-POWER")).toBeNull();
  });

  it("extracts recognized PDF folders and reports unclassified PDFs", async () => {
    const archive = zipSync({
      "Solis Inverter/hybrid/S6-EH1P6K-L-PLUS.pdf": strToU8("hybrid pdf"),
      "Solis Inverter/on grid/S5-GR3P10K.pdf": strToU8("on-grid pdf"),
      "Solis Inverter/unknown/UNSORTED.pdf": strToU8("unknown pdf"),
      "Solis Inverter/readme.txt": strToU8("ignored"),
    });
    const file = new File([archive.slice().buffer], "Solis Inverter.zip", {
      type: "application/zip",
    });

    const result = await extractInverterZip(file);

    expect(result.entries.map((entry) => [entry.exactModel, entry.inverterType])).toEqual([
      ["S6-EH1P6K-L-PLUS", "hybrid"],
      ["S5-GR3P10K", "string"],
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining("ไม่ได้อยู่ในโฟลเดอร์ Hybrid หรือ On Grid"),
    ]);
  });
});
