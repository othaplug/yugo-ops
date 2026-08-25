import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { getMultiStopDrivingDistance, straightLineKmFromGtaCore } from "@/lib/mapbox/driving-distance";
import {
  calculateB2BDimensionalPrice,
  isMoveDateWeekend,
  type B2BDimensionalQuoteInput,
  type B2BQuoteLineItem,
} from "@/lib/pricing/b2b-dimensional";
import { loadB2BVerticalPricing } from "@/lib/pricing/b2b-vertical-load";
import { applyProcessingRecoveryAndRound } from "@/lib/pricing/processing-recovery";
import {
  mergedRatesWithBundleTiers,
  prepareB2bLineItemsForDimensionalEngine,
} from "@/lib/b2b-dimensional-quote-prep";
import { priceCabinetryFlatBand } from "@/lib/pricing/b2b-flatband";
import { computeB2bFlatBandPrice } from "@/lib/pricing/b2b-flatband-vertical";
import {
  computeJobScopeSurcharge,
  isValidJobScope,
  B2B_RECOVER_UPLIFT_PCT_DEFAULT,
  B2B_RECEIVING_FEE_DEFAULT,
  type JobScope,
} from "@/lib/pricing/b2b-job-scope-pricing";

/** Vertical codes that use flat-band rate card instead of the dimensional engine. */
const FLAT_BAND_VERTICALS = new Set(["cabinetry", "appliance", "flooring"]);

const TAX_FALLBACK = 0.13;

function cfgNum(config: Map<string, string>, key: string, fb: number): number {
  const v = config.get(key);
  return v !== undefined ? Number(v) : fb;
}

function parseJsonConfig<T>(config: Map<string, string>, key: string, fallback: T): T {
  try {
    const v = config.get(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function roundTo(amount: number, nearest: number): number {
  if (!nearest || nearest <= 0) return Math.round(amount * 100) / 100;
  return Math.round(amount / nearest) * nearest;
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const verticalCode = String(body.vertical_code || "").trim();
    const orgId = typeof body.organization_id === "string" ? body.organization_id.trim() || null : null;
    const scheduledDate = String(body.scheduled_date || "").trim();
    const pickupMain = String(body.pickup_address || "").trim();
    const deliveryMain = String(body.delivery_address || "").trim();
    const pickupAccess = String(body.pickup_access || "").trim();
    const deliveryAccess = String(body.delivery_access || "").trim();
    const handlingType = String(body.handling_type || "threshold").toLowerCase();

    if (!verticalCode || !pickupMain || !deliveryMain) {
      return NextResponse.json(
        { error: "vertical_code, pickup_address, and delivery_address are required" },
        { status: 400 },
      );
    }

    const extraP = Array.isArray(body.extra_pickup_addresses)
      ? (body.extra_pickup_addresses as string[]).map((a) => String(a || "").trim()).filter(Boolean)
      : [];
    const extraD = Array.isArray(body.extra_delivery_addresses)
      ? (body.extra_delivery_addresses as string[]).map((a) => String(a || "").trim()).filter(Boolean)
      : [];

    const routeOrdered = Array.isArray(body.route_addresses_in_order)
      ? (body.route_addresses_in_order as string[]).map((a) => String(a || "").trim()).filter(Boolean)
      : [];

    const addresses =
      routeOrdered.length >= 2
        ? routeOrdered
        : [pickupMain, ...extraP, deliveryMain, ...extraD];
    const distInfo = await getMultiStopDrivingDistance(addresses);
    const distKm = distInfo?.distance_km ?? 0;

    const admin = createAdminClient();
    const { data: cfgRows } = await admin.from("platform_config").select("key, value");
    const config = new Map<string, string>();
    for (const r of cfgRows ?? []) config.set(r.key, r.value);

    const rounding = cfgNum(config, "rounding_nearest", 25);
    const taxRate = cfgNum(config, "tax_rate", TAX_FALLBACK);

    // Job-scope surcharge (warehouse receiving / recover-original swap). Shared
    // with the client estimate and /api/quotes/generate via computeJobScopeSurcharge
    // so the number never drifts. Applied to the final pre-tax at each return
    // path below (added after processing recovery — Yugo absorbs the CC fee on
    // this pass-through logistics amount, which is immaterial).
    const jobScope: JobScope = isValidJobScope(body.job_scope)
      ? body.job_scope
      : "direct_delivery";
    const scopeRates = {
      recoverUpliftPct: cfgNum(
        config,
        "b2b_recover_uplift_pct",
        B2B_RECOVER_UPLIFT_PCT_DEFAULT,
      ),
      receivingFee: cfgNum(config, "b2b_receiving_fee", B2B_RECEIVING_FEE_DEFAULT),
    };
    const withScope = (
      roundedPreTax: number,
      breakdown: Array<{ label: string; amount: number }>,
    ) => {
      const scope = computeJobScopeSurcharge(jobScope, roundedPreTax, scopeRates);
      const preTax = Math.round((roundedPreTax + scope.addPreTax) * 100) / 100;
      const hst = Math.round(preTax * taxRate * 100) / 100;
      return {
        rounded_pre_tax: preTax,
        hst,
        total_with_tax: Math.round((preTax + hst) * 100) / 100,
        breakdown: [...breakdown, ...scope.lines],
      };
    };

    const accessMap = parseJsonConfig<Record<string, number>>(config, "b2b_access_surcharges", {});
    const accessKey = (k: string) => (k === "no_parking_nearby" ? "no_parking" : k);
    const accessSurcharge =
      (pickupAccess ? accessMap[accessKey(pickupAccess)] ?? 0 : 0) +
      (deliveryAccess ? accessMap[accessKey(deliveryAccess)] ?? 0 : 0);

    const lines: B2BQuoteLineItem[] = [];
    const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
    for (const row of rawItems) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const desc = String(o.description || "").trim();
      const qty = Math.max(1, Number(o.quantity) || 1);
      if (!desc) continue;
      const wc = String(o.weight_category || "light").toLowerCase();
      const wcat =
        wc === "medium" || wc === "heavy" || wc === "extra_heavy" ? wc : "light";
      const unitType = typeof o.unit_type === "string" ? o.unit_type.trim() : undefined;
      const haulOld = !!(o.haul_away ?? o.haul_away_old);
      lines.push({
        description: desc,
        quantity: qty,
        weight_category: wcat as B2BQuoteLineItem["weight_category"],
        fragile: !!o.fragile,
        handling_type: typeof o.handling_type === "string" ? o.handling_type : undefined,
        unit_type: unitType || undefined,
        serial_number: typeof o.serial_number === "string" ? o.serial_number.trim() || undefined : undefined,
        stop_assignment: typeof o.stop_assignment === "string" ? o.stop_assignment.trim() || undefined : undefined,
        declared_value: typeof o.declared_value === "string" ? o.declared_value.trim() || undefined : undefined,
        crating_required: !!o.crating_required,
        hookup_required: !!o.hookup_required,
        haul_away: haulOld,
        assembly_required: !!o.assembly_required,
      });
    }

    // ── Cabinetry: continuous cabinet-unit engine (shared with generate) ─────
    // The single source of truth for cabinetry pricing. /api/quotes/generate
    // calls the SAME priceCabinetryFlatBand, so the previewed price and the
    // saved/sent quote can never diverge, and the old dimensional per-piece
    // engine never touches cabinetry again.
    if (verticalCode === "cabinetry") {
      const deliveryKmFromOffice = await straightLineKmFromGtaCore(deliveryMain);
      const stairFlights =
        typeof body.stairs_flights === "number" && body.stairs_flights > 0
          ? Math.floor(body.stairs_flights)
          : 0;
      const fb = priceCabinetryFlatBand(
        {
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            weight_category: l.weight_category,
            unit_type: l.unit_type,
            declared_value: l.declared_value,
          })),
          deliveryKmFromOffice: deliveryKmFromOffice ?? 0,
          extraPickupStops: extraP.length,
          handlingType,
          isPartner: !!orgId,
          weekend: scheduledDate ? isMoveDateWeekend(scheduledDate) : false,
          longCarry:
            pickupAccess === "long_carry" || deliveryAccess === "long_carry",
          stairsFlights: stairFlights,
        },
        config,
      );
      const scoped = withScope(fb.roundedPreTax, fb.breakdown);
      return NextResponse.json({
        ok: true,
        subtotal_pre_round: fb.subtotalPreRound,
        access_surcharge: 0,
        multi_stop_surcharge: 0,
        rounded_pre_tax: scoped.rounded_pre_tax,
        hst: scoped.hst,
        total_with_tax: scoped.total_with_tax,
        breakdown: scoped.breakdown,
        includes: fb.includes,
        truck: fb.truck,
        crew: fb.crew,
        estimated_hours: null,
        total_distance_km: distKm,
        stop_count: 2 + extraP.length + extraD.length,
        requires_custom_quote: fb.requiresCustomQuote,
        pricing_engine: "cabinetry_flatband",
        weighted_units: fb.weightedUnits,
        raw_piece_count: fb.rawPieceCount,
      });
    }

    // ── Flat-band rate card path (flooring, appliance) ───────────────────────
    // Cabinetry is intercepted earlier (priceCabinetryFlatBand); only flooring
    // and appliance reach here. Priced through the SHARED computeB2bFlatBandPrice
    // so the previewed price + truck/crew equal what /api/quotes/generate saves.
    if (FLAT_BAND_VERTICALS.has(verticalCode)) {
      const deliveryKmFromOffice = await straightLineKmFromGtaCore(deliveryMain);
      const fb = computeB2bFlatBandPrice(
        {
          verticalCode,
          deliveryKmFromGta: deliveryKmFromOffice ?? 0,
          lines: lines.map((l) => ({
            quantity: l.quantity,
            weight_category: l.weight_category,
          })),
          isPartner: !!orgId,
          weekend: scheduledDate ? isMoveDateWeekend(scheduledDate) : false,
          longCarry:
            pickupAccess === "long_carry" || deliveryAccess === "long_carry",
          stairsFlights:
            typeof body.stairs_flights === "number" ? body.stairs_flights : 0,
          handlingType,
          flooringMaterial:
            typeof body.flooring_material === "string"
              ? body.flooring_material
              : undefined,
          boxCount:
            typeof body.box_count === "number" ? body.box_count : undefined,
          truckOverride:
            typeof body.truck_override === "string"
              ? body.truck_override
              : undefined,
          crewOverride:
            typeof body.crew_override === "number" ? body.crew_override : undefined,
        },
        config,
      );
      if (!fb.ok) {
        return NextResponse.json(
          {
            error:
              fb.error ||
              "Rate card not configured — run the b2b_rate_card SQL migration",
          },
          { status: 500 },
        );
      }
      const scoped = withScope(fb.roundedPreTax, fb.breakdown);
      return NextResponse.json({
        ok: true,
        subtotal_pre_round: fb.subtotalPreRound,
        access_surcharge: 0,
        multi_stop_surcharge: 0,
        rounded_pre_tax: scoped.rounded_pre_tax,
        hst: scoped.hst,
        total_with_tax: scoped.total_with_tax,
        breakdown: scoped.breakdown,
        includes: fb.includes,
        truck: fb.truck,
        crew: fb.crew,
        estimated_hours: null,
        total_distance_km: distKm,
        stop_count: 2,
        requires_custom_quote: fb.requiresCustomQuote,
        pricing_engine: "flat_band",
      });
    }
    // ── End flat-band path ────────────────────────────────────────────────────

    const loaded = await loadB2BVerticalPricing(admin, verticalCode, orgId);
    if (!loaded) {
      return NextResponse.json({ error: "Unknown or inactive vertical" }, { status: 400 });
    }

    const merged = mergedRatesWithBundleTiers(loaded.mergedRates as Record<string, unknown>);
    const useVerticalZoneSchedule = String(merged.distance_mode || "") === "zones";

    const engineItems = prepareB2bLineItemsForDimensionalEngine(
      lines.length > 0 ? lines : [{ description: "Items TBD", quantity: 1, weight_category: "light" }],
      loaded.vertical.code,
      handlingType,
      loaded.mergedRates as Record<string, unknown>,
    );

    const dimInput: B2BDimensionalQuoteInput = {
      vertical_code: loaded.vertical.code,
      items: engineItems,
      handling_type: handlingType,
      stops: [
        { address: pickupMain, type: "pickup", access: pickupAccess || undefined },
        ...extraP.map((address) => ({ address, type: "pickup" as const })),
        { address: deliveryMain, type: "delivery", access: deliveryAccess || undefined },
        ...extraD.map((address) => ({ address, type: "delivery" as const })),
      ],
      crew_override: typeof body.crew_override === "number" ? body.crew_override : undefined,
      truck_override: typeof body.truck_override === "string" ? body.truck_override : undefined,
      estimated_hours_override:
        typeof body.estimated_hours_override === "number" ? body.estimated_hours_override : undefined,
      time_sensitive: !!body.time_sensitive,
      assembly_required: !!body.assembly_required,
      debris_removal: !!body.debris_removal,
      stairs_flights: typeof body.stairs_flights === "number" ? body.stairs_flights : undefined,
      addons: Array.isArray(body.complexity_addons)
        ? body.complexity_addons.filter((x): x is string => typeof x === "string")
        : [],
      weekend: scheduledDate ? isMoveDateWeekend(scheduledDate) : false,
      after_hours: !!body.after_hours,
      same_day: !!body.same_day,
      skid_count: typeof body.skid_count === "number" ? body.skid_count : undefined,
      total_load_weight_lbs: typeof body.total_load_weight_lbs === "number" ? body.total_load_weight_lbs : undefined,
      haul_away_units: typeof body.haul_away_units === "number" ? body.haul_away_units : undefined,
      returns_pickup: !!body.returns_pickup,
    };

    const extras: { label: string; amount: number }[] = [];
    if (!useVerticalZoneSchedule && scheduledDate) {
      const deliveryKmFromGta = await straightLineKmFromGtaCore(deliveryMain);
      const z2 = cfgNum(config, "b2b_gta_zone2_surcharge", 75);
      const z3 = cfgNum(config, "b2b_gta_zone3_surcharge", 150);
      if (deliveryKmFromGta != null) {
        if (deliveryKmFromGta >= 80 && z3 > 0) extras.push({ label: "Outside GTA core (zone 3)", amount: z3 });
        else if (deliveryKmFromGta >= 40 && z2 > 0) extras.push({ label: "Outside GTA core (zone 2)", amount: z2 });
      }
      const wk = cfgNum(config, "b2b_weekend_surcharge", 40);
      if (scheduledDate && isMoveDateWeekend(scheduledDate) && wk > 0) {
        extras.push({ label: "Weekend delivery", amount: wk });
      }
    }

    const dim = calculateB2BDimensionalPrice({
      vertical: loaded.vertical,
      mergedRates: merged,
      input: dimInput,
      totalDistanceKm: distKm,
      roundingNearest: rounding,
      parkingLongCarryTotal: 0,
      pricingExtras: useVerticalZoneSchedule ? [] : extras,
      platformConfig: config,
    });

    const multiStopProject = !!body.multi_stop_project;
    const extraPickupStopsForSurcharge =
      typeof body.extra_pickup_stops_for_surcharge === "number" &&
      Number.isFinite(body.extra_pickup_stops_for_surcharge)
        ? Math.max(0, Math.floor(body.extra_pickup_stops_for_surcharge))
        : 0;
    const perMultiStop = cfgNum(config, "b2b_multi_stop_surcharge", 75);
    const multiStopLineAmount =
      multiStopProject && extraPickupStopsForSurcharge > 0 && perMultiStop > 0
        ? perMultiStop * extraPickupStopsForSurcharge
        : 0;

    const engineSubtotal = dim.subtotal;
    // Bake CC processing recovery + round, identically to /api/quotes/generate
    // so the previewed price equals the saved/sent quote (see block above).
    const roundedSubtotal = applyProcessingRecoveryAndRound(
      engineSubtotal + accessSurcharge + multiStopLineAmount,
      config,
      50,
    );
    const breakdownOut = [...dim.breakdown];
    if (multiStopLineAmount > 0) {
      breakdownOut.push({
        label: `Additional pickup stops (${extraPickupStopsForSurcharge} × $${perMultiStop})`,
        amount: multiStopLineAmount,
      });
    }
    const scoped = withScope(roundedSubtotal, breakdownOut);

    return NextResponse.json({
      ok: true,
      subtotal_pre_round: engineSubtotal,
      access_surcharge: accessSurcharge,
      multi_stop_surcharge: multiStopLineAmount,
      rounded_pre_tax: scoped.rounded_pre_tax,
      hst: scoped.hst,
      total_with_tax: scoped.total_with_tax,
      breakdown: scoped.breakdown,
      includes: dim.includes,
      truck: dim.truck,
      crew: dim.crew,
      estimated_hours: dim.estimatedHours,
      total_distance_km: dim.totalDistanceKm,
      stop_count: dim.stopCount,
    });
  } catch (e) {
    console.error("[b2b-delivery/pricing-preview]", e);
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}
