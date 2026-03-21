import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { logAudit } from "@/lib/audit";
import {
  SPECIALTY_EQUIPMENT_DEFAULTS,
  SPECIALTY_EQUIPMENT_LABELS,
  SPECIALTY_PROJECT_BASE_DEFAULTS,
  SPECIALTY_PROJECT_LABELS,
} from "@/lib/pricing/specialty-project-defaults";

const BASE_KEY = "specialty_project_base_prices";
const EQUIP_KEY = "specialty_equipment_surcharges";

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { data } = await db.from("platform_config").select("key, value").in("key", [BASE_KEY, EQUIP_KEY]);

  let baseOverrides: Record<string, number> = {};
  let equipOverrides: Record<string, number> = {};
  for (const r of data ?? []) {
    try {
      const parsed = JSON.parse(r.value || "{}") as Record<string, number>;
      if (r.key === BASE_KEY) baseOverrides = parsed;
      else if (r.key === EQUIP_KEY) equipOverrides = parsed;
    } catch {
      // ignore
    }
  }

  const baseMerged = { ...SPECIALTY_PROJECT_BASE_DEFAULTS, ...baseOverrides };
  const baseRows = Object.keys(baseMerged).map((key) => ({
    key,
    label: SPECIALTY_PROJECT_LABELS[key] ?? key.replace(/_/g, " "),
    basePrice: baseMerged[key] ?? 0,
  }));
  baseRows.sort((a, b) => a.label.localeCompare(b.label));

  const equipMerged = { ...SPECIALTY_EQUIPMENT_DEFAULTS, ...equipOverrides };
  const equipRows = Object.keys(equipMerged).map((key) => ({
    key,
    label: SPECIALTY_EQUIPMENT_LABELS[key] ?? key,
    surcharge: equipMerged[key] ?? 0,
  }));
  equipRows.sort((a, b) => a.label.localeCompare(b.label));

  return NextResponse.json({ baseRows, equipRows });
}

export async function PUT(req: NextRequest) {
  const { user, role, error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const body = await req.json();
  const { baseRows, equipRows } = body as {
    baseRows?: { key: string; basePrice: number }[];
    equipRows?: { key: string; surcharge: number }[];
  };

  const db = createAdminClient();

  if (Array.isArray(baseRows)) {
    const obj: Record<string, number> = {};
    for (const r of baseRows) {
      if (typeof r.key === "string" && r.key.trim()) {
        obj[r.key.trim()] = Number(r.basePrice) || 0;
      }
    }
    await db.from("platform_config").upsert(
      {
        key: BASE_KEY,
        value: JSON.stringify(obj),
        description: "Specialty quote: project-type base prices (overrides built-in defaults)",
      },
      { onConflict: "key" },
    );
  }

  if (Array.isArray(equipRows)) {
    const obj: Record<string, number> = {};
    for (const r of equipRows) {
      if (typeof r.key === "string" && r.key.trim()) {
        obj[r.key.trim()] = Number(r.surcharge) || 0;
      }
    }
    await db.from("platform_config").upsert(
      {
        key: EQUIP_KEY,
        value: JSON.stringify(obj),
        description: "Specialty quote: per-equipment surcharges",
      },
      { onConflict: "key" },
    );
  }

  logAudit({
    userId: user?.id,
    userEmail: user?.email,
    userRole: role,
    action: "edit_specialty_pricing",
    resourceType: "pricing",
    details: {},
  });

  return NextResponse.json({ ok: true });
}
