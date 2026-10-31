import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  DATASHEET_MEDIA_TYPE,
  type ProductImageMediaType,
} from "@/domain/assets/config";
import { getStorageRuntimeConfig } from "./runtime-config";

let storageClient: S3Client | null = null;

function getStorageClient() {
  const config = getStorageRuntimeConfig();

  if (!storageClient) {
    storageClient = new S3Client({
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      region: config.region,
    });
  }

  return { client: storageClient, config };
}

export function createDatasheetObjectKey(input: {
  assetId: string;
  productModelId: string;
  revisionId: string;
}) {
  const environment = process.env.APP_ENVIRONMENT || process.env.NODE_ENV || "development";
  return `${environment}/catalog/datasheets/${input.productModelId}/${input.revisionId}/${input.assetId}/original.pdf`;
}

function imageExtension(mediaType: ProductImageMediaType) {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}

export function createProductImageObjectKey(input: {
  assetId: string;
  mediaType: ProductImageMediaType;
  productModelId: string;
}) {
  const environment = process.env.APP_ENVIRONMENT || process.env.NODE_ENV || "development";
  return `${environment}/catalog/product-media/${input.productModelId}/${input.assetId}/original.${imageExtension(input.mediaType)}`;
}

export async function createDatasheetUploadUrl(input: {
  assetId: string;
  checksumBase64: string;
  objectKey: string;
  sha256Hex: string;
}) {
  const { client, config } = getStorageClient();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: DATASHEET_MEDIA_TYPE,
    ChecksumSHA256: input.checksumBase64,
    Metadata: { assetid: input.assetId, sha256hex: input.sha256Hex },
  });

  return getSignedUrl(client, command, { expiresIn: 10 * 60 });
}

export async function createProductImageUploadUrl(input: {
  assetId: string;
  checksumBase64: string;
  mediaType: ProductImageMediaType;
  objectKey: string;
  sha256Hex: string;
}) {
  const { client, config } = getStorageClient();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: input.mediaType,
    ChecksumSHA256: input.checksumBase64,
    Metadata: { assetid: input.assetId, sha256hex: input.sha256Hex },
  });

  return getSignedUrl(client, command, { expiresIn: 10 * 60 });
}

export async function inspectStoredObject(objectKey: string) {
  const { client, config } = getStorageClient();
  const result = await client.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }),
  );

  return {
    checksumBase64: result.ChecksumSHA256,
    contentLength: result.ContentLength,
    contentType: result.ContentType,
    etag: result.ETag?.replaceAll('"', "") ?? null,
    sha256Hex: result.Metadata?.sha256hex,
  };
}

export async function deleteStoredObject(input: { bucket: string; objectKey: string }) {
  const { client } = getStorageClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: input.bucket, Key: input.objectKey }),
  );
}

export function isStoredObjectMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

export async function createDatasheetDownloadUrl(input: {
  filename: string;
  objectKey: string;
}) {
  const { client, config } = getStorageClient();
  const encodedFilename = encodeURIComponent(input.filename);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ResponseContentDisposition: `inline; filename*=UTF-8''${encodedFilename}`,
    ResponseContentType: DATASHEET_MEDIA_TYPE,
  });

  return getSignedUrl(client, command, { expiresIn: 5 * 60 });
}

export async function createProductImageDownloadUrl(input: {
  mediaType: string;
  objectKey: string;
}) {
  const { client, config } = getStorageClient();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ResponseCacheControl: "public, max-age=3600, stale-while-revalidate=86400",
    ResponseContentDisposition: "inline",
    ResponseContentType: input.mediaType,
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 60 });
}
