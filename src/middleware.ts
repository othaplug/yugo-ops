import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Crew routes: check custom JWT cookie ──────────────────────────────────
  const isCrewRoute =
    pathname.startsWith("/crew") && !pathname.startsWith("/crew/login");
  if (isCrewRoute) {
    const crewSession = req.cookies.get("yugo-crew-session");
    if (!crewSession?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/crew/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Admin and Partner routes: check Supabase session ─────────────────────
  const isProtected =
    pathname.startsWith("/admin") || pathname.startsWith("/partner");
  if (!isProtected) return NextResponse.next();

  // Allow partner login through
  if (pathname === "/partner/login") return NextResponse.next();

  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.startsWith("/partner") ? "/partner/login" : "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/partner/:path*",
    "/crew/:path*",
  ],
};
