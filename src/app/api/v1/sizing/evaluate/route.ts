import { NextResponse } from "next/server";
import { evaluateSizing } from "@/domain/sizing/engine";
import { sizingRequestSchema } from "@/domain/sizing/schemas";
import { resolveInverter, resolvePvModule } from "@/lib/server/equipment-resolver";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = sizingRequestSchema.safeParse(json);

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
    return NextResponse.json(
      {
        error: "EQUIPMENT_NOT_FOUND",
        message: "ไม่พบอุปกรณ์หรือ revision ที่ระบุ",
      },
      { status: 404 },
    );
  }

  const result = evaluateSizing({
    pvModule,
    inverter,
    assumptions: parsed.data.assumptions,
  }, {
    calculationId: crypto.randomUUID(),
    calculatedAt: new Date().toISOString(),
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
