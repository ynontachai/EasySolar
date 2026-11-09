import { NextResponse } from "next/server";
import { evaluateSizing } from "@/domain/sizing/engine";
import { sizingRequestSchema } from "@/domain/sizing/schemas";
import { resolveInverter, resolvePvModule } from "@/lib/server/equipment-resolver";
import { errorResponse, HttpError, parseJsonRequest } from "@/lib/server/http-error";
import {
  enforceSizingRateLimit,
  saveSizingCalculation,
} from "@/lib/server/sizing-calculation-repository";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "ข้อมูลคำขอมีขนาดใหญ่เกินกำหนด");
    }
    const rateLimit = await enforceSizingRateLimit(request);
    const parsed = sizingRequestSchema.safeParse(await parseJsonRequest(request));

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_INPUT",
          message: "ข้อมูลที่ส่งมาไม่ผ่าน validation",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const [pvModule, inverter] = await Promise.all([
      resolvePvModule(parsed.data.pvModuleId),
      resolveInverter(parsed.data.inverterId),
    ]);

    if (!pvModule || !inverter) {
      throw new HttpError(404, "EQUIPMENT_NOT_FOUND", "ไม่พบอุปกรณ์หรือ revision ที่ระบุ");
    }

    const sizingInput = {
      pvModule,
      inverter,
      assumptions: parsed.data.assumptions,
    };
    const result = evaluateSizing(sizingInput, {
      calculationId: crypto.randomUUID(),
      calculatedAt: new Date().toISOString(),
    });
    await saveSizingCalculation(sizingInput, result);

    const headers = new Headers({ "Cache-Control": "no-store" });
    if (rateLimit) {
      headers.set("RateLimit-Limit", String(rateLimit.limit));
      headers.set("RateLimit-Remaining", String(rateLimit.remaining));
      headers.set("RateLimit-Reset", String(Math.ceil(rateLimit.resetAt.getTime() / 1000)));
    }
    return NextResponse.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
