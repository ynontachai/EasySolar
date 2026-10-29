export const DATASHEET_MEDIA_TYPE = "application/pdf";
export const MAX_DATASHEET_SIZE_BYTES = 25 * 1024 * 1024;

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
