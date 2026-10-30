import { describe, expect, it } from "vitest";
import { createSkuSchema } from "./admin-schemas";

const organizationId = "00000000-0000-4000-8000-000000000001";
const manufacturerId = "00000000-0000-4000-8000-000000000002";
const productModelId = "00000000-0000-4000-8000-000000000003";

const baseInput = {
  category: "pv_module",
  manufacturerPartNumber: "",
  organizationId,
  sku: " pv-lr5-550-th ",
  variantLabel: "550 W · Black frame",
};

describe("create SKU schema", () => {
  it("accepts an existing product model without duplicate identity fields", () => {
    const parsed = createSkuSchema.parse({
      ...baseInput,
      exactModel: "",
      manufacturerId: "",
      manufacturerName: "",
      productModelId,
    });

    expect(parsed.productModelId).toBe(productModelId);
    expect(parsed.manufacturerId).toBeNull();
    expect(parsed.sku).toBe("pv-lr5-550-th");
  });

  it("accepts a new model under an existing manufacturer", () => {
    const parsed = createSkuSchema.parse({
      ...baseInput,
      exactModel: "LR5-72HTH-590M",
      manufacturerId,
      manufacturerName: "",
      productModelId: "",
    });

    expect(parsed.manufacturerId).toBe(manufacturerId);
    expect(parsed.exactModel).toBe("LR5-72HTH-590M");
  });

  it("accepts a new manufacturer and model in one submission", () => {
    const parsed = createSkuSchema.parse({
      ...baseInput,
      exactModel: "ABC-550",
      manufacturerId: "",
      manufacturerName: " New Solar Co. ",
      productModelId: "",
    });

    expect(parsed.manufacturerName).toBe("New Solar Co.");
  });

  it("rejects a new model without a manufacturer", () => {
    const result = createSkuSchema.safeParse({
      ...baseInput,
      exactModel: "ABC-550",
      manufacturerId: "",
      manufacturerName: "",
      productModelId: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects conflicting existing and new manufacturer values", () => {
    const result = createSkuSchema.safeParse({
      ...baseInput,
      exactModel: "ABC-550",
      manufacturerId,
      manufacturerName: "New Solar Co.",
      productModelId: "",
    });

    expect(result.success).toBe(false);
  });
});
