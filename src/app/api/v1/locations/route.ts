import { NextRequest, NextResponse } from "next/server";
import {
  getDistrictOptions,
  getProvinceOptions,
  getSubdistrictOptions,
} from "@/domain/location/thai-address";

export function GET(request: NextRequest) {
  const level = request.nextUrl.searchParams.get("level");
  const provinceId = request.nextUrl.searchParams.get("provinceId") ?? "";
  const districtId = request.nextUrl.searchParams.get("districtId") ?? "";
  let options;

  if (level === "provinces") options = getProvinceOptions();
  else if (level === "districts" && provinceId) options = getDistrictOptions(provinceId);
  else if (level === "subdistricts" && districtId) options = getSubdistrictOptions(districtId);
  else {
    return NextResponse.json({ message: "Invalid location query" }, { status: 400 });
  }

  return NextResponse.json(
    { options },
    { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
  );
}
