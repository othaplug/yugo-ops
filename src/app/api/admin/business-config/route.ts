import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

const BUSINESS_KEYS = [
  "company_name", "company_legal_name", "company_phone", "company_email",
  "company_address", "company_hst_number", "business_hours", "after_hours_contact",
  "quote_expiry_days", "default_deposit_pct", "minimum_deposit", "quote_id_prefix",
  "auto_followup_enabled", "followup_max_attempts",
  "tipping_enabled", "quote_engagement_tracking", "instant_quote_widget", "valuation_upgrades",
];

export async function GET() {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("platform_config")
    .select("key, value, description")
    .in("key", BUSINESS_KEYS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const config: Record<string, string> = {};
  for (const row of data ?? []) {
    config[row.key] = row.value;
  }
  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const sb = createAdminClient();

  const updates = Object.entries(body).filter(
    ([key]) => BUSINESS_KEYS.includes(key)
  );

  for (const [key, value] of updates) {
    await sb
      .from("platform_config")
      .upsert({ key, value: String(value) }, { onConflict: "key" });
  }

  return NextResponse.json({ ok: true, updated: updates.length });
}
