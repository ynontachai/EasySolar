import { describe, expect, it } from "vitest";
import { MAX_DATASHEET_SIZE_BYTES } from "./config";
import {
  datasheetUploadIntentSchema,
  scanJobClaimSchema,
  scanVerdictSchema,
} from "./schemas";

const validIntent = {
  category: "pv_module",
  exactModel: "LR5-72HTH-580M",
  filename: "official-datasheet.pdf",
  language: "en",
  manufacturer: "Example Solar",
  market: "TH",
  mediaType: "application/pdf",
  revisionLabel: "Rev 2026-01",
  sha256Base64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  sha256Hex: "a".repeat(64),
  sizeBytes: 1_024,
};

describe("datasheet upload intent", () => {
  it("accepts a complete PDF upload intent", () => {
    expect(datasheetUploadIntentSchema.parse(validIntent)).toMatchObject({
      category: "pv_module",
      market: "TH",
      mediaType: "application/pdf",
    });
  });

  it("rejects non-PDF media types", () => {
    const result = datasheetUploadIntentSchema.safeParse({
      ...validIntent,
      mediaType: "image/png",
    });

    expect(result.success).toBe(false);
  });

  it("rejects files larger than the configured limit", () => {
    const result = datasheetUploadIntentSchema.safeParse({
      ...validIntent,
      sizeBytes: MAX_DATASHEET_SIZE_BYTES + 1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed checksums", () => {
    const result = datasheetUploadIntentSchema.safeParse({
      ...validIntent,
      sha256Hex: "not-a-checksum",
    });

    expect(result.success).toBe(false);
  });
});

describe("scan verdict", () => {
  it("defaults scanner details to an empty object", () => {
    expect(
      scanVerdictSchema.parse({ scanner: "clamav", verdict: "clean" }),
    ).toEqual({ details: {}, scanner: "clamav", verdict: "clean" });
  });
});

describe("scan job claim", () => {
  it("defaults to ten jobs and caps each batch", () => {
    expect(scanJobClaimSchema.parse({})).toEqual({ limit: 10 });
    expect(scanJobClaimSchema.safeParse({ limit: 25 }).success).toBe(true);
    expect(scanJobClaimSchema.safeParse({ limit: 26 }).success).toBe(false);
  });
});
