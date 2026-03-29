import { generateDeliveryNumber } from "@/lib/delivery-number";
import { computeB2BDimensionalForOrg } from "@/lib/pricing/b2b-partner-preview";
import type { B2BQuoteLineItem } from "@/lib/pricing/b2b-dimensional";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Pickup for RISSD legs originating at Yugo facility. */
export const YUGO_FACILITY_ADDRESS = "507 King Street East, Toronto, ON";

function itemsToB2BLineItems(items: unknown, totalPieces: number | null | undefined): B2BQuoteLineItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ description: "Shipment contents", quantity: Math.max(1, Number(totalPieces) || 1) }];
  }
  return items.map((it, i) => {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      const name = String(o.name || o.description || o.item_name || `Item ${i + 1}`);
      const qty =
        typeof o.quantity === "number"
          ? o.quantity
          : typeof o.qty === "number"
            ? o.qty
            : typeof o.pieces === "number"
              ? o.pieces
              : 1;
      return { description: name, quantity: Math.max(1, qty) };
    }
    return { description: String(it), quantity: 1 };
  });
}

function serviceLevelToHandling(level: string | null | undefined): string {
  const s = (level || "").toLowerCase();
  if (s === "white_glove" || s === "premium") return "white_glove";
  return "threshold";
}

/**
 * When an inbound shipment moves to delivery_scheduled, create a linked partner/B2B delivery
 * priced with the vertical engine (partner rates when organization_id is set).
 */
export async function ensureDeliveryForInboundShipment(
  admin: Admin,
  shipment: Record<string, unknown>,
  roundingNearest: number,
): Promise<{ delivery_id: string; delivery_number: string } | null> {
  if (shipment.delivery_id) {
    const { data: existing } = await admin
      .from("deliveries")
      .select("delivery_number")
      .eq("id", String(shipment.delivery_id))
      .maybeSingle();
    return {
      delivery_id: String(shipment.delivery_id),
      delivery_number: String(existing?.delivery_number ?? ""),
    };
  }

  const customerAddress = String(shipment.customer_address || "").trim();
  if (!customerAddress) return null;

  const orgIdRaw = shipment.organization_id;
  const orgId = orgIdRaw ? String(orgIdRaw) : null;

  const verticalCode = String(shipment.vertical_code || "furniture_retail").trim() || "furniture_retail";
  const items = itemsToB2BLineItems(shipment.items, shipment.total_pieces as number | null | undefined);
  const handling = serviceLevelToHandling(shipment.service_level as string);

  const priced = await computeB2BDimensionalForOrg(admin, {
    verticalCode,
    partnerOrganizationId: orgId,
    items,
    handlingType: handling,
    pickupAddress: YUGO_FACILITY_ADDRESS,
    deliveryAddress: customerAddress,
    deliveryAccess: String(shipment.customer_access || "").trim() || undefined,
    assemblyRequired: !!shipment.requires_assembly,
    debrisRemoval: !!shipment.requires_debris_removal,
    roundingNearest,
  });
  if (!priced) return null;

  let clientName = String(shipment.partner_name || shipment.business_name || "").trim();
  if (orgId && !clientName) {
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
    clientName = String(org?.name || "").trim();
  }

  const deliveryNumber = generateDeliveryNumber();
  const customerName = String(shipment.customer_name || "").trim() || "Customer";
  const subtotal = priced.dim.subtotal;
  const trackingPrefix = (clientName || "YG").replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase() || "YG";
  const trackingCode = `${trackingPrefix}-${deliveryNumber.split("-")[1]}`;

  const insertPayload: Record<string, unknown> = {
    delivery_number: deliveryNumber,
    organization_id: orgId,
    client_name: clientName || null,
    customer_name: customerName,
    customer_email: String(shipment.customer_email || "").trim() || null,
    customer_phone: String(shipment.customer_phone || "").trim() || null,
    pickup_address: YUGO_FACILITY_ADDRESS,
    delivery_address: customerAddress,
    scheduled_date: shipment.delivery_scheduled_date || null,
    delivery_window: shipment.delivery_window || null,
    items: items.map((i) => `${i.description}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`),
    instructions: String(shipment.special_instructions || "").trim() || null,
    status: "pending_approval",
    category: "retail",
    created_by_source: "rissd",
    vertical_code: priced.vertical.code,
    b2b_line_items: items,
    b2b_assembly_required: !!shipment.requires_assembly,
    b2b_debris_removal: !!shipment.requires_debris_removal,
    delivery_access: String(shipment.customer_access || "elevator").trim() || "elevator",
    base_price: subtotal,
    total_price: subtotal,
    quoted_price: subtotal,
    pricing_breakdown: priced.dim.breakdown,
    tracking_code: trackingCode,
  };

  const { data: created, error } = await admin
    .from("deliveries")
    .insert(insertPayload as never)
    .select("id, delivery_number")
    .single();

  if (error || !created) {
    console.error("[inbound-shipment-delivery] insert failed:", error?.message);
    return null;
  }

  await admin
    .from("inbound_shipments")
    .update({
      delivery_id: created.id,
      delivery_price: subtotal,
    })
    .eq("id", String(shipment.id));

  return { delivery_id: created.id, delivery_number: created.delivery_number };
}
