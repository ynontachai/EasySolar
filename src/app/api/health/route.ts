import { NextResponse } from "next/server";
import { ENGINE_VERSION } from "@/domain/sizing/engine";

export function GET() {
  return NextResponse.json({ status: "ok", engineVersion: ENGINE_VERSION });
}
