import { assetIdSchema, scanVerdictSchema } from "@/domain/assets/schemas";
import { recordAssetScanVerdict } from "@/lib/server/datasheet-repository";
import {
  errorResponse,
  HttpError,
  parseJsonRequest,
} from "@/lib/server/http-error";
import { requireScannerRequest } from "@/lib/server/request-auth";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    requireScannerRequest(request);
    const { assetId: rawAssetId } = await context.params;
    const assetId = assetIdSchema.safeParse(rawAssetId);
    const body = scanVerdictSchema.safeParse(await parseJsonRequest(request));

    if (!assetId.success) {
      throw new HttpError(400, "INVALID_ASSET_ID", "Asset ID ไม่ถูกต้อง");
    }

    if (!body.success) {
      throw new HttpError(
        400,
        "INVALID_SCAN_VERDICT",
        body.error.issues[0]?.message ?? "ผลตรวจไฟล์ไม่ถูกต้อง",
      );
    }

    const state = await recordAssetScanVerdict({
      assetId: assetId.data,
      details: body.data.details,
      scanner: body.data.scanner,
      verdict: body.data.verdict,
    });

    return Response.json({ assetId: assetId.data, state });
  } catch (error) {
    return errorResponse(error);
  }
}
