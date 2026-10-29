import { z } from "zod";
import { DATASHEET_MEDIA_TYPE, MAX_DATASHEET_SIZE_BYTES } from "./config";

const sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "SHA-256 ต้องเป็น lowercase hexadecimal 64 ตัวอักษร");

const sha256Base64Schema = z
  .string()
  .regex(/^[A-Za-z0-9+/]{43}=$/, "Checksum SHA-256 base64 ไม่ถูกต้อง");

export const datasheetUploadIntentSchema = z.object({
  manufacturer: z.string().trim().min(2).max(160),
  exactModel: z.string().trim().min(1).max(200),
  category: z.enum(["pv_module", "inverter"]),
  market: z.string().trim().min(2).max(16).default("TH"),
  revisionLabel: z.string().trim().min(1).max(100),
  language: z.string().trim().min(2).max(16).default("th"),
  filename: z.string().trim().min(1).max(255),
  mediaType: z.literal(DATASHEET_MEDIA_TYPE),
  sizeBytes: z.number().int().positive().max(MAX_DATASHEET_SIZE_BYTES),
  sha256Hex: sha256HexSchema,
  sha256Base64: sha256Base64Schema,
});

export const assetIdSchema = z.string().uuid();

export const scanVerdictSchema = z.object({
  verdict: z.enum(["clean", "infected", "error"]),
  scanner: z.string().trim().min(2).max(100),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type DatasheetUploadIntentInput = z.infer<
  typeof datasheetUploadIntentSchema
>;
