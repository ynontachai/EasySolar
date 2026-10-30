import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Email scanners (for example Outlook Safe Links) send GET and HEAD requests to every link.
// Verifying on GET would consume the single-use token before the person clicks, so GET only
// shows a confirmation button and the token is verified on POST.

const allowedTypes = new Set<EmailOtpType>(["invite", "recovery"]);

function safeNext(value: string | null) {
  return value?.startsWith("/admin") && !value.startsWith("//")
    ? value
    : "/admin/set-password";
}

function failureRedirect(request: Request, type: string | null) {
  const code = type === "recovery" ? "reset-link" : "invite-link";
  return NextResponse.redirect(new URL(`/admin/login?error=${code}`, request.url));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function confirmationPage({
  next,
  tokenHash,
  type,
}: {
  next: string;
  tokenHash: string;
  type: EmailOtpType;
}) {
  const heading = type === "invite" ? "ยืนยันคำเชิญเข้าใช้งาน" : "ยืนยันการรีเซ็ตรหัสผ่าน";
  const action = type === "invite" ? "ยืนยันและตั้งรหัสผ่าน" : "ยืนยันและตั้งรหัสผ่านใหม่";

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${heading} | EasySolar</title>
  <style>
    body { background: #f6f5f1; color: #111827; font-family: system-ui, sans-serif; margin: 0; }
    main { max-width: 440px; margin: 0 auto; padding: 96px 18px; }
    h1 { font-size: 26px; margin: 0 0 12px; }
    p { color: #475467; line-height: 1.6; }
    button { background: #f0a340; border: 0; border-radius: 8px; color: #111827; cursor: pointer; font: inherit; font-weight: 700; min-height: 44px; padding: 10px 18px; width: 100%; }
    button:focus-visible { outline: 3px solid #2457d6; outline-offset: 2px; }
  </style>
</head>
<body>
  <main>
    <h1>${heading}</h1>
    <p>กดปุ่มด้านล่างเพื่อเข้าสู่ระบบหลังบ้าน EasySolar</p>
    <form method="post" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}">
      <input type="hidden" name="type" value="${escapeHtml(type)}">
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <button type="submit">${action}</button>
    </form>
  </main>
</body>
</html>`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  if (!tokenHash || !type || !allowedTypes.has(type as EmailOtpType)) {
    console.error("Auth link missing token_hash or type", { hasTokenHash: Boolean(tokenHash), type });
    return failureRedirect(request, type);
  }

  return new NextResponse(
    confirmationPage({
      next: safeNext(requestUrl.searchParams.get("next")),
      tokenHash,
      type: type as EmailOtpType,
    }),
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const next = form.get("next");

  if (typeof tokenHash !== "string" || typeof type !== "string" || !allowedTypes.has(type as EmailOtpType)) {
    console.error("Auth confirm rejected invalid form", { type });
    return failureRedirect(request, typeof type === "string" ? type : null);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (!error) {
    return NextResponse.redirect(new URL(safeNext(typeof next === "string" ? next : null), request.url), 303);
  }

  // Log the reason only. The token itself must never reach logs.
  console.error("Auth link verification failed", { type, code: error.code, status: error.status });
  return failureRedirect(request, type);
}
