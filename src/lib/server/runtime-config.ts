import "server-only";
import type { DatasheetRuntimeCapabilities } from "@/domain/assets/config";

export interface StorageRuntimeConfig {
  bucket: string;
  endpoint?: string;
  region: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export function getDatasheetRuntimeCapabilities(): DatasheetRuntimeCapabilities {
  const database = Boolean(process.env.DATABASE_URL);
  const hasAccessKey = Boolean(process.env.S3_ACCESS_KEY_ID);
  const hasSecretKey = Boolean(process.env.S3_SECRET_ACCESS_KEY);
  const credentialsAreComplete = hasAccessKey === hasSecretKey;
  const storage = Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      credentialsAreComplete,
  );
  const adminAuth = Boolean(process.env.EASYSOLAR_ADMIN_TOKEN);
  const isTrustedDev =
    process.env.FILE_SCAN_MODE === "trusted-dev" &&
    process.env.NODE_ENV !== "production";

  return {
    database,
    storage,
    adminAuth,
    ready: database && storage && adminAuth,
    scanMode: isTrustedDev ? "trusted-dev" : "external",
  };
}

export function getStorageRuntimeConfig(): StorageRuntimeConfig {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;

  if (!bucket || !region) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error("STORAGE_CREDENTIALS_INCOMPLETE");
  }

  return {
    bucket,
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    accessKeyId,
    secretAccessKey,
  };
}
