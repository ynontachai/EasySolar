import { NextResponse } from "next/server";
import { demoPvModules } from "@/data/demo-catalog";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
  const items = demoPvModules.filter((item) =>
    `${item.manufacturer} ${item.model}`.toLowerCase().includes(query),
  );

  return NextResponse.json({ items, total: items.length });
}
