import { NextResponse } from "next/server";

import { collectServerEnvIssues } from "@/lib/server-env-check";

/**
 * GET /api/health — for load balancers and deployment checks.
 * In production, returns 503 if required env vars are missing.
 */
export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  const issues = collectServerEnvIssues();

  const ok = !isProduction || issues.length === 0;
  const status = ok ? 200 : 503;
  return NextResponse.json(
    {
      ok,
      ...(isProduction && issues.length ? { issues: issues.length } : {}),
      ...(!isProduction && issues.length ? { missing: issues } : {}),
    },
    { status }
  );
}
