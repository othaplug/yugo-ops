import { createAdminClient } from "@/lib/supabase/admin";
import { generateDeliveryNumber } from "@/lib/delivery-number";
import { getActiveRateCardLookup } from "@/lib/partners/calculateDeliveryPrice";
import type { CreateMoveFromQuoteInput } from "@/lib/automations/create-move-from-quote";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";
import { ensureB2bDeliverySchedule } from "@/lib/calendar/ensure-b2b-delivery-schedule";

export type CreateDeliveryFromB2BQuoteResult = {
  deliveryId: string;
  deliveryNumber: string;
};

/**
 * Creates a deliveries row from an accepted/paid B2B quote (b2b_delivery / b2b_oneoff).
 * Does not issue tracking tokens — callers run issueDeliveryTrackingTokens + notifications.
 */
export async function createDeliveryFromB2BQuote(
  input: CreateMoveFromQuoteInput,
): Promise<CreateDeliveryFromB2BQuoteResult> {
  const supabase = createAdminClient();

  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", input.quoteId)
    .single();

  if (quoteErr || !quote) {
    throw new Error(`Quote not found: ${input.quoteId}`);
  }

  if (!isB2BDeliveryQuoteServiceType(String(quote.service_type ?? ""))) {
    throw new Error("createDeliveryFromB2BQuote only supports B2B quote service types");
  }

  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;

  const clientName = (input.clientName || contact?.name || "").trim();
  const clientEmail = (input.clientEmail || contact?.email || "").trim();
  const clientPhone = (contact?.phone || "").trim();

  const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const partnerOrgId = (factors.b2b_partner_organization_id as string)?.trim() || null;
  const isOneOff = !partnerOrgId;

  const businessName =
    (factors.b2b_business_name as string)?.trim() ||
    `${(factors.b2b_first_name as string) || ""} ${(factors.b2b_last_name as string) || ""}`.trim() ||
    clientName;

  const selectedTier = input.selectedTier ?? quote.selected_tier;
  let basePrice = 0;
  if (selectedTier && quote.tiers) {
    const tierData = (quote.tiers as Record<string, { price: number }>)[selectedTier];
    basePrice = tierData?.price ?? 0;
  } else {
    basePrice = Number(quote.custom_price) || 0;
  }

  const calculatedPreTax =
    Number(factors.b2b_calculated_pre_tax) > 0
      ? Number(factors.b2b_calculated_pre_tax)
      : basePrice;
  const totalWithTax = Math.round(basePrice * 1.13);

  const itemsFromFactors = (): string[] => {
    const lines = factors.b2b_line_items;
    if (Array.isArray(lines)) {
      return lines
        .map((l: { description?: string; quantity?: number }) => {
          const d = (l.description || "").trim();
          const q = Number(l.quantity) || 1;
          if (!d) return "";
          return q > 1 ? `${d} ×${q}` : d;
        })
        .filter(Boolean);
    }
    const legacy = factors.b2b_items;
    if (Array.isArray(legacy)) return legacy.filter((x): x is string => typeof x === "string");
    return [];
  };
  const items = itemsFromFactors();
  const itemsFinal = items.length > 0 ? items : ["B2B delivery"];

  const deliveryNumber = generateDeliveryNumber();
  const initials = (businessName || "YG").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "YG";
  const trackingCode = `${initials}-${deliveryNumber.split("-")[1]}`;

  const rateLookup = await getActiveRateCardLookup(partnerOrgId || "");

  const scheduledDate =
    (quote.move_date as string)?.trim() || new Date().toISOString().slice(0, 10);

  const estHours =
    (typeof factors.b2b_estimated_hours_override === "number"
      ? factors.b2b_estimated_hours_override
      : null) ??
    (typeof quote.est_hours === "number" ? quote.est_hours : null);

  const paidAt = input.squarePaymentId ? new Date().toISOString() : null;

  const insertPayload: Record<string, unknown> = {
    delivery_number: deliveryNumber,
    organization_id: partnerOrgId,
    client_name: businessName,
    business_name: businessName,
    contact_name: clientName || null,
    contact_phone: clientPhone || null,
    contact_email: clientEmail || null,
    customer_name: clientName,
    customer_email: clientEmail || null,
    customer_phone: clientPhone || null,
    pickup_address: (quote.from_address || "").trim() || null,
    delivery_address: (quote.to_address || "").trim(),
    scheduled_date: scheduledDate,
    delivery_window: null,
    items: itemsFinal,
    instructions: (factors.b2b_special_instructions as string)?.trim() || null,
    status: "scheduled",
    category: "b2b",
    created_by_source: "quote",
    booking_type: isOneOff ? "one_off" : null,
    rate_card_id: rateLookup.rateCardId || null,
    vertical_code: (factors.b2b_vertical_code as string)?.trim() || null,
    b2b_line_items: factors.b2b_line_items ?? null,
    b2b_assembly_required: !!factors.b2b_assembly_required,
    b2b_debris_removal: !!factors.b2b_debris_removal,
    pickup_access: quote.from_access || null,
    delivery_access: quote.to_access || null,
    item_weight_category: (factors.b2b_weight_category as string) || null,
    recommended_vehicle: (quote.truck_primary as string) || null,
    pricing_breakdown: factors.b2b_pricing_breakdown ?? null,
    calculated_price: calculatedPreTax,
    total_price: totalWithTax,
    quoted_price: basePrice,
    source_quote_id: quote.id,
    tracking_code: trackingCode,
    payment_received_at: paidAt,
    estimated_duration_hours: estHours,
    hubspot_deal_id: (quote.hubspot_deal_id as string | null | undefined)?.trim() || null,
  };

  const { data: created, error: insErr } = await supabase
    .from("deliveries")
    .insert(insertPayload as never)
    .select("id, delivery_number")
    .single();

  if (insErr || !created) {
    throw new Error(insErr?.message || "Failed to create delivery from quote");
  }

  const deliveryId = created.id as string;

  await ensureB2bDeliverySchedule(supabase, deliveryId).catch((e) =>
    console.error("[createDeliveryFromB2BQuote] ensureB2bDeliverySchedule:", e),
  );

  const rawStops = factors.b2b_stops;
  if (Array.isArray(rawStops) && rawStops.length > 0) {
    const fromA = ((quote.from_address as string) || "").trim().toLowerCase();
    const toA = ((quote.to_address as string) || "").trim().toLowerCase();
    const extra = rawStops.filter((s: { address?: string }) => {
      const a = (s.address || "").trim().toLowerCase();
      if (!a) return false;
      if (a === fromA || a === toA) return false;
      return true;
    });
    if (extra.length > 0) {
      const rows = extra.map(
        (s: { address: string; type?: string; access?: string }, i: number) => ({
          job_type: "delivery" as const,
          job_id: deliveryId,
          stop_type:
            (s.type || "").toLowerCase() === "pickup"
              ? ("pickup" as const)
              : ("dropoff" as const),
          address: (s.address || "").trim(),
          sort_order: i + 1,
          notes: (s.access || null) as string | null,
        }),
      );
      await supabase.from("job_stops").insert(rows);
    }
  }

  return {
    deliveryId,
    deliveryNumber: (created.delivery_number as string) || deliveryNumber,
  };
}
