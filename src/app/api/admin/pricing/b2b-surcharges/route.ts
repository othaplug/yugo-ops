import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { logAudit } from "@/lib/audit";

const ACCESS_KEYS = ["elevator", "ground_floor", "loading_dock", "walk_up_2nd", "walk_up_3rd", "walk_up_4th_plus", "long_carry", "narrow_stairs", "no_parking"];
const WEIGHT_KEYS = ["standard", "heavy", "very_heavy", "oversized_fragile"];

const ACCESS_LABELS: Record<string, string> = {
  elevator: "Elevator / Ground",
  ground_floor: "Ground Floor",
  loading_dock: "Loading Dock",
  walk_up_2nd: "Walk-up 2nd",
  walk_up_3rd: "Walk-up 3rd",
  walk_up_4th_plus: "Walk-up 4th+",
  long_carry: "Long Carry",
  narrow_stairs: "Narrow Stairs",
  no_parking: "No Parking",
};

const WEIGHT_LABELS: Record<string, string> = {
  standard: "Standard (<100 lbs)",
  heavy: "Heavy (100-250 lbs)",
  very_heavy: "Very Heavy (250-500 lbs)",
  oversized_fragile: "Oversized / Fragile",
};

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { data } = await db
    .from("platform_config")
    .select("key, value")
    .in("key", ["b2b_access_surcharges", "b2b_weight_surcharges", "b2b_accessories_excluded_from_count"]);

  const accessMap: Record<string, number> = {};
  const weightMap: Record<string, number> = {};
  let accessoriesExcluded: string[] = [];
  for (const r of data ?? []) {
    try {
      if (r.key === "b2b_accessories_excluded_from_count") {
        const parsed = JSON.parse(r.value || "[]") as unknown;
        accessoriesExcluded = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
        continue;
      }
      const parsed = JSON.parse(r.value || "{}") as Record<string, number>;
      if (r.key === "b2b_access_surcharges") Object.assign(accessMap, parsed);
      else if (r.key === "b2b_weight_surcharges") Object.assign(weightMap, parsed);
    } catch {
      // ignore
    }
  }

  const access = ACCESS_KEYS.map((k) => ({ key: k, label: ACCESS_LABELS[k] || k, surcharge: accessMap[k] ?? 0 }));
  const weight = WEIGHT_KEYS.map((k) => ({ key: k, label: WEIGHT_LABELS[k] || k, surcharge: weightMap[k] ?? 0 }));

  return NextResponse.json({ access, weight, accessoriesExcluded });
}

export async function PUT(req: NextRequest) {
  const { user, role, error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const body = await req.json();
  const { access, weight, accessoriesExcluded } = body as {
    access?: { key: string; surcharge: number }[];
    weight?: { key: string; surcharge: number }[];
    accessoriesExcluded?: string[];
  };

  const db = createAdminClient();

  if (Array.isArray(access)) {
    const accessObj: Record<string, number> = {};
    for (const a of access) {
      if (ACCESS_KEYS.includes(a.key)) accessObj[a.key] = Number(a.surcharge) || 0;
    }
    await db
      .from("platform_config")
      .upsert({ key: "b2b_access_surcharges", value: JSON.stringify(accessObj), description: "B2B delivery access surcharges" }, { onConflict: "key" });
  }

  if (Array.isArray(weight)) {
    const weightObj: Record<string, number> = {};
    for (const w of weight) {
      if (WEIGHT_KEYS.includes(w.key)) weightObj[w.key] = Number(w.surcharge) || 0;
    }
    await db
      .from("platform_config")
      .upsert({ key: "b2b_weight_surcharges", value: JSON.stringify(weightObj), description: "B2B delivery weight surcharges" }, { onConflict: "key" });
  }

  if (Array.isArray(accessoriesExcluded)) {
    const cleaned = accessoriesExcluded.map((s) => String(s).trim()).filter(Boolean);
    await db.from("platform_config").upsert(
      {
        key: "b2b_accessories_excluded_from_count",
        value: JSON.stringify(cleaned),
        description: "B2B pieces never counted toward billable item totals (coordinator reference)",
      },
      { onConflict: "key" },
    );
  }

  await logAudit({ userId: user?.id, userEmail: user?.email, userRole: role, action: "edit_b2b_surcharges", resourceType: "pricing", details: {} });

  return NextResponse.json({ ok: true });
}
