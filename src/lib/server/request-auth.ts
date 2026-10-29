import "server-only";
import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./http-error";

function hasMatchingBearerToken(request: Request, expectedToken?: string) {
  if (!expectedToken) return false;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const suppliedToken = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expectedToken);
  const suppliedBuffer = Buffer.from(suppliedToken);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function requireAdminRequest(request: Request) {
  if (!hasMatchingBearerToken(request, process.env.EASYSOLAR_ADMIN_TOKEN)) {
    throw new HttpError(401, "ADMIN_AUTH_REQUIRED", "ต้องยืนยันสิทธิ์ผู้ดูแลระบบ");
  }
}

export function requireScannerRequest(request: Request) {
  if (!hasMatchingBearerToken(request, process.env.EASYSOLAR_SCANNER_TOKEN)) {
    throw new HttpError(401, "SCANNER_AUTH_REQUIRED", "Scanner token ไม่ถูกต้อง");
  }
}
