import "server-only";
import { createHash } from "node:crypto";
import type { SizingInput, SizingResult } from "@/domain/sizing/types";
import { HttpError } from "@/lib/server/http-error";
import { getDb, isDatabaseConfigured } from "@/lib/server/db";

const DEFAULT_RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export interface RateLimitResult {
  limit: number;
  remaining: number;
  resetAt: Date;
}

function getClientAddress(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function enforceSizingRateLimit(request: Request): Promise<RateLimitResult | null> {
  if (!isDatabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(503, "SERVICE_NOT_READY", "ระบบคำนวณยังไม่พร้อมให้บริการ");
    }
    return null;
  }

  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpError(503, "SERVICE_NOT_READY", "ระบบป้องกันคำขอยังไม่ได้ตั้งค่า");
    }
    return null;
  }

  const configuredLimit = Number(process.env.SIZING_RATE_LIMIT_PER_MINUTE ?? DEFAULT_RATE_LIMIT);
  const limit = Number.isInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_RATE_LIMIT;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS);
  const resetAt = new Date(windowStart.getTime() + RATE_WINDOW_MS);
  const keyHash = createHash("sha256")
    .update(`${salt}:${getClientAddress(request)}`)
    .digest("hex");
  const sql = getDb();
  await sql`DELETE FROM api_rate_limit WHERE expires_at < now()`;
  const [row] = await sql<Array<{ count: number }>>`
    INSERT INTO api_rate_limit (key_hash, window_start, request_count, expires_at)
    VALUES (${keyHash}, ${windowStart}, 1, ${new Date(resetAt.getTime() + RATE_WINDOW_MS)})
    ON CONFLICT (key_hash, window_start)
    DO UPDATE SET request_count = api_rate_limit.request_count + 1
    RETURNING request_count AS count
  `;
  const count = Number(row?.count ?? limit + 1);
  if (count > limit) {
    throw new HttpError(429, "RATE_LIMITED", "ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่");
  }
  return { limit, remaining: Math.max(limit - count, 0), resetAt };
}

export async function saveSizingCalculation(input: SizingInput, result: SizingResult) {
  if (!isDatabaseConfigured()) return;
  const sql = getDb();
  const inputsJson = JSON.parse(JSON.stringify({
    assumptions: input.assumptions,
    overrides: result.overrides,
  }));
  const snapshotsJson = JSON.parse(JSON.stringify({ inverter: input.inverter, pvModule: input.pvModule }));
  const resultJson = JSON.parse(JSON.stringify(result));
  await sql`
    INSERT INTO calculation (id, inputs_json, spec_snapshots_json, engine_version, result_json, created_at)
    VALUES (
      ${result.calculationId}::uuid,
      ${sql.json(inputsJson)},
      ${sql.json(snapshotsJson)},
      ${result.engineVersion},
      ${sql.json(resultJson)},
      ${result.calculatedAt}::timestamptz
    )
  `;
}
