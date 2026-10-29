import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next");

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const safeNext = next?.startsWith("/admin") && !next.startsWith("//")
        ? next
        : "/admin/set-password";
      return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/admin/login?error=invite-link", requestUrl.origin),
  );
}
