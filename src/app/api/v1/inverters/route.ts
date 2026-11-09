import { NextResponse } from "next/server";
import { demoInverters } from "@/data/demo-catalog";

export async function GET(request: Request) {
  const allowE2eDemo = process.env.CI === "true" && process.env.EASYSOLAR_E2E_ALLOW_DEMO === "true";
  if (process.env.NODE_ENV === "production" && !allowE2eDemo) {
    return NextResponse.json({ items: [], total: 0 });
  }
  const query = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
  const items = demoInverters.filter((item) =>
    `${item.manufacturer} ${item.model}`.toLowerCase().includes(query),
  );

  return NextResponse.json({ items, total: items.length });
}
