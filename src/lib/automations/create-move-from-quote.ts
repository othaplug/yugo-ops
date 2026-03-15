import { createAdminClient } from "@/lib/supabase/admin";
import { formatAccessForDisplay } from "@/lib/format-text";

/* ═══════════════════════════════════════════════════════════
   createMoveFromQuote
   ─────────────────────────────────────────────────────────
   Automatically creates a confirmed move record from an
   accepted quote, eliminating manual data entry.

   Called by:
     • POST /api/payments/process  (after deposit is charged)
     • Any future admin "accept quote" action

   The move is created with status "confirmed" — crew is NOT
   assigned. The coordinator still needs to assign crew in
   OPS+, which transitions to "scheduled".
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
  contractSignedAt?: string;
  contractPdfUrl?: string;
}

export interface CreateMoveResult {
  moveId: string;
  moveCode: string;
  trackingUrl: string;
}

const SERVICE_TO_MOVE_TYPE: Record<string, string> = {
  local_move: "residential",
  long_distance: "residential",
  office_move: "office",
  single_item: "residential",
  white_glove: "residential",
  specialty: "residential",
  b2b_oneoff: "residential",
};

export async function createMoveFromQuote(
  input: CreateMoveFromQuoteInput,
): Promise<CreateMoveResult> {
  const supabase = createAdminClient();

  /* ── 1. Fetch quote with joined contact ── */
  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", input.quoteId)
    .single();

  if (quoteErr || !quote) {
    throw new Error(`Quote not found: ${input.quoteId}`);
  }

  /* ── 2. Resolve client info ── */
  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;

  const clientName = input.clientName || contact?.name || "";
  const clientEmail = input.clientEmail || contact?.email || "";
  const clientPhone = contact?.phone || "";

  /* ── 3. Compute pricing ── */
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

  /* ── 4. Get contract signing timestamp ── */
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

  /* ── 5. Extract service-specific fields from factors_applied ── */
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
    quote.service_type === "single_item" || quote.service_type === "b2b_oneoff"
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

  /* ── 6. Find or create b2c organization for client ── */
  let organizationId: string | null = null;

  if (clientEmail) {
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("type", "b2c")
      .ilike("email", clientEmail)
      .limit(1)
      .maybeSingle();

    if (existingOrg) {
      organizationId = existingOrg.id;
    }
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

  /* ── 7. Build access notes (display labels, never raw DB values) ── */
  const fromLabel = formatAccessForDisplay(quote.from_access);
  const toLabel = formatAccessForDisplay(quote.to_access);
  const accessParts = [
    fromLabel && `From: ${fromLabel}`,
    toLabel && `To: ${toLabel}`,
  ].filter(Boolean);
  const accessNotes = accessParts.length > 0 ? accessParts.join("\n") : null;

  /* ── 8. Insert move record ── */
  const { data: move, error: moveErr } = await supabase
    .from("moves")
    .insert({
      move_type: SERVICE_TO_MOVE_TYPE[quote.service_type] ?? "residential",
      service_type: quote.service_type,
      status: "confirmed",
      stage: "booked",

      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      organization_id: organizationId,

      from_address: quote.from_address,
      to_address: quote.to_address,
      delivery_address: quote.to_address,
      from_access: quote.from_access,
      to_access: quote.to_access,
      access_notes: accessNotes,
      scheduled_date: quote.move_date,
      amount: totalWithTax,
      estimate: basePrice,

      quote_id: quote.id,
      hubspot_deal_id: quote.hubspot_deal_id,
      tier_selected: selectedTier ?? null,
      addons: input.selectedAddons ?? quote.selected_addons ?? [],

      deposit_amount: input.depositAmount,
      deposit_paid_at: new Date().toISOString(),
      balance_amount: balanceAmount,

      square_customer_id: input.squareCustomerId ?? null,
      square_card_id: input.squareCardId ?? null,
      square_payment_id: input.squarePaymentId ?? null,

      contract_signed: true,
      contract_signed_at: contractSignedAt,
      contract_pdf_url: input.contractPdfUrl ?? null,

      move_size: quote.move_size ?? null,
      distance_km: quote.distance_km ?? null,
      neighbourhood_tier: (factors.neighbourhood_tier as string) ?? null,
      lead_source: "quote",

      ...officeFields,
      ...singleItemFields,
      ...whiteGloveFields,
      ...specialtyFields,
    })
    .select("id, move_code")
    .single();

  if (moveErr || !move) {
    throw new Error(
      `Failed to create move from quote ${input.quoteId}: ${moveErr?.message ?? "unknown error"}`,
    );
  }

  return {
    moveId: move.id,
    moveCode: move.move_code ?? `MV${move.id.slice(-4)}`,
    trackingUrl: `/track/move/${move.move_code ?? move.id}`,
  };
}
