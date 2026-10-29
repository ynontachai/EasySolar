import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copySessionResponse(
  source: NextResponse,
  destination: NextResponse,
) {
  for (const cookie of source.cookies.getAll()) destination.cookies.set(cookie);
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) destination.headers.set(name, value);
  }

  return destination;
}

export async function updateSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });
        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const isPublicAdminRoute =
    pathname === "/admin/login" || pathname === "/admin/set-password";

  if (pathname.startsWith("/admin") && !isPublicAdminRoute && !data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return copySessionResponse(response, NextResponse.redirect(loginUrl));
  }

  return response;
}
