/**
 * GET /api/track/outbound-shipments/[id]?token=...
 *
 * Partner-facing read-only view of a shipment. Returns only fields safe to
 * expose to the partner — strips ops-internal data (margin, internal_notes,
 * crew names, consignor email/phone) so the partner sees their shipment
 * status without leaking sensitive info.
 *
 * Token: HMAC of the shipment id via signTrackToken("delivery", id) — we
 * reuse the delivery entity tag because the verify helper accepts the same
 * shape and we don't want to break the entity-type union for one route.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import {
  OUTBOUND_STAGING_PARTNER_LABELS,
  OUTBOUND_STAGING_HAPPY_PATH,
  type OutboundStagingStatus,
} from "@/lib/outbound-staging/transitions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";

  if (!verifyTrackToken("delivery", id, token)) {
    return NextResponse.json(
      { error: "Invalid or missing token" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  // PostgREST's typed select() parser can't handle runtime string
  // concatenation, so we read the full row and project the partner-safe
  // subset in TypeScript below. One extra column-read per request is a
  // worthwhile trade vs. fighting the type system.
  const { data: row, error } = await admin
    .from("outbound_shipments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentStatus = row.status as OutboundStagingStatus;
  const isTerminal =
    currentStatus === "completed" || currentStatus === "cancelled";
  const happyPath = OUTBOUND_STAGING_HAPPY_PATH;
  const currentIndex = happyPath.indexOf(currentStatus);

  // Hide upcoming steps for cancelled shipments — only show what actually
  // happened.
  const progress = isTerminal && currentStatus === "cancelled"
    ? []
    : happyPath.map((s, i) => ({
        key: s,
        label: OUTBOUND_STAGING_PARTNER_LABELS[s],
        completed: i < currentIndex || s === currentStatus,
        current: s === currentStatus,
      }));

  return NextResponse.json({
    shipment: {
      id: row.id,
      shipment_number: row.shipment_number,
      status: currentStatus,
      status_label: OUTBOUND_STAGING_PARTNER_LABELS[currentStatus],

      partner: {
        partner_name: row.partner_name,
        business_name: row.business_name,
      },
      consignor: {
        name: row.consignor_name,
        address: row.consignor_address,
      },
      items: row.items,
      total_pieces: row.total_pieces,
      declared_value: row.declared_value,
      requires_palletization: row.requires_palletization,
      requires_crating: row.requires_crating,

      schedule: {
        pickup_date: row.scheduled_pickup_date,
        pickup_window: row.scheduled_pickup_window,
        carrier_pickup_appointment_at: row.carrier_pickup_appointment_at,
      },
      milestones: {
        picked_up_at: row.picked_up_at,
        received_at_warehouse_at: row.received_at_warehouse_at,
        palletized_at: row.palletized_at,
        ready_for_carrier_at: row.ready_for_carrier_at,
        handed_off_at: row.handed_off_at,
        completed_at: row.completed_at,
      },
      pallet: row.palletized_at
        ? {
            count: row.pallet_count,
            dimensions: row.pallet_dimensions,
            weight_lb: row.pallet_weight_lb,
          }
        : null,
      carrier: row.carrier_name
        ? {
            name: row.carrier_name,
            pro_number: row.carrier_pro_number,
            bol_number: row.carrier_bol_number,
          }
        : null,
      pricing: {
        pickup_price: row.pickup_price,
        palletization_price: row.palletization_price,
        hold_price_total: row.hold_price_total,
        declared_value_fee: row.declared_value_fee,
        subtotal: row.subtotal,
        tax_amount: row.tax_amount,
        total_price: row.total_price,
      },
    },
    progress,
  });
}
