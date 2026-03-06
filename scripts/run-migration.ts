/**
 * Run a specific migration against the remote Supabase database.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<token> npx tsx scripts/run-migration.ts
 *
 * Get your access token at:
 *   https://supabase.com/dashboard/account/tokens
 */

import fs from "fs";
import path from "path";

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = "mpaqqjhxrgxuwumirwxo";
const MIGRATION_FILE = path.join(
  process.cwd(),
  "supabase/migrations/20250310000000_rate_card_templates.sql"
);

async function main() {
  if (!ACCESS_TOKEN) {
    console.error(
      "❌ Missing SUPABASE_ACCESS_TOKEN\n\n" +
        "Get a personal access token from:\n" +
        "  https://supabase.com/dashboard/account/tokens\n\n" +
        "Then run:\n" +
        "  SUPABASE_ACCESS_TOKEN=<your-token> npx tsx scripts/run-migration.ts\n"
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
  console.log(`📋 Running migration: ${path.basename(MIGRATION_FILE)}`);
  console.log(`🔗 Project: ${PROJECT_REF}\n`);

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("❌ Migration failed:", body);
    process.exit(1);
  }

  console.log("✅ Migration applied successfully!");
  if (body && Object.keys(body).length > 0) {
    console.log("Response:", JSON.stringify(body, null, 2));
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
