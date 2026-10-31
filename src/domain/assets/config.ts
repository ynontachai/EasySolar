export const DATASHEET_MEDIA_TYPE = "application/pdf";
export const MAX_DATASHEET_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProductImageMediaType = (typeof PRODUCT_IMAGE_MEDIA_TYPES)[number];

export const assetStates = [
  "pending_upload",
  "uploaded",
  "scanning",
  "available",
  "quarantined",
  "deleted",
] as const;

export type AssetState = (typeof assetStates)[number];

export interface DatasheetRuntimeCapabilities {
  database: boolean;
  storage: boolean;
  adminAuth: boolean;
  ready: boolean;
  scanMode: "external" | "trusted-dev";
}
