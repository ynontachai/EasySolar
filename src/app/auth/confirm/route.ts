import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next");
  const failureCode = type === "recovery" ? "reset-link" : "invite-link";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const safeNext = next?.startsWith("/admin") && !next.startsWith("//")
        ? next
        : "/admin/set-password";
      return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
    }

    // Log the reason only. The token itself must never reach logs.
    console.error("Auth link verification failed", { type, code: error.code, status: error.status });
  } else {
    console.error("Auth link missing token_hash or type", { hasTokenHash: Boolean(tokenHash), type });
  }

  return NextResponse.redirect(
    new URL(`/admin/login?error=${failureCode}`, requestUrl.origin),
  );
}
