import { NextResponse } from "next/server";
import { demoInverters } from "@/data/demo-catalog";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
  const items = demoInverters.filter((item) =>
    `${item.manufacturer} ${item.model}`.toLowerCase().includes(query),
  );

  return NextResponse.json({ items, total: items.length });
}
