import { assetIdSchema } from "@/domain/assets/schemas";
import { findDownloadableDatasheet } from "@/lib/server/datasheet-repository";
import { errorResponse, HttpError } from "@/lib/server/http-error";
import { createDatasheetDownloadUrl } from "@/lib/server/object-storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ revisionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { revisionId: rawRevisionId } = await context.params;
    const revisionId = assetIdSchema.safeParse(rawRevisionId);

    if (!revisionId.success) {
      throw new HttpError(400, "INVALID_REVISION_ID", "Revision ID ไม่ถูกต้อง");
    }

    const asset = await findDownloadableDatasheet(revisionId.data);
    const signedUrl = await createDatasheetDownloadUrl(asset);

    return Response.redirect(signedUrl, 307);
  } catch (error) {
    return errorResponse(error);
  }
}
