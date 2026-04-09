import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/check-role";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

const PM_MATRIX_UNIT_SIZES = new Set(["studio", "1br", "2br", "3br", "4br_plus"]);
const PM_MATRIX_ZONES = new Set([
  "same_building",
  "local",
  "within_region",
  "to_from_toronto",
  "outside_gta",
]);

/**
 * POST — upsert one pm_rate_cards row (e.g. first edit when template-only bundle row had no DB id).
 * Super admin only. Scoped to the partner via contract ownership.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireSuperAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;
  const body = await req.json();

  const contractId = typeof body.contract_id === "string" ? body.contract_id.trim() : "";
  const reasonCode = typeof body.reason_code === "string" ? body.reason_code.trim() : "";
  const unitSize = typeof body.unit_size === "string" ? body.unit_size.trim() : "";
  const zoneRaw = typeof body.zone === "string" ? body.zone.trim() : "local";
  const zone = PM_MATRIX_ZONES.has(zoneRaw) ? zoneRaw : "local";

  if (!contractId || !reasonCode || !unitSize) {
    return NextResponse.json({ error: "contract_id, reason_code, and unit_size required" }, { status: 400 });
  }
  if (!PM_MATRIX_UNIT_SIZES.has(unitSize)) {
    return NextResponse.json({ error: "Invalid unit_size" }, { status: 400 });
  }

  const baseN = typeof body.base_rate === "number" ? body.base_rate : parseFloat(String(body.base_rate ?? ""));
  const wkndN =
    typeof body.weekend_surcharge === "number" ? body.weekend_surcharge : parseFloat(String(body.weekend_surcharge ?? ""));
  if (Number.isNaN(baseN) || baseN < 0 || Number.isNaN(wkndN) || wkndN < 0) {
    return NextResponse.json({ error: "Invalid base_rate or weekend_surcharge" }, { status: 400 });
  }

  const { data: org } = await db
    .from("organizations")
    .select("vertical, type")
    .eq("id", partnerId)
    .single();
  const orgVertical = String((org as { vertical?: string; type?: string } | null)?.vertical || (org as { type?: string } | null)?.type || "");
  if (!isPropertyManagementDeliveryVertical(orgVertical)) {
    return NextResponse.json({ error: "Partner is not a property management portfolio account" }, { status: 400 });
  }

  const { data: contract, error: cErr } = await db
    .from("partner_contracts")
    .select("id, partner_id")
    .eq("id", contractId)
    .maybeSingle();
  if (cErr || !contract || contract.partner_id !== partnerId) {
    return NextResponse.json({ error: "Contract not found for this partner" }, { status: 403 });
  }

  const rowPayload = {
    contract_id: contractId,
    reason_code: reasonCode,
    unit_size: unitSize,
    zone,
    base_rate: baseN,
    weekend_surcharge: wkndN,
    active: true,
  };

  const { data: upserted, error: upErr } = await db
    .from("pm_rate_cards")
    .upsert(rowPayload, { onConflict: "contract_id,reason_code,unit_size,zone" })
    .select("id")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: linkErr } = await db.from("pm_contract_reason_codes").upsert(
    { contract_id: contractId, reason_code: reasonCode, active: true },
    { onConflict: "contract_id,reason_code" }
  );
  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: upserted?.id ?? null });
}

/**
 * PATCH — update one pm_rate_cards row for this partner's active (or only) contract.
 * Super admin only. Scoped to the partner via contract ownership.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireSuperAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;
  const body = await req.json();
  const rowId = typeof body.row_id === "string" ? body.row_id.trim() : "";
  if (!rowId) {
    return NextResponse.json({ error: "row_id required" }, { status: 400 });
  }

  const { data: org } = await db
    .from("organizations")
    .select("vertical, type")
    .eq("id", partnerId)
    .single();
  const orgVertical = String((org as { vertical?: string; type?: string } | null)?.vertical || (org as { type?: string } | null)?.type || "");
  if (!isPropertyManagementDeliveryVertical(orgVertical)) {
    return NextResponse.json({ error: "Partner is not a property management portfolio account" }, { status: 400 });
  }

  const { data: row, error: rowErr } = await db
    .from("pm_rate_cards")
    .select("id, contract_id")
    .eq("id", rowId)
    .maybeSingle();
  if (rowErr || !row) {
    return NextResponse.json({ error: "Rate row not found" }, { status: 404 });
  }

  const { data: contract } = await db
    .from("partner_contracts")
    .select("id, partner_id")
    .eq("id", row.contract_id as string)
    .single();
  if (!contract || contract.partner_id !== partnerId) {
    return NextResponse.json({ error: "Rate row does not belong to this partner" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.base_rate !== undefined) {
    const n = typeof body.base_rate === "number" ? body.base_rate : parseFloat(String(body.base_rate));
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Invalid base_rate" }, { status: 400 });
    }
    updates.base_rate = n;
  }
  if (body.weekend_surcharge !== undefined) {
    const n = typeof body.weekend_surcharge === "number" ? body.weekend_surcharge : parseFloat(String(body.weekend_surcharge));
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Invalid weekend_surcharge" }, { status: 400 });
    }
    updates.weekend_surcharge = n;
  }
  if (body.after_hours_premium !== undefined) {
    const n = typeof body.after_hours_premium === "number" ? body.after_hours_premium : parseFloat(String(body.after_hours_premium));
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Invalid after_hours_premium" }, { status: 400 });
    }
    updates.after_hours_premium = n;
  }
  if (body.holiday_surcharge !== undefined) {
    const n = typeof body.holiday_surcharge === "number" ? body.holiday_surcharge : parseFloat(String(body.holiday_surcharge));
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Invalid holiday_surcharge" }, { status: 400 });
    }
    updates.holiday_surcharge = n;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error: upErr } = await db.from("pm_rate_cards").update(updates).eq("id", rowId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
