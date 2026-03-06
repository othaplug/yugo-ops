import { createAdminClient } from "@/lib/supabase/admin";

/* ─── Types ─── */

export interface ServiceSelection {
  slug: string;
  quantity?: number;
  selectedPrice?: number;
}

export interface PriceBreakdownItem {
  label: string;
  amount: number;
  detail?: string;
}

export interface DeliveryPriceResult {
  basePrice: number;
  overagePrice: number;
  servicesPrice: number;
  zoneSurcharge: number;
  distanceOverage: number;
  heavyItemSurcharge: number;
  afterHoursSurcharge: number;
  volumeDiscount: number;
  totalPrice: number;
  breakdown: PriceBreakdownItem[];
  effectivePerStop?: number;
}

export interface HeavyItemCount {
  tier: "250_400" | "400_600";
  count: number;
}

/* ─── Helpers ─── */

function getOverageTier(dayType: "full_day" | "half_day", extraStops: number, includedStops: number): string {
  if (dayType === "full_day") {
    const absoluteStop = includedStops + extraStops;
    return absoluteStop <= 10 ? "full_7_10" : "full_11_plus";
  }
  const absoluteStop = includedStops + extraStops;
  return absoluteStop <= 6 ? "half_4_6" : "half_7_plus";
}

/* ─── Day Rate Calculator ─── */

export async function calculateDayRate(opts: {
  rateCardId: string;
  vehicleType: string;
  dayType: "full_day" | "half_day";
  numStops: number;
  services: ServiceSelection[];
  isAfterHours: boolean;
  isWeekend: boolean;
  pricingTier: "standard" | "partner";
}): Promise<DeliveryPriceResult> {
  const db = createAdminClient();
  const { rateCardId, vehicleType, dayType, numStops, services, isAfterHours, isWeekend, pricingTier } = opts;

  const breakdown: PriceBreakdownItem[] = [];

  // 1. Base day rate
  const { data: dayRate } = await db
    .from("rate_card_day_rates")
    .select("*")
    .eq("rate_card_id", rateCardId)
    .eq("vehicle_type", vehicleType)
    .eq("pricing_tier", pricingTier)
    .single();

  if (!dayRate) throw new Error(`No day rate found for ${vehicleType} / ${pricingTier}`);

  const basePrice = dayType === "full_day" ? dayRate.full_day_price : dayRate.half_day_price;
  const includedStops = dayType === "full_day" ? dayRate.stops_included_full : dayRate.stops_included_half;

  const dayLabel = dayType === "full_day" ? "Full Day" : "Half Day";
  breakdown.push({ label: `${vehicleType.toUpperCase()} ${dayLabel}`, amount: basePrice, detail: `${includedStops} stops included` });

  // 2. Stop overages
  let overagePrice = 0;
  const extraStops = Math.max(0, numStops - includedStops);
  if (extraStops > 0) {
    const { data: overages } = await db
      .from("rate_card_overages")
      .select("*")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier);

    if (overages && overages.length > 0) {
      const overageMap = Object.fromEntries(overages.map((o) => [o.overage_tier, o.price_per_stop]));

      let remaining = extraStops;
      // First tier of overages (e.g. stops 7-10 for full day)
      const firstTier = getOverageTier(dayType, 1, includedStops);
      const firstMax = dayType === "full_day" ? Math.min(remaining, 10 - includedStops) : Math.min(remaining, 6 - includedStops);
      const tier1Stops = Math.max(0, Math.min(remaining, firstMax));

      if (tier1Stops > 0 && overageMap[firstTier]) {
        const tier1Cost = tier1Stops * overageMap[firstTier];
        overagePrice += tier1Cost;
        breakdown.push({ label: `Extra stops (${tier1Stops} x $${overageMap[firstTier]})`, amount: tier1Cost });
        remaining -= tier1Stops;
      }

      // Second tier (11+ for full day, 7+ for half day)
      if (remaining > 0) {
        const secondTier = dayType === "full_day" ? "full_11_plus" : "half_7_plus";
        if (overageMap[secondTier]) {
          const tier2Cost = remaining * overageMap[secondTier];
          overagePrice += tier2Cost;
          breakdown.push({ label: `Extra stops ${remaining} x $${overageMap[secondTier]}`, amount: tier2Cost });
        }
      }
    }
  }

  // 3. Services
  let servicesPrice = 0;
  if (services.length > 0) {
    const { data: svcData } = await db
      .from("rate_card_services")
      .select("*")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier);

    const svcMap = Object.fromEntries((svcData || []).map((s) => [s.service_slug, s]));

    for (const svc of services) {
      const def = svcMap[svc.slug];
      if (!def) continue;

      let cost = 0;
      if (def.price_unit === "per_flight") {
        cost = def.price_min * (svc.quantity || 1);
        breakdown.push({ label: `${def.service_name} (${svc.quantity || 1} flights)`, amount: cost });
      } else if (def.price_unit === "per_stop") {
        cost = def.price_min * (svc.quantity || 1);
        breakdown.push({ label: `${def.service_name} (${svc.quantity || 1} stops)`, amount: cost });
      } else if (def.price_unit === "percentage") {
        // Percentage surcharges applied later
        continue;
      } else {
        cost = svc.selectedPrice || def.price_min;
        breakdown.push({ label: def.service_name, amount: cost });
      }
      servicesPrice += cost;
    }
  }

  // 4. After hours / weekend surcharge (percentage of base)
  let afterHoursSurcharge = 0;
  if (isAfterHours || isWeekend) {
    const { data: svcData } = await db
      .from("rate_card_services")
      .select("*")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier)
      .in("service_slug", ["after_hours", "weekend"]);

    const svcMap = Object.fromEntries((svcData || []).map((s) => [s.service_slug, s]));

    if (isAfterHours && svcMap.after_hours) {
      const pct = svcMap.after_hours.price_min / 100;
      afterHoursSurcharge += Math.round(basePrice * pct);
      breakdown.push({ label: `After Hours (+${svcMap.after_hours.price_min}%)`, amount: Math.round(basePrice * pct) });
    }
    if (isWeekend && svcMap.weekend) {
      const pct = svcMap.weekend.price_min / 100;
      afterHoursSurcharge += Math.round(basePrice * pct);
      breakdown.push({ label: `Weekend (+${svcMap.weekend.price_min}%)`, amount: Math.round(basePrice * pct) });
    }
  }

  const totalPrice = basePrice + overagePrice + servicesPrice + afterHoursSurcharge;
  const effectivePerStop = numStops > 0 ? Math.round(totalPrice / numStops) : totalPrice;

  return {
    basePrice,
    overagePrice,
    servicesPrice,
    zoneSurcharge: 0,
    distanceOverage: 0,
    heavyItemSurcharge: 0,
    afterHoursSurcharge,
    volumeDiscount: 0,
    totalPrice,
    breakdown,
    effectivePerStop,
  };
}

/* ─── Per-Delivery Calculator ─── */

export async function calculatePerDelivery(opts: {
  rateCardId: string;
  deliveryType: string;
  zone: number;
  services: ServiceSelection[];
  isAfterHours: boolean;
  isWeekend: boolean;
  pricingTier: "standard" | "partner";
  distanceKm?: number | null;
  heavyItems?: HeavyItemCount[];
}): Promise<DeliveryPriceResult> {
  const db = createAdminClient();
  const { rateCardId, deliveryType, zone, services, isAfterHours, isWeekend, pricingTier, distanceKm, heavyItems } = opts;

  const breakdown: PriceBreakdownItem[] = [];

  // 1. Base per-delivery rate (always Zone 1 — GTA 0–40 km)
  const { data: rate } = await db
    .from("rate_card_delivery_rates")
    .select("*")
    .eq("rate_card_id", rateCardId)
    .eq("delivery_type", deliveryType)
    .eq("zone", 1)
    .eq("pricing_tier", pricingTier)
    .single();

  if (!rate) throw new Error(`No rate found for ${deliveryType} zone 1 / ${pricingTier}`);

  const typeLabels: Record<string, string> = {
    single_item: "Single Item", multi_piece: "Multi-Piece",
    full_room: "Full Room Setup", curbside: "Curbside Drop", oversized: "Oversized/Fragile",
  };

  const basePrice = rate.price_min;
  breakdown.push({ label: `${typeLabels[deliveryType] || deliveryType} Delivery`, amount: basePrice, detail: "Zone 1 — GTA" });

  // 2. Zone surcharge for Zone 2, 3, 4 (Zone 1 is included)
  let zoneSurcharge = 0;
  if (zone >= 2) {
    const { data: zoneData } = await db
      .from("rate_card_zones")
      .select("surcharge, zone_name")
      .eq("rate_card_id", rateCardId)
      .eq("zone_number", zone)
      .eq("pricing_tier", pricingTier)
      .single();

    if (zoneData && zoneData.surcharge > 0) {
      zoneSurcharge = Number(zoneData.surcharge);
      breakdown.push({ label: `Zone ${zone} Surcharge (${zoneData.zone_name})`, amount: zoneSurcharge });
    }
  }

  // 2b. Distance overage (per-km beyond 40 km / 80 km)
  let distanceOverage = 0;
  if (distanceKm != null && distanceKm > 40) {
    const { data: distRates } = await db
      .from("rate_card_distance_overages")
      .select("from_km, to_km, rate_per_km")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier)
      .order("from_km", { ascending: true });

    if (distRates && distRates.length > 0) {
      for (const r of distRates) {
        const from = Number(r.from_km);
        const to = r.to_km != null ? Number(r.to_km) : Infinity;
        const rate = Number(r.rate_per_km);
        if (distanceKm > from) {
          const kmInTier = Math.min(distanceKm, to) - from;
          if (kmInTier > 0) {
            const amt = Math.round(kmInTier * rate);
            distanceOverage += amt;
            breakdown.push({ label: `Mileage (${kmInTier} km × $${rate}/km)`, amount: amt });
          }
        }
      }
    }
  }

  // 2c. Heavy item surcharges (250–400 lbs, 400–600 lbs per item)
  let heavyItemSurcharge = 0;
  if (heavyItems && heavyItems.length > 0) {
    const { data: weightRates } = await db
      .from("rate_card_weight_surcharges")
      .select("weight_min_lbs, weight_max_lbs, surcharge_per_item, label")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier);

    const tierMap: Record<string, number> = {};
    if (weightRates) {
      for (const w of weightRates) {
        const key = w.weight_min_lbs === 250 ? "250_400" : w.weight_min_lbs === 400 ? "400_600" : "";
        if (key) tierMap[key] = Number(w.surcharge_per_item);
      }
    }

    for (const h of heavyItems) {
      const surcharge = tierMap[h.tier] ?? 0;
      if (surcharge > 0 && h.count > 0) {
        const amt = surcharge * h.count;
        heavyItemSurcharge += amt;
        const label = h.tier === "250_400" ? "250–400 lbs" : "400–600 lbs";
        breakdown.push({ label: `Heavy items (${h.count} × ${label})`, amount: amt });
      }
    }
  }

  // 3. Services
  let servicesPrice = 0;
  if (services.length > 0) {
    const { data: svcData } = await db
      .from("rate_card_services")
      .select("*")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier);

    const svcMap = Object.fromEntries((svcData || []).map((s) => [s.service_slug, s]));

    for (const svc of services) {
      const def = svcMap[svc.slug];
      if (!def) continue;
      if (def.price_unit === "percentage") continue;

      let cost = 0;
      if (def.price_unit === "per_flight") {
        cost = def.price_min * (svc.quantity || 1);
        breakdown.push({ label: `${def.service_name} (${svc.quantity || 1} flights)`, amount: cost });
      } else if (def.price_unit === "per_stop") {
        cost = def.price_min * (svc.quantity || 1);
        breakdown.push({ label: `${def.service_name} (${svc.quantity || 1})`, amount: cost });
      } else {
        cost = svc.selectedPrice || def.price_min;
        breakdown.push({ label: def.service_name, amount: cost });
      }
      servicesPrice += cost;
    }
  }

  // 4. After hours / weekend
  let afterHoursSurcharge = 0;
  if (isAfterHours || isWeekend) {
    const { data: svcData } = await db
      .from("rate_card_services")
      .select("*")
      .eq("rate_card_id", rateCardId)
      .eq("pricing_tier", pricingTier)
      .in("service_slug", ["after_hours", "weekend"]);

    const svcMap = Object.fromEntries((svcData || []).map((s) => [s.service_slug, s]));

    if (isAfterHours && svcMap.after_hours) {
      const pct = svcMap.after_hours.price_min / 100;
      afterHoursSurcharge += Math.round(basePrice * pct);
      breakdown.push({ label: `After Hours (+${svcMap.after_hours.price_min}%)`, amount: Math.round(basePrice * pct) });
    }
    if (isWeekend && svcMap.weekend) {
      const pct = svcMap.weekend.price_min / 100;
      afterHoursSurcharge += Math.round(basePrice * pct);
      breakdown.push({ label: `Weekend (+${svcMap.weekend.price_min}%)`, amount: Math.round(basePrice * pct) });
    }
  }

  const totalPrice = basePrice + zoneSurcharge + distanceOverage + heavyItemSurcharge + servicesPrice + afterHoursSurcharge;

  return {
    basePrice,
    overagePrice: 0,
    servicesPrice,
    zoneSurcharge,
    distanceOverage,
    heavyItemSurcharge,
    afterHoursSurcharge,
    volumeDiscount: 0,
    totalPrice,
    breakdown,
  };
}

/* ─── Zone Detection ─── */

export async function detectZone(rateCardId: string, distanceKm: number, pricingTier: "standard" | "partner"): Promise<{ zone: number; zoneName: string; surcharge: number }> {
  const db = createAdminClient();

  const { data: zones } = await db
    .from("rate_card_zones")
    .select("*")
    .eq("rate_card_id", rateCardId)
    .eq("pricing_tier", pricingTier)
    .order("zone_number", { ascending: true });

  if (!zones || zones.length === 0) return { zone: 1, zoneName: "GTA", surcharge: 0 };

  for (const z of zones) {
    const min = z.distance_min_km ?? 0;
    const max = z.distance_max_km ?? Infinity;
    if (distanceKm >= min && distanceKm < max) {
      return { zone: z.zone_number, zoneName: z.zone_name, surcharge: z.surcharge };
    }
  }

  const last = zones[zones.length - 1];
  return { zone: last.zone_number, zoneName: last.zone_name, surcharge: last.surcharge };
}

/* ─── Volume Discount ─── */

export async function getVolumeDiscount(rateCardId: string, deliveryCount: number): Promise<number> {
  const db = createAdminClient();

  const { data: bonuses } = await db
    .from("rate_card_volume_bonuses")
    .select("*")
    .eq("rate_card_id", rateCardId)
    .order("min_deliveries", { ascending: true });

  if (!bonuses || bonuses.length === 0) return 0;

  for (const b of [...bonuses].reverse()) {
    if (deliveryCount >= b.min_deliveries) return b.discount_pct;
  }

  return 0;
}

/* ─── Get Active Rate Card for Org ─── */

export async function getActiveRateCard(organizationId: string): Promise<string | null> {
  const db = createAdminClient();

  const { data } = await db
    .from("partner_rate_cards")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  return data?.id ?? null;
}
