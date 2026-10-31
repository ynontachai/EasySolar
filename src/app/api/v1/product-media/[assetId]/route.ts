import { assetIdSchema } from "@/domain/assets/schemas";
import { getAdminPrincipal } from "@/lib/server/admin-auth";
import { errorResponse, HttpError } from "@/lib/server/http-error";
import { createProductImageDownloadUrl } from "@/lib/server/object-storage";
import { findViewableProductImage } from "@/lib/server/product-media-repository";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const assetId = assetIdSchema.safeParse((await context.params).assetId);
    if (!assetId.success) throw new HttpError(400, "INVALID_ASSET_ID", "Asset ID ไม่ถูกต้อง");

    const principal = await getAdminPrincipal();
    const image = await findViewableProductImage(assetId.data, principal);
    const url = await createProductImageDownloadUrl(image);

    return new Response(null, {
      headers: {
        // Signed URLs last 1 hour; public product images may be cached shorter than that.
        "Cache-Control": image.isPublic ? "public, max-age=300" : "private, no-store",
        Location: url,
      },
      status: 307,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
