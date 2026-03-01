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
  "/api/health",
  "/api/auth/role",
  "/api/crew/login",
  "/api/crew/login-context",
  "/api/crew/logout",
  "/api/crew/register-device",
  "/api/push/vapid-public-key",
  "/api/webhooks/square",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/track/")) return true;
  if (pathname.startsWith("/api/tracking/stream/")) return true;
  if (pathname.startsWith("/api/tracking/checkpoint")) return true;
  if (pathname.startsWith("/api/tracking/location")) return true;
  if (pathname.startsWith("/api/tracking/start")) return true;
  if (pathname.startsWith("/api/crew/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (/\.(svg|png|jpg|ico|css|js|woff2?)$/.test(pathname)) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  response.headers.set("x-next-pathname", pathname);

  if (isPublic(pathname)) return response;

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/partner") && !pathname.startsWith("/partner/login")) {
      return NextResponse.redirect(new URL("/partner/login", request.url));
    }
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/crew/")) {
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
