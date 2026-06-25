/**
 * GET  /api/admin/outbound-shipments  — list (filterable by status)
 * POST /api/admin/outbound-shipments  — create a new shipment
 *
 * Outbound staging = reverse logistics for B2B partners (e.g. Blu Dot /
 * Logistic GRshop). Yugo picks up at a residential consignor, palletizes
 * at the warehouse, hands off to a 3rd-party freight carrier.
 *
 * See migration 20260624200000_outbound_shipments.sql for the schema and
 * lib/outbound-staging/{pricing,transitions}.ts for the business rules.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { signTrackToken } from "@/lib/track-token";
import { priceOutboundStagingShipment } from "@/lib/outbound-staging/pricing";

const ALLOWED_STATUS_FILTER = new Set([
  "draft",
  "scheduled",
  "picked_up",
  "at_warehouse",
  "palletizing",
  "ready_for_carrier",
  "handed_off",
  "completed",
  "cancelled",
]);

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const url = new URL(req.url);
  const statusFilter = (url.searchParams.get("status") || "").trim().toLowerCase();
  const partnerId = (url.searchParams.get("partner_id") || "").trim();

  const admin = createAdminClient();
  let q = admin
    .from("outbound_shipments")
    .select(
      "id, shipment_number, status, partner_name, business_name, consignor_name, consignor_address, scheduled_pickup_date, scheduled_pickup_window, palletized_at, ready_for_carrier_at, handed_off_at, completed_at, carrier_name, carrier_bol_number, total_price, declared_value, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter && ALLOWED_STATUS_FILTER.has(statusFilter)) {
    q = q.eq("status", statusFilter);
  }
  if (partnerId) {
    q = q.eq("partner_id", partnerId);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipments: data ?? [] });
}

type CreatePayload = {
  organization_id?: string;
  partner_id?: string | null;
  partner_name?: string;
  partner_contact_name?: string;
  partner_contact_email?: string;
  partner_contact_phone?: string;
  business_name?: string;

  consignor_name?: string;
  consignor_email?: string;
  consignor_phone?: string;
  consignor_address?: string;
  consignor_postal?: string;
  consignor_access?: string;
  consignor_notes?: string;

  items?: Array<{ name: string; dimensions?: string; weight_lb?: number; value?: number; notes?: string }>;
  total_pieces?: number;
  declared_value?: number;

  requires_palletization?: boolean;
  requires_crating?: boolean;
  requires_assembly?: boolean;
  service_level?: string;
  special_instructions?: string;

  scheduled_pickup_date?: string;
  scheduled_pickup_window?: string;

  pricing?: {
    pickup_distance_km?: number;
    pallet_count?: number;
    expected_hold_days?: number;
    crating_required?: boolean;
    outside_standard_zone?: boolean;
  };

  internal_notes?: string;
  /** When true the shipment is created as 'scheduled' rather than 'draft'. */
  confirm_scheduled?: boolean;
};

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  let body: CreatePayload;
  try {
    body = (await req.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve organization — default to the first org if not provided. This
  // matches the inbound flow and keeps single-org installs working without
  // forcing the form to know about org IDs.
  let organizationId = body.organization_id?.trim();
  if (!organizationId) {
    const { data: org } = await admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    organizationId = org?.id;
  }
  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization could be resolved for this shipment" },
      { status: 400 },
    );
  }

  // Compute pricing from the inputs the coordinator already typed in. We
  // store the breakdown on the row so the partner can see exactly what they
  // were charged for, and so a coordinator can recompute later without
  // re-typing all the inputs.
  const pricingInputs = {
    pickupDistanceKm: Number(body.pricing?.pickup_distance_km ?? 0),
    palletCount: Math.max(1, Number(body.pricing?.pallet_count ?? 1)),
    declaredValue: Number(body.declared_value ?? 0),
    expectedHoldDays: Number(body.pricing?.expected_hold_days ?? 0),
    cratingRequired:
      body.pricing?.crating_required ?? body.requires_crating ?? false,
    outsideStandardZone: !!body.pricing?.outside_standard_zone,
  };
  const pricing = priceOutboundStagingShipment(pricingInputs);

  // Each row carries an HMAC token so the partner can view it without auth.
  // We reuse the existing track-token machinery; the entity tag for outbound
  // shipments doesn't exist in the union type yet, so we cast at the call.
  const insertPayload: Record<string, unknown> = {
    organization_id: organizationId,
    partner_id: body.partner_id || null,
    partner_name: body.partner_name?.trim() || null,
    partner_contact_name: body.partner_contact_name?.trim() || null,
    partner_contact_email: body.partner_contact_email?.trim().toLowerCase() || null,
    partner_contact_phone: body.partner_contact_phone?.trim() || null,
    business_name: body.business_name?.trim() || null,

    consignor_name: body.consignor_name?.trim() || null,
    consignor_email: body.consignor_email?.trim().toLowerCase() || null,
    consignor_phone: body.consignor_phone?.trim() || null,
    consignor_address: body.consignor_address?.trim() || null,
    consignor_postal: body.consignor_postal?.trim() || null,
    consignor_access: body.consignor_access?.trim() || null,
    consignor_notes: body.consignor_notes?.trim() || null,

    items: body.items ?? [],
    total_pieces:
      body.total_pieces ??
      (Array.isArray(body.items) ? body.items.length : 0),
    declared_value: pricingInputs.declaredValue || 0,

    requires_palletization: body.requires_palletization ?? true,
    requires_crating: body.requires_crating ?? false,
    requires_assembly: body.requires_assembly ?? false,
    service_level: body.service_level || "standard",
    special_instructions: body.special_instructions?.trim() || null,

    scheduled_pickup_date: body.scheduled_pickup_date || null,
    scheduled_pickup_window: body.scheduled_pickup_window?.trim() || null,

    pickup_price:
      (pricing.lines.find((l) => l.key === "base")?.amount ?? 0) +
      (pricing.lines.find((l) => l.key === "pickup_distance")?.amount ?? 0),
    palletization_price:
      (pricing.lines.find((l) => l.key === "palletization")?.amount ?? 0) +
      (pricing.lines.find((l) => l.key === "crating")?.amount ?? 0),
    warehouse_intake_fee: 0,
    hold_days: pricingInputs.expectedHoldDays,
    free_hold_days: pricing.freeHoldDays,
    hold_price_per_day: pricing.pricePerHoldDay,
    hold_price_total: pricing.lines.find((l) => l.key === "hold_days")?.amount ?? 0,
    declared_value_fee:
      pricing.lines.find((l) => l.key === "declared_value_fee")?.amount ?? 0,
    subtotal: pricing.subtotal,
    tax_amount: pricing.hst,
    total_price: pricing.total,

    internal_notes: body.internal_notes?.trim() || null,
    status: body.confirm_scheduled ? "scheduled" : "draft",
  };

  const { data: inserted, error: insertErr } = await admin
    .from("outbound_shipments")
    .insert(insertPayload)
    .select("id, shipment_number, status")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message || "Insert failed" },
      { status: 500 },
    );
  }

  // Mint the partner-facing token AFTER insert so we can sign against the
  // assigned id. signTrackToken's entity union doesn't list outbound yet,
  // so we use "delivery" — semantically the partner is tracking a
  // shipment-style entity, and verifyTrackToken handles the same shape.
  // (When we extend the union, we'll migrate token storage cleanly.)
  const token = signTrackToken("delivery", inserted.id);
  await admin
    .from("outbound_shipments")
    .update({ partner_tracking_token: token })
    .eq("id", inserted.id);

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "outbound_shipment_created",
    resourceType: "outbound_shipment",
    resourceId: inserted.id,
    details: {
      shipment_number: inserted.shipment_number,
      partner_name: body.partner_name,
      consignor_name: body.consignor_name,
      total_price: pricing.total,
    },
  });

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    shipment_number: inserted.shipment_number,
    status: inserted.status,
    partner_tracking_token: token,
    pricing,
  });
}
