import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatAccessForDisplay } from "@/lib/format-text";
import { createBinOrderFromBinRentalQuote } from "@/lib/automations/create-bin-order-from-quote";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";
import { generateWelcomePackageToken } from "@/lib/welcome-package-token";
import { estimateMoveDurationFromQuoteRow } from "@/lib/jobs/duration-estimate";
import { convertedRecordCodeFromQuoteId } from "@/lib/quotes/quote-id";

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
  event: "event",
  labour_only: "labour_only",
  bin_rental: "bin_rental",
  packing: "residential",
};

function driveTimeFromKm(distanceKm: number | null | undefined): number | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= 0)
    return null;
  return Math.max(15, Math.round(distanceKm * 1.2));
}

/** Map quote `preferred_time` (HTML time, e.g. 10:00) to move `scheduled_time` labels used on Create Move. */
function scheduledTimeFromQuotePreferred(
  preferred: string | null | undefined,
): string | null {
  const raw = (preferred ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  h = Math.min(23, Math.max(0, h));
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
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

  if (isB2BDeliveryQuoteServiceType(String(quote.service_type ?? ""))) {
    throw new Error(
      "B2B quotes must be converted with createDeliveryFromB2BQuote, not createMoveFromQuote",
    );
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

  const clientBoxCountForMove = (): number | null => {
    const rawQ = (quote as { client_box_count?: number | null }).client_box_count;
    const nQ =
      typeof rawQ === "string" ? Number.parseFloat(rawQ) : Number(rawQ);
    if (Number.isFinite(nQ) && nQ > 0) return Math.round(nQ);
    const rawF = factors.client_box_count;
    const nF =
      typeof rawF === "number"
        ? rawF
        : typeof rawF === "string"
          ? Number.parseFloat(rawF)
          : Number(rawF);
    if (Number.isFinite(nF) && nF > 0) return Math.round(nF);
    return null;
  };

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
    quote.service_type === "single_item"
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
      ? (() => {
          const rawList = factors.white_glove_items;
          const fromFactors = Array.isArray(rawList) ? rawList : [];
          const legacyDesc = (factors.item_description as string)?.trim() ?? "";
          const itemsPayload =
            fromFactors.length > 0
              ? fromFactors
              : legacyDesc
                ? [
                    {
                      description: legacyDesc,
                      quantity: 1,
                    },
                  ]
                : [];
          const first = itemsPayload[0] as {
            description?: string;
            category?: string;
            weight_class?: string;
            assembly?: string;
          } | null;
          return {
            items: itemsPayload,
            item_description:
              (first?.description && String(first.description).trim()) ||
              legacyDesc ||
              null,
            item_category: (first?.category as string) ?? null,
            item_weight_class: (first?.weight_class as string) ?? null,
            assembly_needed: (first?.assembly as string) ?? null,
            declared_value: (factors.declared_value as number) ?? null,
            enhanced_insurance: (factors.enhanced_insurance as boolean) ?? false,
            item_source: (factors.item_source as string) ?? null,
            source_company: (factors.source_company as string) ?? null,
            placement_spec: (factors.placement_spec as string) ?? null,
          };
        })()
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

  const moveType = SERVICE_TO_MOVE_TYPE[quote.service_type] ?? "residential";

  const quotePreferredRaw = (
    quote as { preferred_time?: string | null }
  ).preferred_time;
  const quoteWindowRaw = (quote as { arrival_window?: string | null })
    .arrival_window;
  const preferredTime =
    quotePreferredRaw != null && String(quotePreferredRaw).trim() !== ""
      ? String(quotePreferredRaw).trim()
      : null;
  const arrivalWindow =
    quoteWindowRaw != null && String(quoteWindowRaw).trim() !== ""
      ? String(quoteWindowRaw).trim()
      : null;
  const scheduledTimeFromPreferred =
    scheduledTimeFromQuotePreferred(preferredTime);

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
    from_parking:
      (quote as { from_parking?: string }).from_parking ?? "dedicated",
    to_parking: (quote as { to_parking?: string }).to_parking ?? "dedicated",
    from_long_carry:
      (quote as { from_long_carry?: boolean }).from_long_carry ?? false,
    to_long_carry:
      (quote as { to_long_carry?: boolean }).to_long_carry ?? false,
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

    /** Fresh moves must not inherit quote-linked planner previews; multi-day attach sets this after insert. */
    move_project_id: null,

    client_box_count: clientBoxCountForMove(),

    preferred_time: preferredTime,
    arrival_window: arrivalWindow,
    scheduled_time: scheduledTimeFromPreferred,

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
    ...(selectedTier === "estate"
      ? { welcome_package_token: generateWelcomePackageToken() }
      : {}),
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
    (eventQuoteMeta as { event_name?: string | null }).event_name?.trim() || "";

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
        `Event bundle${eventTitleForNotes ? `, ${eventTitleForNotes}` : ""}: ${opts.legLabel} (${phase})`,
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
      ...(opts.isFirstOverall
        ? buildFinancialPrimary()
        : buildFinancialSibling()),
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
    const specialtyB2b = factors.specialty_b2b_transport === true;
    const specNotes = specialtyB2b
      ? [
          typeof factors.specialty_handling_notes === "string"
            ? factors.specialty_handling_notes.trim()
            : "",
          Array.isArray(factors.specialty_equipment_keys) &&
          (factors.specialty_equipment_keys as string[]).length
            ? `Equipment flags: ${(factors.specialty_equipment_keys as string[]).join(", ")}`
            : "",
          `Specialty B2B transport · Quote ${input.quoteId}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : null;

    const wgFromQuoteNotes =
      quote.service_type === "white_glove"
        ? [
            typeof factors.white_glove_delivery_instructions === "string" &&
            factors.white_glove_delivery_instructions.trim()
              ? `Delivery instructions: ${factors.white_glove_delivery_instructions.trim()}`
              : "",
            typeof factors.white_glove_building_requirements_note ===
              "string" &&
            factors.white_glove_building_requirements_note.trim()
              ? `Building note: ${factors.white_glove_building_requirements_note.trim()}`
              : "",
            Array.isArray(factors.specialty_building_requirements) &&
            (factors.specialty_building_requirements as string[]).length > 0
              ? `Building checklist: ${(factors.specialty_building_requirements as string[]).join(", ")}`
              : "",
            factors.white_glove_debris_removal === true
              ? "Debris removal requested"
              : "",
            typeof factors.white_glove_guaranteed_window_hours === "number" &&
            factors.white_glove_guaranteed_window_hours > 0
              ? `Guaranteed ${factors.white_glove_guaranteed_window_hours} hour delivery window`
              : "",
          ]
            .filter((s) => typeof s === "string" && s.length > 0)
            .join("\n")
        : "";

    rowsToInsert = [
      {
        ...sharedStatic,
        move_type: moveType,
        from_address: quote.from_address,
        to_address: quote.to_address,
        delivery_address: quote.to_address,
        scheduled_date: quote.move_date,
        distance_km: quote.distance_km ?? null,
        est_crew_size: (quote.est_crew_size as number) ?? null,
        est_hours:
          (typeof factors.est_job_hours === "number"
            ? factors.est_job_hours
            : null) ??
          (quote.est_hours as number) ??
          null,
        truck_primary: (quote.truck_primary as string) ?? null,
        internal_notes:
          [specNotes, wgFromQuoteNotes].filter(Boolean).join("\n\n") || null,
        complexity_indicators: specialtyB2b
          ? ["specialty_transport", "heavy_equipment_possible"]
          : [],
        ...buildFinancialPrimary(),
      },
    ];
  }

  /** Same numeric suffix as quote (YG-30245 → MV-30245). Event siblings get -E1, -E2 so each row stays unique. */
  const baseMoveCode = convertedRecordCodeFromQuoteId(input.quoteId, "MV");
  rowsToInsert = rowsToInsert.map((row, idx) => {
    const code = idx === 0 ? baseMoveCode : `${baseMoveCode}-E${idx}`;
    return { ...row, move_code: code, move_number: code };
  });

  const grossForDuration = totalWithTax;
  const attachDurationFields = (row: RowInsert): RowInsert => {
    const dEst = estimateMoveDurationFromQuoteRow({
      serviceType: String(quote.service_type ?? ""),
      moveType,
      distanceKm: (row.distance_km as number | null) ?? (quote.distance_km as number | null),
      driveTimeMin:
        (row.drive_time_min as number | null) ??
        (quote.drive_time_min as number | null),
      estCrewSize:
        (row.est_crew_size as number | null) ??
        (quote.est_crew_size as number | null),
      estHours:
        (row.est_hours as number | null) ??
        (typeof factors.est_job_hours === "number"
          ? factors.est_job_hours
          : null),
      inventoryScore: (quote.inventory_score as number | null) ?? null,
      fromAccess: quote.from_access,
      toAccess: quote.to_access,
      fromLongCarry: !!(quote as { from_long_carry?: boolean }).from_long_carry,
      toLongCarry: !!(quote as { to_long_carry?: boolean }).to_long_carry,
      tierSelected: selectedTier,
      truckPrimary: (row.truck_primary as string | null) ?? (quote.truck_primary as string | null),
      grossRevenue: grossForDuration,
      factors,
    });
    if (!dEst) return row;
    return {
      ...row,
      estimated_duration_minutes: dEst.totalMinutes,
      estimated_internal_cost: dEst.estimatedCost,
      margin_alert_minutes: dEst.maxMinutesBeforeMarginAlert,
    };
  };

  rowsToInsert = rowsToInsert.map(attachDurationFields);

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

  if (quote.service_type === "bin_rental") {
    await createBinOrderFromBinRentalQuote({
      supabase,
      moveId: primary.id,
      quote,
      clientName,
      clientEmail,
      clientPhone,
      squarePaymentId: input.squarePaymentId ?? null,
      squareCustomerId: input.squareCustomerId ?? null,
      squareCardId: input.squareCardId ?? null,
      depositAmount: input.depositAmount,
    });
  }

  const svcForProject = String(quote.service_type ?? "");
  const residentialMultiDayQuote =
    (svcForProject === "local_move" || svcForProject === "long_distance") &&
    rowsToInsert.length === 1;

  if (residentialMultiDayQuote) {
    const rawDays = (quote as { estimated_days?: unknown }).estimated_days;
    const estDays =
      typeof rawDays === "number" && Number.isFinite(rawDays)
        ? Math.round(rawDays)
        : parseInt(String(rawDays ?? "1"), 10);
    const estimatedDays =
      Number.isFinite(estDays) && estDays > 0 ? estDays : 1;
    const dayBreakdown = (quote as { day_breakdown?: unknown }).day_breakdown;

    if (estimatedDays > 1) {
      const scheduledIso =
        String(rowsToInsert[0]?.scheduled_date ?? quote.move_date ?? "").slice(
          0,
          10,
        ) || new Date().toISOString().slice(0, 10);

      const { attachMultiDayMoveProjectFromScope } = await import(
        "@/lib/move-projects/create-from-move-scope"
      );
      await attachMultiDayMoveProjectFromScope(supabase, {
        moveId: primary.id,
        quoteUuid: quote.id as string,
        contactId:
          (quote as { contact_id?: string | null }).contact_id ?? null,
        clientName,
        fromAddress: String(quote.from_address || "").trim(),
        toAddress: String(quote.to_address || "").trim(),
        scheduledDateIso: scheduledIso,
        estimatedDays,
        dayBreakdown: dayBreakdown ?? [],
      });
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
