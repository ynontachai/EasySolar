import { scanJobClaimSchema } from "@/domain/assets/schemas";
import { listPendingScanAssets } from "@/lib/server/datasheet-repository";
import { errorResponse, HttpError, parseJsonRequest } from "@/lib/server/http-error";
import { createDatasheetScanUrl } from "@/lib/server/object-storage";
import { requireScannerRequest } from "@/lib/server/request-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireScannerRequest(request);
    const parsed = scanJobClaimSchema.safeParse(await parseJsonRequest(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        "INVALID_SCAN_JOB_CLAIM",
        parsed.error.issues[0]?.message ?? "ข้อมูลขอรับงานสแกนไม่ถูกต้อง",
      );
    }

    const assets = await listPendingScanAssets(parsed.data.limit);
    const jobs = await Promise.all(
      assets.map(async (asset) => ({
        assetId: asset.assetId,
        downloadUrl: await createDatasheetScanUrl(asset.objectKey),
        filename: asset.filename,
        sha256: asset.sha256,
        sizeBytes: asset.sizeBytes,
      })),
    );

    return Response.json({ jobs });
  } catch (error) {
    return errorResponse(error);
  }
}
