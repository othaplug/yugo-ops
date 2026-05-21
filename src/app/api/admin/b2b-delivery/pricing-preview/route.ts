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
import {
  mergedRatesWithBundleTiers,
  prepareB2bLineItemsForDimensionalEngine,
} from "@/lib/b2b-dimensional-quote-prep";
import { getZoneFromDistance } from "@/lib/b2b/zone-detector";
import { parseRateCard } from "@/lib/b2b/rate-card-types";
import { calcCabinetPrice, calcAppliancePrice } from "@/lib/b2b/cabinet-pricing";
import { calcFlooringPrice, type FlooringMaterial, type FlooringHandling } from "@/lib/b2b/flooring-pricing";

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

    // ── Flat-band rate card path (cabinetry, flooring, appliance) ────────────
    if (FLAT_BAND_VERTICALS.has(verticalCode)) {
      const rcRaw = config.get("b2b_rate_card");
      const rateCard = rcRaw ? parseRateCard(JSON.parse(rcRaw)) : null;
      if (!rateCard) {
        return NextResponse.json(
          { error: "Rate card not configured — run the b2b_rate_card SQL migration" },
          { status: 500 },
        );
      }

      const deliveryKmFromOffice = await straightLineKmFromGtaCore(deliveryMain);
      const zone = getZoneFromDistance(deliveryKmFromOffice ?? 0);

      const totalUnits = lines.reduce((s, l) => s + Math.max(1, l.quantity), 0);
      const isPartner = !!orgId;
      const isWeekend = scheduledDate ? isMoveDateWeekend(scheduledDate) : false;
      const hasLongCarry =
        pickupAccess === "long_carry" || deliveryAccess === "long_carry";
      const stairFlights =
        typeof body.stairs_flights === "number" && body.stairs_flights > 0
          ? Math.floor(body.stairs_flights)
          : 0;

      // Heavy / overweight counts from weight_category on line items
      const heavyItemCount = lines.reduce((s, l) => {
        const wc = (l.weight_category ?? "").toLowerCase();
        return s + (wc === "heavy" || wc === "very_heavy" ? l.quantity : 0);
      }, 0);
      const overweightItemCount = lines.reduce((s, l) => {
        const wc = (l.weight_category ?? "").toLowerCase();
        return s + (wc === "super_heavy" ? l.quantity : 0);
      }, 0);

      let result: ReturnType<typeof calcCabinetPrice>;

      if (verticalCode === "flooring") {
        const rawMat = typeof body.flooring_material === "string"
          ? body.flooring_material.toLowerCase()
          : "vinyl";
        const material: FlooringMaterial =
          rawMat === "hardwood" || rawMat === "tile" ? rawMat : "vinyl";
        const rawHandling = handlingType.toLowerCase();
        const handling: FlooringHandling =
          rawHandling === "inside" ||
          rawHandling === "room_placement" ||
          rawHandling === "room_of_choice" ||
          rawHandling === "white_glove"
            ? "inside"
            : "curbside";

        const boxCount =
          typeof body.box_count === "number" && body.box_count > 0
            ? Math.round(body.box_count)
            : totalUnits;

        result = calcFlooringPrice(
          {
            boxCount,
            material,
            handling,
            zone,
            isPartner,
            addons: {
              stairsFlights: stairFlights,
              longCarry: hasLongCarry,
              weekend: isWeekend,
            },
          },
          rateCard,
        );
      } else if (verticalCode === "appliance") {
        result = calcAppliancePrice(
          {
            pieceCount: totalUnits,
            zone,
            isPartner,
            addons: {
              longCarry: hasLongCarry,
              stairsFlights: stairFlights,
              weekend: isWeekend,
              heavyItemCount,
            },
          },
          rateCard,
        );
      } else {
        // cabinetry
        const declaredValRaw = lines.find((l) => l.declared_value)?.declared_value;
        const insuranceDeclaredValue = declaredValRaw
          ? Number(declaredValRaw.replace(/[^0-9.]/g, "")) || undefined
          : undefined;

        result = calcCabinetPrice(
          {
            pieceCount: totalUnits,
            zone,
            isPartner,
            addons: {
              longCarry: hasLongCarry,
              stairsFlights: stairFlights,
              weekend: isWeekend,
              heavyItemCount,
              overweightItemCount,
              insuranceDeclaredValue,
            },
          },
          rateCard,
        );
      }

      const taxRate = cfgNum(config, "tax_rate", TAX_FALLBACK);
      const preRoundSubtotal = result.total;
      const rounding = cfgNum(config, "rounding_nearest", 25);
      const roundedPreTax = roundTo(preRoundSubtotal, rounding);
      const hst = Math.round(roundedPreTax * taxRate * 100) / 100;

      return NextResponse.json({
        ok: true,
        subtotal_pre_round: preRoundSubtotal,
        access_surcharge: 0,
        multi_stop_surcharge: 0,
        rounded_pre_tax: roundedPreTax,
        hst,
        total_with_tax: Math.round((roundedPreTax + hst) * 100) / 100,
        breakdown: result.breakdown,
        includes: [`${totalUnits} item${totalUnits !== 1 ? "s" : ""}`, zone.replace(/_/g, " "), isPartner ? "partner rate" : "standard rate"],
        truck: "sprinter",
        crew: 2,
        estimated_hours: null,
        total_distance_km: distKm,
        stop_count: 2,
        requires_custom_quote: result.requiresCustomQuote,
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
    const roundedSubtotal = roundTo(
      engineSubtotal + accessSurcharge + multiStopLineAmount,
      rounding,
    );
    const hst = Math.round(roundedSubtotal * taxRate * 100) / 100;

    const breakdownOut = [...dim.breakdown];
    if (multiStopLineAmount > 0) {
      breakdownOut.push({
        label: `Additional pickup stops (${extraPickupStopsForSurcharge} × $${perMultiStop})`,
        amount: multiStopLineAmount,
      });
    }

    return NextResponse.json({
      ok: true,
      subtotal_pre_round: engineSubtotal,
      access_surcharge: accessSurcharge,
      multi_stop_surcharge: multiStopLineAmount,
      rounded_pre_tax: roundedSubtotal,
      hst,
      total_with_tax: Math.round((roundedSubtotal + hst) * 100) / 100,
      breakdown: breakdownOut,
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
