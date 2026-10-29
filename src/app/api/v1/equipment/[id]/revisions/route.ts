import { NextResponse } from "next/server";
import { findInverter, findPvModule } from "@/data/demo-catalog";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const equipment = findPvModule(id) ?? findInverter(id);

  if (!equipment) {
    return NextResponse.json(
      { error: "EQUIPMENT_NOT_FOUND", message: "ไม่พบอุปกรณ์ที่ระบุ" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    equipmentId: equipment.id,
    revisions: [equipment.datasheet],
  });
}
