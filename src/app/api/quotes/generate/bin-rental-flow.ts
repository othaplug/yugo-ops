import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { logActivity } from "@/lib/activity";
import {
  calculateBinRentalPrice,
  sumBinsOutOnRental,
  availableBinInventory,
  BIN_RENTAL_BUNDLE_SPECS,
  haversineKmBin,
  type BinBundleKey,
} from "@/lib/pricing/bin-rental";
import { normalizePhone } from "@/lib/phone";
import {
  getQuoteIdPrefix,
  isQuoteIdUniqueViolation,
  quoteNumericSuffixForHubSpot,
} from "@/lib/quotes/quote-id";
import { patchHubSpotDealJobNo } from "@/lib/hubspot/sync-deal-job-no";
import { geocode, GTA_CORE_LAT, GTA_CORE_LNG } from "@/lib/mapbox/driving-distance";

const TAX_RATE = 0.13;

function cfgNum(config: Map<string, string>, key: string, fallback: number): number {
  const v = config.get(key);
  return v !== undefined ? Number(v) : fallback;
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function isBinBundleKey(v: string | undefined): v is BinBundleKey {
  return (
    v === "studio" ||
    v === "1br" ||
    v === "2br" ||
    v === "3br" ||
    v === "4br_plus" ||
    v === "custom"
  );
}

export type BinRentalQuoteInput = {
  quote_id?: string;
  service_type: string;
  from_address: string;
  to_address: string;
  from_access?: string;
  to_access?: string;
  move_date: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  hubspot_deal_id?: string;
  contact_id?: string;
  from_parking?: string;
  to_parking?: string;
  from_long_carry?: boolean;
  to_long_carry?: boolean;
  bin_bundle_type?: string;
  bin_custom_count?: number;
  bin_extra_bins?: number;
  bin_packing_paper?: boolean;
  /** When false, coordinator waives material delivery (standalone only). Default true. */
  bin_material_delivery?: boolean;
  bin_linked_move_id?: string | null;
  bin_delivery_notes?: string;
  internal_notes?: string;
  quote_source?: string;
  source_request_id?: string | null;
};

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface TierShape {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

export async function buildBinRentalQuoteResponse(opts: {
  sb: SupabaseAdmin;
  config: Map<string, string>;
  input: BinRentalQuoteInput;
  isPreview: boolean;
  authUser: { id: string; email?: string | null } | null;
  generateQuoteId: () => Promise<string>;
  postalPrefix: string | null;
  hubspotAccessToken?: string | null;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { sb, config, input, isPreview, authUser, generateQuoteId, postalPrefix, hubspotAccessToken } =
    opts;

  const bundleRaw = input.bin_bundle_type || "2br";
  if (!isBinBundleKey(bundleRaw)) {
    return { status: 400, body: { error: "Invalid bin_bundle_type" } };
  }
  const bundleType = bundleRaw;

  const dropBefore = Math.max(
    1,
    Math.floor(cfgNum(config, "bin_rental_drop_off_days_before", 7)),
  );
  const pickupAfter = Math.max(
    1,
    Math.floor(cfgNum(config, "bin_rental_pickup_days_after", 5)),
  );
  const rentalDays = Math.max(
    1,
    Math.floor(cfgNum(config, "bin_rental_rental_days", 12)),
  );

  const linkedRaw = input.bin_linked_move_id?.trim() || null;
  const totalCap = cfgNum(config, "bin_total_inventory", 500);
  const outOnRental = await sumBinsOutOnRental(sb);
  const available = availableBinInventory(totalCap, outOnRental);

  const deliveryAddr = (input.to_address || "").trim();
  const pickupAddrRaw = (input.from_address || "").trim();
  const pickupAddr =
    pickupAddrRaw && pickupAddrRaw.toLowerCase() !== deliveryAddr.toLowerCase()
      ? pickupAddrRaw
      : deliveryAddr;

  const deliveryGeo = deliveryAddr ? await geocode(deliveryAddr) : null;
  const pickupGeo =
    pickupAddr === deliveryAddr
      ? deliveryGeo
      : pickupAddr
        ? await geocode(pickupAddr)
        : null;

  const geoFailed =
    !deliveryGeo || (pickupAddr !== deliveryAddr && !pickupGeo);

  const deliveryKmFromHub = deliveryGeo
    ? haversineKmBin(GTA_CORE_LAT, GTA_CORE_LNG, deliveryGeo.lat, deliveryGeo.lng)
    : null;
  const pickupKmFromHub =
    pickupGeo != null
      ? haversineKmBin(GTA_CORE_LAT, GTA_CORE_LNG, pickupGeo.lat, pickupGeo.lng)
      : null;

  const priceResult = calculateBinRentalPrice(
    {
      bundle_type: bundleType,
      bin_count: input.bin_custom_count,
      extra_bins: input.bin_extra_bins,
      packing_paper: !!input.bin_packing_paper,
      material_delivery_charge: input.bin_material_delivery !== false,
      linked_move_id: linkedRaw,
      available_bins: available,
      hub_distance: geoFailed
        ? {
            delivery_km_from_hub: null,
            pickup_km_from_hub: null,
            distance_pricing_unavailable: true,
          }
        : {
            delivery_km_from_hub: deliveryKmFromHub,
            pickup_km_from_hub: pickupKmFromHub,
            distance_pricing_unavailable: false,
          },
    },
    config,
  );

  if (!priceResult.ok) {
    return {
      status: 400,
      body: {
        error: priceResult.error,
        ...(priceResult.availableBins != null
          ? { bin_inventory_available: priceResult.availableBins, bin_inventory_required: priceResult.requiredBins }
          : {}),
      },
    };
  }

  const taxRate = cfgNum(config, "tax_rate", TAX_RATE);
  const subtotal = priceResult.subtotal;
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  const dropOffDate = addDaysIso(input.move_date, -dropBefore);
  const pickupDate = addDaysIso(input.move_date, pickupAfter);

  const spec =
    bundleType !== "custom" ? BIN_RENTAL_BUNDLE_SPECS[bundleType] : null;
  const includes: string[] = [];
  if (spec) {
    includes.push(`${spec.bins} plastic bins (27×16×13")`);
    includes.push(`${spec.wardrobeBoxes} wardrobe boxes (on move day)`);
  } else {
    includes.push(`${priceResult.totalBins - (input.bin_extra_bins ?? 0)} bins (custom)`);
  }
  includes.push("Zip ties (1 per bin)");
  if (input.bin_packing_paper) includes.push("Packing paper");
  if (priceResult.lines.some((l) => l.key === "material_delivery")) {
    includes.push("Material delivery");
  } else if (linkedRaw) {
    includes.push("Delivery included with your Yugo move");
  }
  if (priceResult.distanceCharge && priceResult.distanceCharge.totalDistanceFee > 0) {
    includes.push("Distance-based delivery and pickup fees (outside core radius)");
  }

  const custom_price: TierShape = {
    price: subtotal,
    deposit: total,
    tax,
    total,
    includes,
  };

  const factors: Record<string, unknown> = {
    service_family: "bin_rental",
    bin_bundle_type: bundleType,
    bin_bundle_label: priceResult.bundleLabel,
    bin_count_total: priceResult.totalBins,
    bin_wardrobe_boxes: priceResult.wardrobeBoxes,
    bin_extra_bins: Math.max(0, Math.floor(input.bin_extra_bins ?? 0)),
    bin_packing_paper: !!input.bin_packing_paper,
    bin_material_delivery_charged: priceResult.lines.some((l) => l.key === "material_delivery"),
    bin_linked_move_id: linkedRaw,
    bin_drop_off_date: dropOffDate,
    bin_pickup_date: pickupDate,
    bin_move_date: input.move_date,
    bin_rental_cycle_days: rentalDays,
    bin_delivery_notes: input.bin_delivery_notes?.trim() || null,
    bin_line_items: priceResult.lines,
    bin_subtotal: subtotal,
    bin_tax: tax,
    bin_grand_total: total,
    bin_inventory_total: totalCap,
    bin_inventory_out: outOnRental,
    bin_inventory_available: available,
    internal_notes: input.internal_notes?.trim() || null,
    payment_full_at_booking: true,
    bin_hub_delivery_km:
      deliveryKmFromHub != null ? Math.round(deliveryKmFromHub * 10) / 10 : null,
    bin_hub_pickup_km:
      pickupKmFromHub != null ? Math.round(pickupKmFromHub * 10) / 10 : null,
    bin_delivery_drive_min: priceResult.distanceCharge?.deliveryDriveMinutes ?? null,
    bin_pickup_drive_min: priceResult.distanceCharge?.pickupDriveMinutes ?? null,
    bin_distance_fee_delivery: priceResult.distanceCharge?.deliveryFee ?? 0,
    bin_distance_fee_pickup: priceResult.distanceCharge?.pickupFee ?? 0,
    bin_distance_fee_total: priceResult.distanceCharge?.totalDistanceFee ?? 0,
    bin_distance_geocoding_failed: geoFailed,
  };

  const isUpdate = !isPreview && !!input.quote_id?.trim();
  let quoteId: string;
  if (isPreview) {
    quoteId = "PREVIEW";
  } else if (isUpdate) {
    const { data: existing } = await sb
      .from("quotes")
      .select("quote_id")
      .eq("quote_id", input.quote_id!.trim())
      .maybeSingle();
    quoteId = existing?.quote_id ?? (await generateQuoteId());
  } else {
    quoteId = await generateQuoteId();
  }

  const expiryDays = cfgNum(config, "quote_expiry_days", 7);

  let contactId = input.contact_id || null;
  if (!contactId && input.client_email) {
    const { data: existing } = await sb
      .from("contacts")
      .select("id")
      .eq("email", input.client_email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();
    if (existing) {
      contactId = existing.id;
      if (input.client_phone?.trim()) {
        const p = normalizePhone(input.client_phone);
        if (p.length >= 10) {
          await sb.from("contacts").update({ phone: p }).eq("id", existing.id);
        }
      }
    } else {
      const { data: created } = await sb
        .from("contacts")
        .insert({
          name: input.client_name?.trim() || null,
          email: input.client_email.trim().toLowerCase(),
          phone: input.client_phone?.trim() ? normalizePhone(input.client_phone) : null,
        })
        .select("id")
        .single();
      if (created) contactId = created.id;
    }
  }

  if (!isPreview) {
    const quotePayload = {
      hubspot_deal_id: input.hubspot_deal_id || null,
      quote_source: input.quote_source?.trim() || null,
      source_request_id: input.source_request_id?.trim() || null,
      contact_id: contactId,
      service_type: "bin_rental" as const,
      status: "draft" as const,
      from_address: input.from_address,
      from_access: input.from_access || null,
      from_postal: postalPrefix,
      from_parking: input.from_parking ?? "dedicated",
      to_parking: input.to_parking ?? "dedicated",
      from_long_carry: input.from_long_carry ?? false,
      to_long_carry: input.to_long_carry ?? false,
      to_address: input.to_address,
      to_access: input.to_access || null,
      move_date: input.move_date,
      move_size: null,
      distance_km: null,
      drive_time_min: null,
      specialty_items: [],
      tiers: null,
      custom_price: subtotal,
      deposit_amount: total,
      factors_applied: factors,
      selected_addons: [],
      expires_at: new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
      inventory_items: [],
      client_box_count: null,
      inventory_warnings: [],
      inventory_score: null,
      inventory_modifier: null,
      est_crew_size: null,
      est_hours: null,
      est_truck_size: null,
      truck_primary: null,
      truck_secondary: null,
      recommended_tier: "signature",
      crating_pieces: [],
      crating_total: 0,
      supplies_allowance: 0,
    };

    if (isUpdate) {
      const { error: updateErr } = await sb.from("quotes").update(quotePayload).eq("quote_id", quoteId);
      if (updateErr) {
        return { status: 500, body: { error: updateErr.message } };
      }
    } else {
      const prefixForHubSpot = await getQuoteIdPrefix(sb);
      const MAX_INSERT_ATTEMPTS = 6;
      let insertQuoteId = quoteId;
      let inserted = false;
      for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
        const { error: insertErr } = await sb.from("quotes").insert({
          quote_id: insertQuoteId,
          ...quotePayload,
        });
        if (!insertErr) {
          quoteId = insertQuoteId;
          inserted = true;
          const dealHs = input.hubspot_deal_id?.trim();
          if (dealHs && hubspotAccessToken) {
            const jobNo = quoteNumericSuffixForHubSpot(insertQuoteId, prefixForHubSpot);
            if (jobNo) {
              patchHubSpotDealJobNo(hubspotAccessToken, dealHs, jobNo).catch((e) =>
                console.warn("[bin-rental] HubSpot job_no sync:", e),
              );
            }
          }
          break;
        }
        if (isQuoteIdUniqueViolation(insertErr) && attempt < MAX_INSERT_ATTEMPTS - 1) {
          insertQuoteId = await generateQuoteId();
          continue;
        }
        if (isQuoteIdUniqueViolation(insertErr)) {
          return {
            status: 409,
            body: {
              error:
                "Could not assign a unique quote id after several attempts. Wait a moment and retry.",
              code: "QUOTE_ID_DUPLICATE",
              detail: insertErr.message,
            },
          };
        }
        return { status: 500, body: { error: insertErr.message } };
      }
      if (!inserted) {
        return { status: 500, body: { error: "Quote insert failed", code: "QUOTE_ID_INSERT_FAILED" } };
      }
    }

    const reqId = input.source_request_id?.trim();
    if (reqId) {
      const { data: qUuid } = await sb
        .from("quotes")
        .select("id")
        .eq("quote_id", quoteId)
        .maybeSingle();
      if (qUuid?.id) {
        await sb
          .from("quote_requests")
          .update({
            quote_id: qUuid.id,
            converted_at: new Date().toISOString(),
            status: "quote_sent",
          })
          .eq("id", reqId);
      }
    }
  }

  const expiresAtStr = new Date(Date.now() + expiryDays * 86_400_000).toISOString();

  await logAudit({
    userId: authUser?.id,
    userEmail: authUser?.email,
    action: "quote_status_change",
    resourceType: "quote",
    resourceId: quoteId,
    details: { service_type: "bin_rental", preview: isPreview, source: "generate" },
  });

  if (!isPreview && !isUpdate) {
    await logActivity({
      entity_type: "quote",
      entity_id: String(quoteId),
      event_type: "created",
      description: `Quote created: Bin Rental, ${quoteId}`,
      icon: "quote",
    });
  }

  return {
    status: 200,
    body: {
      quote_id: quoteId,
      quoteId,
      preview: isPreview,
      service_type: "bin_rental",
      distance_km:
        deliveryKmFromHub != null ? Math.round(deliveryKmFromHub * 10) / 10 : null,
      drive_time_min: priceResult.distanceCharge?.deliveryDriveMinutes ?? null,
      move_date: input.move_date,
      expires_at: expiresAtStr,
      factors,
      custom_price,
      deposit_amount: total,
      addons: { items: [], total: 0 },
      inventory: {
        modifier: 1,
        score: 0,
        benchmark: 0,
        totalItems: 0,
        boxCount: null,
      },
      bin_inventory: {
        total: totalCap,
        out_on_rental: outOnRental,
        available,
      },
      labour: null,
      truck: {
        primary: null,
        secondary: null,
        isMultiVehicle: false,
        notes: null,
        range: null,
      },
      valuation: { included: {}, upgrades: {}, tiers: [] },
    },
  };
}
