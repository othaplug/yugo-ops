import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { invalidateConfigCache } from "@/lib/config";
import { logAudit } from "@/lib/audit";

const BUSINESS_KEYS = [
  // Company info
  "company_name", "company_legal_name", "company_phone", "company_email",
  "company_address", "company_hst_number", "business_hours", "after_hours_contact",
  "company_website", "dispatch_phone",
  // Notification / email
  "notifications_from_email", "admin_notification_email",
  // Social media
  "company_social_instagram", "company_social_facebook",
  "company_social_twitter", "company_social_linkedin",
  // Review & reputation
  "company_review_url",
  // Quoting
  "quote_expiry_days", "default_deposit_pct", "minimum_deposit", "quote_id_prefix",
  "auto_followup_enabled", "followup_max_attempts",
  // Client inventory change requests (pre-move add/remove items)
  "change_request_enabled", "change_request_per_score_rate",
  "change_request_min_hours_before_move", "change_request_max_items_per_request",
  // Feature toggles
  "tipping_enabled", "quote_engagement_tracking", "instant_quote_widget", "valuation_upgrades", "sms_eta_enabled",
  "quote_sms_enabled",
  "weather_alerts_enabled",
  // Review requests
  "auto_review_requests", "google_review_url", "google_review_count_label",
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
  const { user, error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const sb = createAdminClient();

  const updates = Object.entries(body).filter(
    ([key]) => BUSINESS_KEYS.includes(key)
  );

  for (const [key, value] of updates) {
    const { error } = await sb
      .from("platform_config")
      .upsert({ key, value: String(value) }, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  invalidateConfigCache();

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "config_change",
    resourceType: "config",
    details: { keys: updates.map(([k]) => k) },
  });

  return NextResponse.json({ ok: true, updated: updates.length });
}
