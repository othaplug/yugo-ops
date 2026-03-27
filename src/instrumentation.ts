import { collectServerEnvIssues } from "@/lib/server-env-check";

export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV !== "production") return;

  const issues = collectServerEnvIssues();
  if (issues.length === 0) return;

  const msg = `[env] Production startup: missing or invalid: ${issues.join(", ")}`;
  console.error(msg);
  throw new Error(msg);
}
