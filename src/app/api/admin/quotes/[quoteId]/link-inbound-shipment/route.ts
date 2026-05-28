/**
 * POST /api/admin/quotes/[quoteId]/link-inbound-shipment
 *
 * R1: when a B2B quote's scope is "Receive at warehouse + deliver" (or
 * "Receive + deliver + recover original"), the operator captures carrier
 * / waybill / ETA / origin-country data in the quote form. On submit
 * this endpoint either creates a new inbound_shipments row from that
 * data, or updates an already-linked row, and stamps the quote's
 * inbound_shipment_id FK so the rest of OPS+ (Track page, partner
 * portal, condition-report flow in R4) can find it.
 *
 * Request body:
 *   {
 *     carrier_name: string,
 *     carrier_tracking_number: string,   // air waybill / tracking #
 *     carrier_eta: string | null,        // YYYY-MM-DD
 *     origin_country: string | null,     // ISO-2 or freeform
 *     declared_value: number | null,
 *     items?: Array<{ description, qty, weight_kg?, length_cm?, ... }>,
 *     special_instructions: string | null,
 *     // Optional: include partner/customer fields when known
 *     partner_organization_id?: string,
 *     customer_name?: string,
 *     customer_address?: string,
 *   }
 *
 * Returns: { ok: true, inbound_shipment_id, shipment_number }
 *
 * Idempotent: if the quote already has an inbound_shipment_id, the
 * existing row is UPDATEd rather than a duplicate created.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type LinkInboundShipmentBody = {
  carrier_name?: string;
  carrier_tracking_number?: string;
  carrier_eta?: string | null;
  origin_country?: string | null;
  declared_value?: number | null;
  items?: Array<Record<string, unknown>>;
  special_instructions?: string | null;
  partner_organization_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_postal?: string | null;
  service_level?: "standard" | "white_glove" | "premium";
  requires_assembly?: boolean;
  requires_debris_removal?: boolean;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { quoteId } = await params;

  let body: LinkInboundShipmentBody;
  try {
    body = (await req.json()) as LinkInboundShipmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const carrier = String(body.carrier_name ?? "").trim();
  const tracking = String(body.carrier_tracking_number ?? "").trim();
  if (!carrier && !tracking) {
    return NextResponse.json(
      { error: "carrier_name or carrier_tracking_number is required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Resolve the quote row by either UUID id or human quote_id slug.
  const { data: quoteRow, error: quoteErr } = await db
    .from("quotes")
    .select("id, quote_id, inbound_shipment_id, contact_id, declared_value, service_type")
    .or(`id.eq.${quoteId},quote_id.eq.${quoteId}`)
    .maybeSingle();
  if (quoteErr || !quoteRow?.id) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Normalize the row payload. inbound_shipments has a trigger that
  // auto-fills shipment_number if blank, so we can leave it null.
  const eta = (() => {
    if (!body.carrier_eta) return null;
    const d = new Date(body.carrier_eta);
    return Number.isFinite(d.getTime())
      ? d.toISOString().slice(0, 10)
      : null;
  })();

  const declaredValueNum =
    typeof body.declared_value === "number" && Number.isFinite(body.declared_value)
      ? body.declared_value
      : null;

  const shipmentPayload: Record<string, unknown> = {
    carrier_name: carrier || null,
    carrier_tracking_number: tracking || null,
    carrier_eta: eta,
    items: Array.isArray(body.items) ? body.items : [],
    total_pieces: Array.isArray(body.items) ? body.items.length : 1,
    special_instructions: body.special_instructions?.trim() || null,
    service_level: body.service_level ?? "white_glove",
    requires_assembly: body.requires_assembly ?? false,
    requires_debris_removal: body.requires_debris_removal ?? false,
    organization_id: body.partner_organization_id?.trim() || null,
    customer_name: body.customer_name?.trim() || null,
    customer_email: body.customer_email?.trim() || null,
    customer_phone: body.customer_phone?.trim() || null,
    customer_address: body.customer_address?.trim() || null,
    customer_postal: body.customer_postal?.trim() || null,
    // Use the most-specific declared value provided.
    delivery_price: null,
  };

  // Origin country lives in special_instructions today since the table
  // doesn't have a dedicated column. We append it to the instructions
  // so it's at least searchable / human-visible until the column is
  // added (R3 candidate). Skip when blank.
  if (body.origin_country && String(body.origin_country).trim()) {
    const prefix = `Origin: ${String(body.origin_country).trim()}`;
    shipmentPayload.special_instructions = shipmentPayload.special_instructions
      ? `${prefix}. ${shipmentPayload.special_instructions}`
      : prefix;
  }

  let shipmentId: string;
  let shipmentNumber: string | null = null;
  let mode: "created" | "updated";

  if (quoteRow.inbound_shipment_id) {
    // Update the existing linked row in place.
    const { data: updated, error: updErr } = await db
      .from("inbound_shipments")
      .update(shipmentPayload)
      .eq("id", quoteRow.inbound_shipment_id)
      .select("id, shipment_number")
      .single();
    if (updErr || !updated?.id) {
      return NextResponse.json(
        { error: updErr?.message || "Failed to update inbound shipment" },
        { status: 500 },
      );
    }
    shipmentId = updated.id;
    shipmentNumber = updated.shipment_number;
    mode = "updated";
  } else {
    // Create a fresh row. The DB trigger generates shipment_number.
    const { data: created, error: insErr } = await db
      .from("inbound_shipments")
      .insert({
        ...shipmentPayload,
        status: "awaiting_shipment",
      })
      .select("id, shipment_number")
      .single();
    if (insErr || !created?.id) {
      return NextResponse.json(
        { error: insErr?.message || "Failed to create inbound shipment" },
        { status: 500 },
      );
    }
    shipmentId = created.id;
    shipmentNumber = created.shipment_number;
    mode = "created";

    // Link it onto the quote row.
    const updateQuotePayload: Record<string, unknown> = { inbound_shipment_id: shipmentId };
    if (declaredValueNum != null && quoteRow.declared_value == null) {
      updateQuotePayload.declared_value = declaredValueNum;
    }
    const { error: linkErr } = await db
      .from("quotes")
      .update(updateQuotePayload)
      .eq("id", quoteRow.id);
    if (linkErr) {
      return NextResponse.json(
        { error: `Inbound created but quote link failed: ${linkErr.message}` },
        { status: 500 },
      );
    }
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: mode === "created" ? "inbound_shipment_linked" : "inbound_shipment_updated",
    resourceType: "quote",
    resourceId: quoteRow.id,
    details: {
      quote_id: quoteRow.quote_id,
      inbound_shipment_id: shipmentId,
      shipment_number: shipmentNumber,
      carrier_name: carrier,
      carrier_tracking_number: tracking,
    },
  });

  return NextResponse.json({
    ok: true,
    mode,
    inbound_shipment_id: shipmentId,
    shipment_number: shipmentNumber,
  });
}
