import { NextResponse } from "next/server";
import { findInverter, findPvModule } from "@/data/demo-catalog";
import { findPublishedEquipmentRevisions } from "@/lib/server/datasheet-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const persistedRevisions = await findPublishedEquipmentRevisions(id);

  if (persistedRevisions !== null) {
    if (persistedRevisions.length === 0) {
      return NextResponse.json(
        { error: "EQUIPMENT_NOT_FOUND", message: "ไม่พบอุปกรณ์ที่ระบุ" },
        { status: 404 },
      );
    }

    return NextResponse.json({ equipmentId: id, revisions: persistedRevisions });
  }

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
