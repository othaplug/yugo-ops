import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { applyPmSurchargesAndUrgency, resolvePmMoveBasePrice } from "@/lib/partners/pm-contract-rate";
import { isWeekendDate, loadPmReasonRow, partnerMayUseReason, zoneForAddresses } from "@/lib/partners/pm-book-helpers";

type Urgency = "standard" | "priority" | "emergency";

function asUrgency(v: string): Urgency {
  if (v === "priority" || v === "emergency") return v;
  return "standard";
}

/** POST — estimate price for PM booking (same rules as book route). */
export async function POST(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const propertyId = String(body.partner_property_id || "");
  const contractId = String(body.contract_id || "");
  const unitType = String(body.unit_type || "2br").trim();
  const reasonCode = String(body.reason_code || "").trim();
  let fromAddress = String(body.from_address || "").trim();
  let toAddress = String(body.to_address || "").trim();
  const unitNumber = String(body.unit_number || "").trim();
  const scheduledDate = String(body.scheduled_date || "").slice(0, 10);
  const afterHours = !!body.after_hours;
  const holiday = !!body.holiday;
  let urgency = asUrgency(String(body.urgency || "standard"));
  const weekendFlag = !!body.weekend;

  if (!propertyId || !contractId || !reasonCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: prop } = await admin
    .from("partner_properties")
    .select("partner_id, service_region, address")
    .eq("id", propertyId)
    .single();
  if (!prop || prop.partner_id !== orgId) {
    return NextResponse.json({ error: "Invalid property" }, { status: 403 });
  }

  const addr = String(prop.address || "").trim();
  if ((!fromAddress || !toAddress) && addr) {
    const line = `${addr} (Unit ${unitNumber || "—"})`;
    if (!fromAddress) fromAddress = line;
    if (!toAddress) toAddress = line;
  }

  if (!fromAddress.trim() || !toAddress.trim()) {
    return NextResponse.json(
      { error: "Add origin and destination, or unit number for a same-building estimate" },
      { status: 400 },
    );
  }

  const { data: contract } = await admin.from("partner_contracts").select("partner_id, rate_card, status").eq("id", contractId).single();
  if (!contract || contract.partner_id !== orgId || !["active", "negotiating", "proposed"].includes(String(contract.status))) {
    return NextResponse.json({ error: "Invalid contract" }, { status: 403 });
  }

  const allowed = await partnerMayUseReason(admin, orgId, contractId, reasonCode);
  if (!allowed) {
    return NextResponse.json({ error: "Move type not enabled for this contract", code: "reason_not_allowed" }, { status: 400 });
  }

  const reasonRow = await loadPmReasonRow(admin, orgId, reasonCode);
  if (!reasonRow) {
    return NextResponse.json({ error: "Unknown move type" }, { status: 400 });
  }

  const urgencyDefault = String(reasonRow.urgency_default || "standard");
  if (urgency === "standard" && (urgencyDefault === "priority" || urgencyDefault === "emergency")) {
    urgency = asUrgency(urgencyDefault);
  }

  const zone = zoneForAddresses(fromAddress, toAddress, prop.service_region as string | null);
  const weekend = weekendFlag || (scheduledDate ? isWeekendDate(scheduledDate) : false);

  let basePrice: number;
  let source: "matrix" | "legacy";
  let row: Awaited<ReturnType<typeof resolvePmMoveBasePrice>>["row"];
  try {
    const resolved = await resolvePmMoveBasePrice(admin, contractId, reasonCode, unitType, zone, contract.rate_card);
    basePrice = resolved.subtotal;
    source = resolved.source;
    row = resolved.row;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No rate configured", found_rate: false },
      { status: 400 }
    );
  }

  let subtotal: number;
  try {
    subtotal = applyPmSurchargesAndUrgency(basePrice, row ?? null, contract.rate_card, {
      weekend,
      afterHours,
      holiday,
      urgency,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pricing error" }, { status: 400 });
  }

  const foundRate = row != null || source === "legacy";

  return NextResponse.json({
    zone,
    base_price: basePrice,
    subtotal,
    source,
    weekend,
    urgency,
    found_rate: foundRate,
  });
}
