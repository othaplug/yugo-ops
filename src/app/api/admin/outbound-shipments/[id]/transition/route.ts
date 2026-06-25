/**
 * POST /api/admin/outbound-shipments/[id]/transition
 *
 * Move a shipment to the next status. The state machine + required-field
 * guards live in lib/outbound-staging/transitions.ts; this route is mostly
 * orchestration + audit logging.
 *
 * Body: { to: OutboundStagingStatus, patch?: Record<string, unknown>, reason?: string }
 *
 * `patch` lets the coordinator set fields atomically with the transition
 * (e.g. PRO + BOL + handed_off_at when moving to 'handed_off'). The merged
 * row is what gets validated by guardTransition, so the required-field
 * check applies to the POST-transition state — that way you can supply the
 * missing pallet specs in the same call instead of needing two PATCHes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import {
  guardTransition,
  STATUS_TIMESTAMP_FIELDS,
  type OutboundStagingStatus,
} from "@/lib/outbound-staging/transitions";
import {
  renderConfirmationEmail,
  renderPickedUpEmail,
  renderReadyForCarrierEmail,
  renderHandedOffEmail,
  STATUS_EMAIL_KEY,
  type PartnerEmailContext,
} from "@/lib/outbound-staging/notifications";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const TRANSITION_EDITABLE_FIELDS = new Set<string>([
  "scheduled_pickup_date",
  "scheduled_pickup_window",
  "pickup_arrived_at",
  "picked_up_at",
  "picked_up_by",
  "pickup_notes",
  "pickup_condition",
  "pickup_condition_notes",
  "received_at_warehouse_at",
  "received_by",
  "storage_location",
  "palletizing_started_at",
  "palletized_at",
  "palletized_by",
  "pallet_count",
  "pallet_dimensions",
  "pallet_weight_lb",
  "crating_method",
  "carrier_name",
  "carrier_pro_number",
  "carrier_bol_number",
  "carrier_pickup_appointment_at",
  "ready_for_carrier_at",
  "handed_off_at",
  "handed_off_by",
  "handoff_signature_url",
  "handoff_signature_name",
  "completed_at",
  "cancelled_at",
  "cancellation_reason",
  "internal_notes",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;

  let body: { to?: string; patch?: Record<string, unknown>; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = (body.to ?? "").trim() as OutboundStagingStatus;
  if (!to) {
    return NextResponse.json(
      { error: "Missing `to` target status" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: current, error: fetchErr } = await admin
    .from("outbound_shipments")
    .select("*")
    .or(`id.eq.${id},shipment_number.eq.${id}`)
    .maybeSingle();

  if (fetchErr || !current) {
    return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  }

  const from = current.status as OutboundStagingStatus;

  // Whitelist the inbound patch fields and stamp the canonical timestamp
  // for the target status if the caller didn't include it. That way moving
  // to picked_up always sets picked_up_at, etc.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.patch ?? {})) {
    if (TRANSITION_EDITABLE_FIELDS.has(k)) patch[k] = v;
  }
  const tsField = STATUS_TIMESTAMP_FIELDS[to];
  if (tsField && !patch[tsField] && !current[tsField]) {
    patch[tsField] = new Date().toISOString();
  }
  if (to === "cancelled" && body.reason && !patch.cancellation_reason) {
    patch.cancellation_reason = body.reason.trim().slice(0, 500);
  }

  // Validate against the POST-merge row so the guard sees fields supplied
  // in this same request.
  const merged = { ...current, ...patch, status: to };
  const guard = guardTransition(from, to, merged);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 409 });
  }

  const { error: updateErr } = await admin
    .from("outbound_shipments")
    .update({ ...patch, status: to })
    .eq("id", current.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "outbound_shipment_transitioned",
    resourceType: "outbound_shipment",
    resourceId: current.id,
    details: {
      shipment_number: current.shipment_number,
      from,
      to,
      reason: body.reason ?? null,
      patched_fields: Object.keys(patch),
    },
  });

  // Fire the partner notification email when this transition has one.
  // Best-effort: log a warning on failure but don't fail the request, so
  // a transient Resend outage can't block the operations workflow.
  const emailKey = STATUS_EMAIL_KEY[to];
  const partnerEmail = String(merged.partner_contact_email ?? "").trim();
  if (emailKey && partnerEmail && process.env.RESEND_API_KEY) {
    try {
      const baseUrl = getEmailBaseUrl().replace(/\/$/, "");
      const token = String(merged.partner_tracking_token ?? "");
      const trackingUrl = `${baseUrl}/outbound/track/${merged.id}?token=${encodeURIComponent(token)}`;
      const ctx: PartnerEmailContext = {
        shipmentNumber: String(merged.shipment_number ?? merged.id),
        partnerContactName: (merged.partner_contact_name as string | null) ?? null,
        partnerName: (merged.partner_name as string | null) ?? null,
        consignorName: (merged.consignor_name as string | null) ?? null,
        consignorAddress: (merged.consignor_address as string | null) ?? null,
        scheduledPickupDate: (merged.scheduled_pickup_date as string | null) ?? null,
        scheduledPickupWindow: (merged.scheduled_pickup_window as string | null) ?? null,
        totalPrice:
          merged.total_price != null ? Number(merged.total_price) : null,
        declaredValue:
          merged.declared_value != null ? Number(merged.declared_value) : null,
        trackingUrl,
      };
      let rendered: { subject: string; html: string };
      switch (emailKey) {
        case "confirmation":
          rendered = renderConfirmationEmail(ctx);
          break;
        case "picked_up":
          rendered = renderPickedUpEmail(ctx);
          break;
        case "ready_for_carrier":
          rendered = renderReadyForCarrierEmail({
            ...ctx,
            palletCount: (merged.pallet_count as number | null) ?? null,
            palletDimensions: (merged.pallet_dimensions as string | null) ?? null,
            palletWeightLb:
              merged.pallet_weight_lb != null
                ? Number(merged.pallet_weight_lb)
                : null,
          });
          break;
        case "handed_off":
          rendered = renderHandedOffEmail({
            ...ctx,
            carrierName: (merged.carrier_name as string | null) ?? null,
            carrierProNumber: (merged.carrier_pro_number as string | null) ?? null,
            carrierBolNumber: (merged.carrier_bol_number as string | null) ?? null,
            handedOffAt: (merged.handed_off_at as string | null) ?? null,
          });
          break;
      }
      const resend = getResend();
      const emailFrom = await getEmailFrom();
      await resend.emails.send({
        from: emailFrom,
        to: partnerEmail,
        subject: rendered.subject,
        html: rendered.html,
      });
    } catch (e) {
      console.error("[outbound-shipments transition] notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true, id: current.id, status: to });
}
