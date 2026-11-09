import { getDatasheetRuntimeCapabilities } from "@/lib/server/runtime-config";
import { getDb, isDatabaseConfigured } from "@/lib/server/db";

export async function GET() {
  const capabilities = getDatasheetRuntimeCapabilities();
  const scannerToken = process.env.EASYSOLAR_SCANNER_TOKEN ?? "";
  const checks = {
    adminAuth: capabilities.adminAuth,
    database: false,
    rateLimit: (process.env.RATE_LIMIT_SALT?.length ?? 0) >= 32,
    scannerToken: scannerToken.length >= 32 && !scannerToken.startsWith("replace-with"),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    storage: capabilities.storage,
  };

  if (isDatabaseConfigured()) {
    try {
      await getDb()`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }
  }

  const ready = Object.values(checks).every(Boolean) && capabilities.scanMode === "external";
  return Response.json(
    { ready, checks, scanMode: capabilities.scanMode },
    {
      headers: { "Cache-Control": "no-store" },
      status: ready ? 200 : 503,
    },
  );
}
