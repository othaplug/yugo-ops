import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * Overhead config — GET reads all overhead + cost model keys from platform_config.
 * PATCH upserts changed values.
 * Custom line items stored as JSON in the `custom_overhead_items` key.
 */

const STANDARD_OVERHEAD_KEYS = [
  "monthly_software_cost",
  "monthly_auto_insurance",
  "monthly_gl_insurance",
  "monthly_marketing_budget",
  "monthly_office_admin",
  "monthly_owner_draw",
  "custom_overhead_items",   // JSON: [{id, label, amount}]
];

const COST_MODEL_KEYS = [
  "crew_hourly_cost",
  "fuel_cost_per_km",
  // Truck daily rates (auto-derived from monthly if monthly is set)
  "truck_daily_cost_sprinter",
  "truck_daily_cost_16ft",
  "truck_daily_cost_20ft",
  "truck_daily_cost_26ft",
  // Truck monthly lease/rental costs (used to derive daily rate)
  "truck_monthly_cost_sprinter",
  "truck_monthly_cost_16ft",
  "truck_monthly_cost_20ft",
  "truck_monthly_cost_26ft",
  // Working days per month used for daily rate derivation
  "truck_working_days_per_month",
  "payment_processing_pct",
  "payment_processing_flat",
  "target_gross_margin_pct",
];

export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const sb = createAdminClient();
  const keys = [...STANDARD_OVERHEAD_KEYS, ...COST_MODEL_KEYS];
  const { data, error } = await sb.from("platform_config").select("key, value").in("key", keys);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const config: Record<string, string> = {};
  for (const row of data ?? []) config[row.key] = row.value;

  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const body: Record<string, string> = await req.json();
  const allowed = new Set([...STANDARD_OVERHEAD_KEYS, ...COST_MODEL_KEYS]);

  const sb = createAdminClient();
  const entries = Object.entries(body).filter(([k]) => allowed.has(k));
  if (entries.length === 0) return NextResponse.json({ error: "No valid keys" }, { status: 400 });

  for (const [key, value] of entries) {
    const { error } = await sb.from("platform_config").upsert({ key, value: String(value) }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: entries.length });
}
