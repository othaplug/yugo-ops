import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatAccessForDisplay } from "@/lib/format-text";

/* ═══════════════════════════════════════════════════════════
   createMoveFromQuote
   ─────────────────────────────────────────────────────────
   Event quotes:
     • Multi-event (event_mode "multi" + event_legs): two moves per
       leg (delivery + return) with the same event_group_id.
       Deposit / pricing / Square fields live on the first move only.
     • Single-event: same two-move pattern from quote + factors.

   Non-event: one move (unchanged contract with deposit on that row).
   ═══════════════════════════════════════════════════════════ */

export interface CreateMoveFromQuoteInput {
  quoteId: string;
  depositAmount: number;
  selectedTier?: string | null;
  selectedAddons?: unknown[];
  clientName?: string;
  clientEmail?: string;
  squareCustomerId?: string;
  squareCardId?: string;
  squarePaymentId?: string;
  squareReceiptUrl?: string | null;
  contractSignedAt?: string;
  contractPdfUrl?: string;
}

export interface CreateMoveResult {
  moveId: string;
  moveCode: string;
  trackingUrl: string;
  eventGroupId?: string;
  relatedMoveCount?: number;
}

const SERVICE_TO_MOVE_TYPE: Record<string, string> = {
  local_move: "residential",
  long_distance: "residential",
  office_move: "office",
  single_item: "single_item",
  white_glove: "white_glove",
  specialty: "specialty",
  b2b_oneoff: "b2b_oneoff",
  b2b_delivery: "b2b_oneoff",
  event: "event",
  labour_only: "labour_only",
  packing: "residential",
};

function driveTimeFromKm(distanceKm: number | null | undefined): number | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= 0)
    return null;
  return Math.max(15, Math.round(distanceKm * 1.2));
}

type EventLegStored = {
  label?: string;
  from_address?: string;
  to_address?: string;
  delivery_date?: string;
  return_date?: string;
  distance_km?: number;
  event_crew?: number;
  event_hours?: number;
};

function parseEventLegs(factors: Record<string, unknown>): EventLegStored[] {
  const raw = factors.event_legs;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as EventLegStored[];
}

export async function createMoveFromQuote(
  input: CreateMoveFromQuoteInput,
): Promise<CreateMoveResult> {
  const supabase = createAdminClient();

  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", input.quoteId)
    .single();

  if (quoteErr || !quote) {
    throw new Error(`Quote not found: ${input.quoteId}`);
  }

  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;

  const clientName = input.clientName || contact?.name || "";
  const clientEmail = input.clientEmail || contact?.email || "";
  const clientPhone = contact?.phone || "";

  const selectedTier = input.selectedTier ?? quote.selected_tier;
  let basePrice: number;
  let totalWithTax: number;

  if (selectedTier && quote.tiers) {
    const tierData = (
      quote.tiers as Record<string, { price: number; total: number }>
    )[selectedTier];
    basePrice = tierData?.price ?? 0;
    totalWithTax = tierData?.total ?? Math.round(basePrice * 1.13);
  } else {
    basePrice = quote.custom_price ?? 0;
    totalWithTax = Math.round(basePrice * 1.13);
  }

  const balanceAmount = totalWithTax - input.depositAmount;

  let contractSignedAt = input.contractSignedAt;
  if (!contractSignedAt) {
    const { data: sigEvent } = await supabase
      .from("quote_events")
      .select("metadata")
      .eq("quote_id", input.quoteId)
      .eq("event_type", "contract_signed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const meta = sigEvent?.metadata as { signed_at?: string } | null;
    contractSignedAt = meta?.signed_at ?? new Date().toISOString();
  }

  const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;

  const officeFields =
    quote.service_type === "office_move"
      ? {
          company_name: (factors.company_name as string) ?? null,
          square_footage: (factors.square_footage as number) ?? null,
          workstation_count: (factors.workstation_count as number) ?? null,
          has_it_equipment: (factors.has_it_equipment as boolean) ?? false,
          timing_preference: (factors.timing_preference as string) ?? null,
          phasing_notes: (factors.phasing_notes as string) ?? null,
        }
      : {};

  const singleItemFields =
    quote.service_type === "single_item" ||
    quote.service_type === "b2b_oneoff" ||
    quote.service_type === "b2b_delivery"
      ? {
          item_description: (factors.item_description as string) ?? null,
          item_category: (factors.item_category as string) ?? null,
          item_weight_class: (factors.item_weight_class as string) ?? null,
          assembly_needed: (factors.assembly_needed as string) ?? null,
          item_photo_url: (factors.item_photo_url as string) ?? null,
        }
      : {};

  const whiteGloveFields =
    quote.service_type === "white_glove"
      ? {
          item_description: (factors.item_description as string) ?? null,
          item_category: (factors.item_category as string) ?? null,
          item_weight_class: (factors.item_weight_class as string) ?? null,
          assembly_needed: (factors.assembly_needed as string) ?? null,
          declared_value: (factors.declared_value as number) ?? null,
          enhanced_insurance: (factors.enhanced_insurance as boolean) ?? false,
          item_source: (factors.item_source as string) ?? null,
          source_company: (factors.source_company as string) ?? null,
          placement_spec: (factors.placement_spec as string) ?? null,
        }
      : {};

  const specialtyFields =
    quote.service_type === "specialty"
      ? {
          project_type: (factors.project_type as string) ?? null,
          project_description: (factors.project_description as string) ?? null,
          custom_crating: (factors.custom_crating as boolean) ?? false,
          climate_control: (factors.climate_control as boolean) ?? false,
          special_equipment: (factors.special_equipment as unknown[]) ?? [],
        }
      : {};

  const setupFeeNum = Number(factors.setup_fee);
  const eventQuoteMeta =
    quote.service_type === "event"
      ? {
          event_name: (factors.event_name as string) ?? null,
          venue_address: quote.to_address ?? null,
          setup_required:
            setupFeeNum > 0 || !!(factors.setup_label as string)?.trim(),
          setup_instructions:
            (typeof factors.setup_label === "string"
              ? factors.setup_label
              : null) ??
            (factors.event_setup_instructions as string) ??
            null,
        }
      : {};

  let organizationId: string | null = null;

  if (clientEmail) {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("type", "b2c")
      .ilike("email", clientEmail)
      .limit(1)
      .maybeSingle();

    if (existingOrg) organizationId = existingOrg.id;
  }

  if (!organizationId && clientName) {
    const orgEmail =
      clientEmail.trim() || `client-${input.quoteId}@placeholder.local`;
    const { data: newOrg } = await supabase
      .from("organizations")
      .insert({
        name: clientName,
        type: "b2c",
        contact_name: clientName,
        email: orgEmail,
        phone: clientPhone || "",
      })
      .select("id")
      .single();

    if (newOrg) organizationId = newOrg.id;
  }

  const fromLabel = formatAccessForDisplay(quote.from_access);
  const toLabel = formatAccessForDisplay(quote.to_access);
  const accessParts = [
    fromLabel && `From: ${fromLabel}`,
    toLabel && `To: ${toLabel}`,
  ].filter(Boolean);
  const accessNotes = accessParts.length > 0 ? accessParts.join("\n") : null;

  const moveType =
    SERVICE_TO_MOVE_TYPE[quote.service_type] ?? "residential";

  const sharedStatic = {
    service_type: quote.service_type,
    status: "confirmed" as const,
    stage: "booked" as const,

    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    organization_id: organizationId,

    from_access: quote.from_access,
    to_access: quote.to_access,
    access_notes: accessNotes,

    quote_id: quote.id,
    hubspot_deal_id: quote.hubspot_deal_id,
    addons: input.selectedAddons ?? quote.selected_addons ?? [],

    contract_signed: true,
    contract_signed_at: contractSignedAt,
    contract_pdf_url: input.contractPdfUrl ?? null,

    move_size: quote.move_size ?? null,
    neighbourhood_tier: (factors.neighbourhood_tier as string) ?? null,
    lead_source: "quote",

    ...officeFields,
    ...singleItemFields,
    ...whiteGloveFields,
    ...specialtyFields,
  };

  type RowInsert = Record<string, unknown>;

  const buildFinancialPrimary = (): RowInsert => ({
    amount: totalWithTax,
    estimate: basePrice,
    tier_selected: selectedTier ?? null,
    deposit_amount: input.depositAmount,
    deposit_paid_at: new Date().toISOString(),
    balance_amount: balanceAmount,
    square_customer_id: input.squareCustomerId ?? null,
    square_card_id: input.squareCardId ?? null,
    square_payment_id: input.squarePaymentId ?? null,
    square_receipt_url: input.squareReceiptUrl ?? null,
  });

  const buildFinancialSibling = (): RowInsert => ({
    amount: 0,
    estimate: 0,
    tier_selected: null,
    deposit_amount: null,
    deposit_paid_at: null,
    balance_amount: null,
    square_customer_id: null,
    square_card_id: null,
    square_payment_id: null,
    square_receipt_url: null,
  });

  const eventTitleForNotes =
    (eventQuoteMeta as { event_name?: string | null }).event_name?.trim() ||
    "";

  function pushEventPair(
    rows: RowInsert[],
    opts: {
      eventGroupId: string;
      legLabel: string;
      fromA: string;
      toA: string;
      deliveryDate: string;
      returnDate: string;
      distanceKm: number | null | undefined;
      crew: number | null | undefined;
      hours: number | null | undefined;
      isFirstOverall: boolean;
    },
  ) {
    const distKm = opts.distanceKm ?? null;
    const dt = driveTimeFromKm(distKm);
    const truck = (quote.truck_primary as string) ?? null;

    const mkInternal = (phase: "delivery" | "return") =>
      [
        `Event bundle${eventTitleForNotes ? ` — ${eventTitleForNotes}` : ""}: ${opts.legLabel} (${phase})`,
        `Quote ${input.quoteId}`,
      ].join("\n");

    rows.push({
      ...sharedStatic,
      move_type: moveType,
      ...eventQuoteMeta,
      event_group_id: opts.eventGroupId,
      event_phase: "delivery",
      from_address: opts.fromA,
      to_address: opts.toA,
      delivery_address: opts.toA,
      scheduled_date: opts.deliveryDate,
      distance_km: distKm,
      drive_time_min: dt,
      truck_primary: truck,
      est_crew_size: opts.crew ?? null,
      est_hours: opts.hours ?? null,
      internal_notes: mkInternal("delivery"),
      ...(opts.isFirstOverall ? buildFinancialPrimary() : buildFinancialSibling()),
    });

    rows.push({
      ...sharedStatic,
      move_type: moveType,
      ...eventQuoteMeta,
      event_group_id: opts.eventGroupId,
      event_phase: "return",
      from_address: opts.toA,
      to_address: opts.fromA,
      delivery_address: opts.fromA,
      scheduled_date: opts.returnDate,
      distance_km: distKm,
      drive_time_min: dt,
      truck_primary: truck,
      est_crew_size: opts.crew ?? null,
      est_hours: opts.hours ?? null,
      internal_notes: mkInternal("return"),
      ...buildFinancialSibling(),
    });
  }

  let rowsToInsert: RowInsert[] = [];
  let eventGroupId: string | undefined;

  if (quote.service_type === "event") {
    const legs = parseEventLegs(factors);
    const isMulti = factors.event_mode === "multi" && legs.length >= 2;

    eventGroupId = randomUUID();
    let isFirstOverall = true;

    if (isMulti) {
      for (const leg of legs) {
        const fromA = (leg.from_address || "").trim();
        const toA = (leg.to_address || "").trim();
        const del =
          (leg.delivery_date || quote.move_date || "").trim() ||
          quote.move_date;
        const ret = (leg.return_date || del).trim() || del;
        if (!fromA || !toA || !del) continue;

        pushEventPair(rowsToInsert, {
          eventGroupId: eventGroupId!,
          legLabel: (leg.label || "Event leg").trim(),
          fromA,
          toA,
          deliveryDate: del,
          returnDate: ret,
          distanceKm: leg.distance_km,
          crew: leg.event_crew,
          hours: leg.event_hours,
          isFirstOverall,
        });
        isFirstOverall = false;
      }
    }

    if (rowsToInsert.length === 0) {
      const fromA = (quote.from_address || "").trim();
      const toA = (quote.to_address || "").trim();
      const del = (
        (factors.delivery_date as string) ||
        quote.move_date ||
        ""
      ).trim();
      const ret = ((factors.return_date as string) || del).trim() || del;
      if (fromA && toA && del) {
        const crew =
          (factors.event_crew as number) ??
          (quote.est_crew_size as number) ??
          undefined;
        const hours = (factors.event_hours as number) ?? undefined;
        const distKm = quote.distance_km as number | undefined;

        pushEventPair(rowsToInsert, {
          eventGroupId: eventGroupId!,
          legLabel: "Event",
          fromA,
          toA,
          deliveryDate: del,
          returnDate: ret,
          distanceKm: distKm,
          crew,
          hours,
          isFirstOverall: true,
        });
      }
    }

    if (rowsToInsert.length === 0) {
      throw new Error(
        `Event quote ${input.quoteId} missing addresses/dates; cannot create moves`,
      );
    }
  } else {
    rowsToInsert = [
      {
        ...sharedStatic,
        move_type: moveType,
        from_address: quote.from_address,
        to_address: quote.to_address,
        delivery_address: quote.to_address,
        scheduled_date: quote.move_date,
        distance_km: quote.distance_km ?? null,
        ...buildFinancialPrimary(),
      },
    ];
  }

  const [primaryRow, ...siblingRows] = rowsToInsert;
  const { data: primary, error: primaryErr } = await supabase
    .from("moves")
    .insert(primaryRow)
    .select("id, move_code")
    .single();

  if (primaryErr || !primary) {
    throw new Error(
      `Failed to create move from quote ${input.quoteId}: ${primaryErr?.message ?? "unknown error"}`,
    );
  }

  if (siblingRows.length > 0) {
    const { error: sibErr } = await supabase.from("moves").insert(siblingRows);
    if (sibErr) {
      throw new Error(
        `Created primary move but failed on sibling rows for ${input.quoteId}: ${sibErr.message}`,
      );
    }
  }

  return {
    moveId: primary.id,
    moveCode: primary.move_code ?? `MV${primary.id.slice(-4)}`,
    trackingUrl: `/track/move/${primary.move_code ?? primary.id}`,
    ...(quote.service_type === "event" && eventGroupId
      ? { eventGroupId, relatedMoveCount: rowsToInsert.length }
      : {}),
  };
}
