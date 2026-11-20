import { describe, expect, it } from "vitest";
import { classifyImportModels } from "./import-preflight";

describe("classifyImportModels", () => {
  const existingModels = [
    {
      category: "inverter" as const,
      exactModel: "SUN2000-10KTL-M1",
      revisionLabels: ["Rev. 2025-01"],
    },
    {
      category: "pv_module" as const,
      exactModel: "SHARED-10K",
      revisionLabels: ["Rev. A"],
    },
  ];

  it("classifies new models and new revisions", () => {
    expect(classifyImportModels({
      category: "inverter",
      exactModels: ["SUN2000-12KTL-M1", "sun2000-10ktl-m1"],
      existingModels,
      revisionLabel: "Rev. 2026-11",
    })).toEqual([
      {
        exactModel: "SUN2000-12KTL-M1",
        message: "จะสร้าง Model ใหม่ภายใต้ Manufacturer นี้",
        status: "NEW_MODEL",
      },
      {
        exactModel: "sun2000-10ktl-m1",
        message: "จะเพิ่ม Revision Rev. 2026-11 ใน Model เดิม",
        status: "NEW_REVISION",
      },
    ]);
  });

  it("blocks duplicate revisions and category conflicts", () => {
    expect(classifyImportModels({
      category: "inverter",
      exactModels: ["SUN2000-10KTL-M1", "SHARED-10K"],
      existingModels,
      revisionLabel: "Rev. 2025-01",
    }).map((result) => result.status)).toEqual([
      "REVISION_EXISTS",
      "CATEGORY_CONFLICT",
    ]);
  });
});
