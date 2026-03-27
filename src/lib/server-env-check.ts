/**
 * Shared checks for server/runtime configuration (used by /api/health and instrumentation).
 */

const PLACEHOLDER_TRACK = "your-random-secret-at-least-32-chars";
const PLACEHOLDER_CREW_DEV = "dev-crew-secret-change-in-production";
const PLACEHOLDER_CREW = "your-crew-secret-at-least-32-chars";

export function collectServerEnvIssues(): string[] {
  const issues: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  const required: { key: string; value: string | undefined }[] = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL },
    { key: "TRACK_SIGNING_SECRET", value: process.env.TRACK_SIGNING_SECRET },
    { key: "CREW_SESSION_SECRET", value: process.env.CREW_SESSION_SECRET },
  ];

  for (const { key, value } of required) {
    const v = (value || "").trim();
    if (v.length < 16) issues.push(key);
    if (key === "TRACK_SIGNING_SECRET" && v === PLACEHOLDER_TRACK) issues.push(key);
    if (
      key === "CREW_SESSION_SECRET" &&
      (v === PLACEHOLDER_CREW_DEV || v === PLACEHOLDER_CREW)
    ) {
      issues.push(key);
    }
  }

  if (
    isProduction &&
    (!process.env.SUPER_ADMIN_EMAIL?.trim() || process.env.SUPER_ADMIN_EMAIL.trim().length < 3)
  ) {
    issues.push("SUPER_ADMIN_EMAIL");
  }

  return issues;
}

export function isProductionServerEnvOk(): boolean {
  return process.env.NODE_ENV !== "production" || collectServerEnvIssues().length === 0;
}
