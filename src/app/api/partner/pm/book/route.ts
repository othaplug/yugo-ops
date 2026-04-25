import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getTrackMoveSlug } from "@/lib/move-code";
import { sendSMS } from "@/lib/sms/sendSMS";
import { applyPmSurchargesAndUrgency, resolvePmMoveBasePrice } from "@/lib/partners/pm-contract-rate";
import {
  isWeekendDate,
  loadPmReasonRow,
  normalizePmReasonCode,
  pairedReturnReason,
  partnerMayUseReason,
  zoneForAddresses,
} from "@/lib/partners/pm-book-helpers";

type Urgency = "standard" | "priority" | "emergency";

function asUrgency(v: string): Urgency {
  if (v === "priority" || v === "emergency") return v;
  return "standard";
}

/** POST — book a contract move (pending admin approval). Universal reason + zone pricing. */
export async function POST(req: NextRequest) {
  const { orgIds, userId, error } = await requirePartner();
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
  const reasonCode = normalizePmReasonCode(body);
  const tenantName = String(body.tenant_name || "").trim();
  const tenantPhone = String(body.tenant_phone || "").trim();
  const tenantEmail = String(body.tenant_email || "").trim();
  const vacantNoTenant = !!body.vacant_no_tenant;
  const fromAddress = String(body.from_address || "").trim();
  const toAddress = String(body.to_address || "").trim();
  const scheduledDate = String(body.scheduled_date || "").slice(0, 10);
  const returnScheduledDate = String(body.return_scheduled_date || "").slice(0, 10);
  const scheduledTime = String(body.scheduled_time || "").trim() || "8 AM – 10 AM";
  const instructions = String(body.special_instructions || "").trim();
  const unitFloor = String(body.unit_floor || "").trim();
  const pmProjectId = String(body.pm_project_id || "").trim() || null;

  const afterHours = !!body.after_hours;
  const holiday = !!body.holiday;
  let urgency = asUrgency(String(body.urgency || "standard"));
  const weekendFlag = !!body.weekend;

  const addonSelections = Array.isArray(body.addon_selections) ? body.addon_selections : [];
  /** Per-request override: `yugo` = text tenant; `partner` = PM receives tracking link; omit = contract default. */
  const tenantCommsMode = String(body.tenant_comms_mode || "").trim().toLowerCase();

  if (!propertyId || !contractId || !unitNumber || !scheduledDate || !fromAddress || !toAddress || !reasonCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!vacantNoTenant && !tenantName) {
    return NextResponse.json({ error: "Tenant name is required unless the unit is vacant" }, { status: 400 });
  }

  const displayTenant = vacantNoTenant ? "Vacant unit" : tenantName;

  const { data: prop } = await admin
    .from("partner_properties")
    .select("id, partner_id, building_name, address, service_region")
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

  const reasonRow = await loadPmReasonRow(admin, orgId, reasonCode);
  if (!reasonRow) {
    return NextResponse.json({ error: "Unknown move type" }, { status: 400 });
  }

  const allowed = await partnerMayUseReason(admin, orgId, contractId, reasonCode);
  if (!allowed) {
    return NextResponse.json({ error: "This move type is not enabled for your contract" }, { status: 403 });
  }

  if (pmProjectId) {
    const { data: proj } = await admin.from("pm_projects").select("id, partner_id").eq("id", pmProjectId).single();
    if (!proj || proj.partner_id !== orgId) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }
  }

  const urgencyDefault = String(reasonRow.urgency_default || "standard");
  if (urgency === "standard" && (urgencyDefault === "priority" || urgencyDefault === "emergency")) {
    urgency = asUrgency(urgencyDefault);
  }

  const zone = zoneForAddresses(fromAddress, toAddress, prop.service_region as string | null);
  const weekend = weekendFlag || isWeekendDate(scheduledDate);

  let basePrice: number;
  let row: Awaited<ReturnType<typeof resolvePmMoveBasePrice>>["row"];
  try {
    const resolved = await resolvePmMoveBasePrice(admin, contractId, reasonCode, unitType, zone, contract.rate_card);
    basePrice = resolved.subtotal;
    row = resolved.row;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No rate configured for this move type, unit size, or zone" },
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

  const requiresReturn = !!(reasonRow.requires_return_move || reasonRow.is_round_trip);
  const returnReason = pairedReturnReason(reasonCode);
  if (requiresReturn && !returnScheduledDate) {
    return NextResponse.json({ error: "Return move date is required for this move type" }, { status: 400 });
  }

  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).single();

  const notesParts = [
    "Partner PM booking (pending approval)",
    `Move reason: ${reasonCode}`,
    `Zone: ${zone}`,
    unitFloor ? `Floor: ${unitFloor}` : "",
    instructions ? `Instructions: ${instructions}` : "",
  ];
  if (addonSelections.length) {
    const lines = addonSelections
      .map((a: unknown) => {
        if (!a || typeof a !== "object") return "";
        const o = a as Record<string, unknown>;
        return `${o.label || o.addon_code || "Add-on"}: $${o.price ?? "—"}`;
      })
      .filter(Boolean);
    if (lines.length) notesParts.push(`Add-ons:\n${lines.join("\n")}`);
  }

  const insertPayload = {
    organization_id: orgId,
    contract_id: contractId,
    partner_property_id: propertyId,
    pm_project_id: pmProjectId,
    unit_number: unitNumber,
    tenant_name: displayTenant,
    tenant_phone: tenantPhone || null,
    tenant_email: tenantEmail || null,
    client_name: displayTenant,
    client_phone: tenantPhone || null,
    client_email: tenantEmail || null,
    from_address: fromAddress,
    to_address: toAddress,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    status: "pending_approval",
    service_type: "b2b_oneoff",
    move_type: "residential",
    pm_move_kind: reasonCode,
    pm_reason_code: reasonCode,
    pm_zone: zone,
    pm_urgency: urgency,
    amount: subtotal,
    estimate: subtotal,
    internal_notes: notesParts.filter(Boolean).join("\n"),
  };

  const { data: move, error: insErr } = await admin.from("moves").insert(insertPayload).select("id, move_code").single();

  if (insErr || !move) {
    return NextResponse.json({ error: insErr?.message || "Failed to create move" }, { status: 400 });
  }

  const moveId = move.id as string;
  const moveCode = (move.move_code as string) || moveId;
  const partnerName = (org as { name?: string } | null)?.name || "Partner";

  let returnMoveId: string | null = null;
  if (requiresReturn && returnScheduledDate) {
    const returnAllowed = await partnerMayUseReason(admin, orgId, contractId, returnReason);
    if (!returnAllowed) {
      /* still create primary; ops can price return manually */
    } else {
      let baseR: number;
      let rowR: Awaited<ReturnType<typeof resolvePmMoveBasePrice>>["row"];
      try {
        const resolved = await resolvePmMoveBasePrice(admin, contractId, returnReason, unitType, zone, contract.rate_card);
        baseR = resolved.subtotal;
        rowR = resolved.row;
      } catch {
        baseR = basePrice;
        rowR = row;
      }
      const subR = applyPmSurchargesAndUrgency(baseR, rowR ?? null, contract.rate_card, {
        weekend: isWeekendDate(returnScheduledDate),
        afterHours,
        holiday,
        urgency,
      });
      const { data: retMove, error: retErr } = await admin
        .from("moves")
        .insert({
          ...insertPayload,
          from_address: toAddress,
          to_address: fromAddress,
          scheduled_date: returnScheduledDate,
          pm_reason_code: returnReason,
          pm_move_kind: returnReason,
          pm_parent_move_id: moveId,
          amount: subR,
          estimate: subR,
          internal_notes: [
            `Linked return leg for move ${move.move_code || moveId}`,
            `Move reason: ${returnReason}`,
            `Zone: ${zone}`,
            instructions ? `Instructions: ${instructions}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        })
        .select("id")
        .single();
      if (!retErr && retMove) returnMoveId = retMove.id as string;
    }
  }

  await notifyAdmins("partner_pm_booking", {
    subject: `New PM booking — ${partnerName}`,
    body: `Unit ${unitNumber} · ${(prop as { building_name?: string }).building_name || "Building"} · ${scheduledDate}. Awaiting approval.`,
    moveId,
    sourceId: moveId,
  });

  const trackUrl = `${getEmailBaseUrl().replace(/\/$/, "")}/track/move/${getTrackMoveSlug({ move_code: moveCode, id: moveId })}?token=${signTrackToken("move", moveId)}`;

  const contractPrefYugo = String(contract.tenant_comms_by || "").toLowerCase() === "yugo";
  const yugoContactsTenant =
    tenantCommsMode === "yugo" || (tenantCommsMode !== "partner" && contractPrefYugo);

  if (yugoContactsTenant && tenantPhone && !vacantNoTenant) {
    const digits = tenantPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
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

  const pmShouldGetTrackingEmail =
    !!userId &&
    (tenantCommsMode === "partner" || !yugoContactsTenant || vacantNoTenant);
  if (pmShouldGetTrackingEmail && userId) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const pmEmail = authUser?.user?.email?.trim();
    if (pmEmail) {
      try {
        await sendEmail({
          to: pmEmail,
          subject: `Yugo move booked — ${moveCode} (forward to tenant if needed)`,
          html: `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1f1b">Your booking for unit <strong>${unitNumber}</strong> on <strong>${scheduledDate}</strong> (${scheduledTime}) is pending Yugo confirmation.</p><p style="font-family:system-ui,sans-serif;font-size:15px"><a href="${trackUrl}" style="color:#2C3E2D;font-weight:600">Open tracking link</a> — share with the tenant when you are ready.</p>`,
        });
      } catch {
        /* non-fatal */
      }
    }
  }

  return NextResponse.json({
    ok: true,
    move_id: moveId,
    move_code: moveCode,
    subtotal,
    zone,
    return_move_id: returnMoveId,
  });
}
