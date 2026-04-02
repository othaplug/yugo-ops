import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/partner/login",
  "/crew/login",
  "/crew/setup",
  "/auth/callback",
  "/update-password",
  "/portal-disabled",
  "/privacy",
  "/terms",
  "/cookies",
  "/review",
  "/client",
  "/api/health",
  "/api/auth/role",
  "/api/auth/audit-login",
  "/api/crew/login",
  "/api/crew/login-context",
  "/api/crew/logout",
  "/api/crew/register-device",
  "/api/push/vapid-public-key",
  "/api/webhooks/square",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Crew login/setup are always public; other /crew/ routes require session (checked below)
  if (pathname === "/crew/login" || pathname === "/crew/setup") return true;
  if (pathname.startsWith("/quote/")) return true;
  if (pathname.startsWith("/quote-widget")) return true;
  if (pathname.startsWith("/pay/")) return true;
  if (pathname.startsWith("/track/")) return true;
  if (pathname.startsWith("/tracking")) return true;
  if (pathname.startsWith("/widget/")) return true;
  if (pathname.startsWith("/embed/")) return true;
  if (pathname.startsWith("/claim/")) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname.startsWith("/api/client/")) return true;
  if (pathname.startsWith("/api/contracts/")) return true;
  if (pathname.startsWith("/api/quotes/")) return true;
  if (pathname.startsWith("/api/payments/")) return true;
  if (pathname.startsWith("/api/tips/")) return true;
  if (pathname.startsWith("/api/track/")) return true;
  if (pathname.startsWith("/api/tracking/")) return true;
  if (pathname.startsWith("/api/crew/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/widget/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/slack/")) return true;
  if (pathname.startsWith("/api/claims/")) return true;
  if (pathname.startsWith("/api/review/")) return true;
  if (pathname.startsWith("/api/perks/")) return true;
  if (pathname.startsWith("/api/referrals/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (/\.(svg|png|jpg|ico|css|js|woff2?|webmanifest|json)$/.test(pathname)) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  response.headers.set("x-next-pathname", pathname);

  if (isPublic(pathname)) return response;

  // ── Crew routes: validate custom HMAC session cookie ─────────────────────
  if (pathname.startsWith("/crew/")) {
    const crewSession = request.cookies.get("yugo-crew-session");
    if (!crewSession?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/crew/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  function isRefreshTokenError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const msg = String((err as { message?: string }).message ?? "");
    return /refresh\s*token/i.test(msg);
  }

  function staleTokenRedirect(): NextResponse {
    if (pathname.startsWith("/partner")) {
      return NextResponse.redirect(new URL("/partner/login", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let user: { id: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    if (result.error && isRefreshTokenError(result.error)) {
      await supabase.auth.signOut();
      return staleTokenRedirect();
    }
    user = result.data?.user ?? null;
  } catch (err) {
    if (isRefreshTokenError(err)) {
      await supabase.auth.signOut();
      return staleTokenRedirect();
    }
    throw err;
  }

  if (!user) {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/partner") && !pathname.startsWith("/partner/login")) {
      return NextResponse.redirect(new URL("/partner/login", request.url));
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
