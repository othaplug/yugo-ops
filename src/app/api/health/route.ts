import { NextResponse } from "next/server";

/**
 * GET /api/health — for load balancers and deployment checks.
 * In production, returns 503 if required env vars are missing.
 */
export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  const issues: string[] = [];

  const required = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL },
    { key: "TRACK_SIGNING_SECRET", value: process.env.TRACK_SIGNING_SECRET },
    { key: "CREW_SESSION_SECRET", value: process.env.CREW_SESSION_SECRET },
  ];

  for (const { key, value } of required) {
    const v = (value || "").trim();
    if (v.length < 16) {
      issues.push(key);
    }
    if (key === "TRACK_SIGNING_SECRET" && v === "your-random-secret-at-least-32-chars") issues.push(key);
    if (key === "CREW_SESSION_SECRET" && (v === "dev-crew-secret-change-in-production" || v === "your-crew-secret-at-least-32-chars")) issues.push(key);
  }

  if (isProduction && (!process.env.SUPER_ADMIN_EMAIL?.trim() || process.env.SUPER_ADMIN_EMAIL.trim().length < 3)) {
    issues.push("SUPER_ADMIN_EMAIL");
  }

  const ok = !isProduction || issues.length === 0;
  const status = ok ? 200 : 503;
  return NextResponse.json(
    {
      ok,
      env: isProduction && issues.length ? { missing: issues } : undefined,
    },
    { status }
  );
}
