import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { invalidateConfigCache } from "@/lib/config";

/**
 * Overhead config — GET reads all overhead + cost model keys from platform_config.
 * PATCH upserts changed values.
 * Custom line items stored as JSON in the `custom_overhead_items` key.
 */

const STANDARD_OVERHEAD_KEYS = [
  "monthly_software_cost",
  "monthly_auto_insurance",
  "monthly_gl_insurance",
  // Added 2026-06-10 — luxury-business OH categories previously invisible.
  // Operator owes a one-time backfill from current P&L; default 0 means no
  // behaviour change until the value is set.
  "monthly_wsib",                 // Workers' Comp / WSIB premium
  "monthly_movers_liability",     // Cargo / movers' liability (distinct from GL)
  "monthly_bookkeeping",          // Outsourced bookkeeping / accounting
  "monthly_phone_internet",       // Mobile lines, office internet, hotspots
  "monthly_vehicle_maintenance",  // Oil, tires, brakes, washes (NOT lease)
  "monthly_marketing_budget",
  "monthly_office_admin",
  "monthly_owner_draw",
  "custom_overhead_items",   // JSON: [{id, label, amount}]
];

const COST_MODEL_KEYS = [
  "crew_hourly_cost",
  "fuel_cost_per_km",
  "fuel_price_gas_cad_per_litre",
  "fuel_price_diesel_cad_per_litre",
  "navigation_fuel_type",
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
  // Claims reserve as a % of revenue. Applied per-job (scales with job size),
  // not part of monthly OH burn. Default 0.005 (0.5%) — industry standard
  // for damages/disputes provisioning.
  "overhead_claims_reserve_pct",
  // Per-tier true-margin floors (luxury positioning). Engine surfaces a
  // warning if a tier's projected true margin falls below these; does NOT
  // auto-bump price. See PR 5.
  "true_margin_floor_essential",
  "true_margin_floor_signature",
  "true_margin_floor_estate",
  // Per-role base wages — fed into the loaded-rate calculator
  // (src/lib/finance/payroll-burden.ts) so the engine derives crew
  // cost from auditable inputs instead of a magic $28 number.
  "crew_pay_rate_mover",
  "crew_pay_rate_driver",
  "crew_pay_rate_lead",
  // Payroll burden constants (Ontario 2026 defaults — see
  // payroll-burden.ts for verified sources). Operator updates these
  // each January when CRA + WSIB publish new rates.
  "payroll_burden_cpp_pct",
  "payroll_burden_ei_pct",
  "payroll_burden_wsib_pct",
  "payroll_burden_vacation_pct",
  "payroll_burden_eht_pct",
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

  for (const [key, raw] of entries) {
    let value = String(raw);
    if (key === "navigation_fuel_type") {
      value = value.toLowerCase().trim() === "diesel" ? "diesel" : "gas";
    }
    if (key === "fuel_price_gas_cad_per_litre" || key === "fuel_price_diesel_cad_per_litre") {
      const n = parseFloat(value);
      if (!Number.isFinite(n) || n <= 0 || n > 50) {
        return NextResponse.json({ error: `Invalid ${key} (use a positive CAD/L amount)` }, { status: 400 });
      }
      value = String(n);
    }
    const { error } = await sb.from("platform_config").upsert({ key, value }, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateConfigCache();

  return NextResponse.json({ ok: true, updated: entries.length });
}
