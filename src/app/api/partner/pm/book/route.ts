import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { getContractPrice, type ContractRateCard } from "@/lib/partners/contract-pricing";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getTrackMoveSlug } from "@/lib/move-code";
import { sendSMS } from "@/lib/sms/sendSMS";

const MOVE_KIND_TO_RATE: Record<string, { key: string; weekend?: boolean }> = {
  renovation_move_out: { key: "renovation_move_out" },
  renovation_move_in: { key: "renovation_move_in" },
  renovation_bundle: { key: "renovation_bundle" },
  tenant_move_gta: { key: "tenant_move_gta" },
  tenant_move_outside: { key: "tenant_move_outside" },
};

/** POST — book a contract move (pending admin approval). */
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
  const unitNumber = String(body.unit_number || "").trim();
  const unitType = String(body.unit_type || "2br").trim();
  const moveKind = String(body.move_kind || "renovation_move_out");
  const tenantName = String(body.tenant_name || "").trim();
  const tenantPhone = String(body.tenant_phone || "").trim();
  const tenantEmail = String(body.tenant_email || "").trim();
  const fromAddress = String(body.from_address || "").trim();
  const toAddress = String(body.to_address || "").trim();
  const scheduledDate = String(body.scheduled_date || "").slice(0, 10);
  const scheduledTime = String(body.scheduled_time || "").trim() || "Morning";
  const instructions = String(body.special_instructions || "").trim();
  const weekend = !!body.weekend;
  const afterHours = !!body.after_hours;
  const holiday = !!body.holiday;

  if (!propertyId || !contractId || !unitNumber || !tenantName || !scheduledDate || !fromAddress || !toAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: prop } = await admin
    .from("partner_properties")
    .select("id, partner_id, building_name, address")
    .eq("id", propertyId)
    .single();
  if (!prop || prop.partner_id !== orgId) {
    return NextResponse.json({ error: "Invalid property" }, { status: 400 });
  }

  const { data: contract } = await admin
    .from("partner_contracts")
    .select("id, partner_id, rate_card, status, tenant_comms_by")
    .eq("id", contractId)
    .single();
  if (!contract || contract.partner_id !== orgId || !["active", "negotiating", "proposed"].includes(String(contract.status))) {
    return NextResponse.json({ error: "Invalid or inactive contract" }, { status: 400 });
  }

  const rateMap = MOVE_KIND_TO_RATE[moveKind];
  if (!rateMap) {
    return NextResponse.json({ error: "Invalid move type" }, { status: 400 });
  }

  let subtotal: number;
  try {
    subtotal = getContractPrice(contract.rate_card as ContractRateCard, rateMap.key, unitType, {
      weekend: weekend || rateMap.weekend,
      afterHours,
      holiday,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pricing error" }, { status: 400 });
  }

  const moveCode = `PM${Date.now().toString(36).toUpperCase().slice(-8)}`;

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();

  const { data: move, error: insErr } = await admin
    .from("moves")
    .insert({
      organization_id: orgId,
      contract_id: contractId,
      partner_property_id: propertyId,
      unit_number: unitNumber,
      tenant_name: tenantName,
      tenant_phone: tenantPhone || null,
      tenant_email: tenantEmail || null,
      client_name: tenantName,
      client_phone: tenantPhone || null,
      client_email: tenantEmail || null,
      from_address: fromAddress,
      to_address: toAddress,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      status: "pending_approval",
      service_type: "b2b_oneoff",
      move_type: "residential",
      move_code: moveCode,
      pm_move_kind: moveKind,
      amount: subtotal,
      estimate: subtotal,
      internal_notes: [
        "Partner PM booking (pending approval)",
        instructions ? `Instructions: ${instructions}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .select("id, move_code")
    .single();

  if (insErr || !move) {
    return NextResponse.json({ error: insErr?.message || "Failed to create move" }, { status: 400 });
  }

  const moveId = move.id as string;
  const partnerName = (org as { name?: string } | null)?.name || "Partner";

  await notifyAdmins("partner_pm_booking", {
    subject: `New PM booking — ${partnerName}`,
    body: `Unit ${unitNumber} · ${(prop as { building_name?: string }).building_name || "Building"} · ${scheduledDate}. Awaiting approval.`,
    moveId,
    sourceId: moveId,
  });

  if (contract.tenant_comms_by === "yugo" && tenantPhone) {
    const digits = tenantPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
      const trackUrl = `${getEmailBaseUrl()}/track/move/${getTrackMoveSlug({ move_code: moveCode, id: moveId })}?token=${signTrackToken("move", moveId)}`;
      const msg = [
        `Hi ${tenantName},`,
        `Your building has scheduled a move for unit ${unitNumber} on ${scheduledDate} (${scheduledTime}).`,
        `Track your move: ${trackUrl}`,
        `Questions? Call (647) 370-4525.`,
      ].join("\n");
      try {
        await sendSMS(digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits.slice(-10)}`, msg);
      } catch {
        /* non-fatal */
      }
    }
  }

  return NextResponse.json({ ok: true, move_id: moveId, move_code: moveCode, subtotal });
}
