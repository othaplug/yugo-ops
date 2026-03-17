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
  afterHoursSurcharge: number;
  volumeDiscount: number;
  totalPrice: number;
  breakdown: PriceBreakdownItem[];
  effectivePerStop?: number;
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
  lookup?: RateCardLookup;
  oversizedCount?: number;
}): Promise<DeliveryPriceResult> {
  const db = createAdminClient();
  const { rateCardId, vehicleType, dayType, numStops, services, isAfterHours, isWeekend, pricingTier, oversizedCount = 0 } = opts;
  const lookup = opts.lookup || { rateCardId, templateId: null };

  const breakdown: PriceBreakdownItem[] = [];

  // 1. Base day rate
  let dayRateQuery = db
    .from("rate_card_day_rates")
    .select("*")
    .eq("vehicle_type", vehicleType)
    .eq("pricing_tier", pricingTier);
  dayRateQuery = applyRateFilter(dayRateQuery, lookup);
  const { data: dayRate } = await dayRateQuery.single();

  if (!dayRate) throw new Error(`No day rate found for ${vehicleType} / ${pricingTier}`);

  const basePrice = dayType === "full_day" ? dayRate.full_day_price : dayRate.half_day_price;
  const includedStops = dayType === "full_day" ? dayRate.stops_included_full : dayRate.stops_included_half;

  const dayLabel = dayType === "full_day" ? "Full Day" : "Half Day";
  breakdown.push({ label: `${vehicleType.toUpperCase()} ${dayLabel}`, amount: basePrice, detail: `${includedStops} stops included` });

  // 2. Stop overages
  let overagePrice = 0;
  const extraStops = Math.max(0, numStops - includedStops);
  if (extraStops > 0) {
    let ovQuery = db
      .from("rate_card_overages")
      .select("*")
      .eq("pricing_tier", pricingTier);
    ovQuery = applyRateFilter(ovQuery, lookup);
    const { data: overages } = await ovQuery;

    if (overages && overages.length > 0) {
      const overageMap = Object.fromEntries(overages.map((o) => [o.overage_tier, o.price_per_stop]));

      let remaining = extraStops;
      const firstTier = getOverageTier(dayType, 1, includedStops);
      const firstMax = dayType === "full_day" ? Math.min(remaining, 10 - includedStops) : Math.min(remaining, 6 - includedStops);
      const tier1Stops = Math.max(0, Math.min(remaining, firstMax));

      if (tier1Stops > 0 && overageMap[firstTier]) {
        const tier1Cost = tier1Stops * overageMap[firstTier];
        overagePrice += tier1Cost;
        breakdown.push({ label: `Extra stops (${tier1Stops} x $${overageMap[firstTier]})`, amount: tier1Cost });
        remaining -= tier1Stops;
      }

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
    let svcQuery = db
      .from("rate_card_services")
      .select("*")
      .eq("pricing_tier", pricingTier);
    svcQuery = applyRateFilter(svcQuery, lookup);
    const { data: svcData } = await svcQuery;

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
    let ahQuery = db
      .from("rate_card_services")
      .select("*")
      .eq("pricing_tier", pricingTier)
      .in("service_slug", ["after_hours", "weekend"]);
    ahQuery = applyRateFilter(ahQuery, lookup);
    const { data: svcData } = await ahQuery;

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

  // 5. Oversized / heavy item surcharge ($85 per oversized item)
  let oversizedSurcharge = 0;
  if (oversizedCount > 0) {
    const OVERSIZED_SURCHARGE_PER_ITEM = 85;
    oversizedSurcharge = oversizedCount * OVERSIZED_SURCHARGE_PER_ITEM;
    breakdown.push({
      label: `Heavy/oversized items (${oversizedCount} × $${OVERSIZED_SURCHARGE_PER_ITEM})`,
      amount: oversizedSurcharge,
      detail: "Piano, safe, marble table, etc.",
    });
  }

  const totalPrice = basePrice + overagePrice + servicesPrice + afterHoursSurcharge + oversizedSurcharge;
  const effectivePerStop = numStops > 0 ? Math.round(totalPrice / numStops) : totalPrice;

  return {
    basePrice,
    overagePrice,
    servicesPrice,
    zoneSurcharge: 0,
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
  lookup?: RateCardLookup;
  deliveryAccess?: string | null;
  itemWeightCategory?: string | null;
}): Promise<DeliveryPriceResult> {
  const db = createAdminClient();
  const { rateCardId, deliveryType, zone, services, isAfterHours, isWeekend, pricingTier, deliveryAccess, itemWeightCategory } = opts;
  const lookup = opts.lookup || { rateCardId, templateId: null };

  const breakdown: PriceBreakdownItem[] = [];

  // 1. Base per-delivery rate (zone 1 or 2 have direct rates)
  const lookupZone = Math.min(zone, 2);
  let rateQuery = db
    .from("rate_card_delivery_rates")
    .select("*")
    .eq("delivery_type", deliveryType)
    .eq("zone", lookupZone)
    .eq("pricing_tier", pricingTier);
  rateQuery = applyRateFilter(rateQuery, lookup);
  const { data: rate } = await rateQuery.single();

  if (!rate) throw new Error(`No rate found for ${deliveryType} zone ${lookupZone} / ${pricingTier}`);

  const typeLabels: Record<string, string> = {
    single_item: "Single Item", multi_piece: "Multi-Piece", multi_stop: "Multi-Stop",
    full_room: "Full Room Setup", curbside: "Curbside Drop", oversized: "Oversized/Fragile",
    day_rate: "Day Rate", b2b: "B2B", b2b_delivery: "B2B", delivery: "Standard Delivery",
    designer: "Designer", retail: "Retail", hospitality: "Hospitality", gallery: "Gallery", project: "Project",
  };
  const toReadable = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const basePrice = rate.price_min;
  breakdown.push({ label: `${typeLabels[deliveryType] ?? toReadable(deliveryType)} Delivery`, amount: basePrice, detail: `Zone ${lookupZone}` });

  // 2. Zone surcharge for Z3+
  let zoneSurcharge = 0;
  if (zone >= 3) {
    let zq = db
      .from("rate_card_zones")
      .select("surcharge, zone_name")
      .eq("zone_number", zone)
      .eq("pricing_tier", pricingTier);
    zq = applyRateFilter(zq, lookup);
    const { data: zoneData } = await zq.single();

    if (zoneData && zoneData.surcharge) {
      zoneSurcharge = zoneData.surcharge;
      breakdown.push({ label: `Zone ${zone} Surcharge (${zoneData.zone_name})`, amount: zoneSurcharge });
    }
  } else if (zone === 2) {
    let zq = db
      .from("rate_card_zones")
      .select("surcharge, zone_name")
      .eq("zone_number", 2)
      .eq("pricing_tier", pricingTier);
    zq = applyRateFilter(zq, lookup);
    const { data: zoneData } = await zq.single();

    if (zoneData && zoneData.surcharge > 0) {
      zoneSurcharge = zoneData.surcharge;
      breakdown.push({ label: `Zone 2 Surcharge (${zoneData.zone_name})`, amount: zoneSurcharge });
    }
  }

  // 3. Services
  let servicesPrice = 0;
  if (services.length > 0) {
    let svcQuery = db
      .from("rate_card_services")
      .select("*")
      .eq("pricing_tier", pricingTier);
    svcQuery = applyRateFilter(svcQuery, lookup);
    const { data: svcData } = await svcQuery;

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
    let ahQuery = db
      .from("rate_card_services")
      .select("*")
      .eq("pricing_tier", pricingTier)
      .in("service_slug", ["after_hours", "weekend"]);
    ahQuery = applyRateFilter(ahQuery, lookup);
    const { data: svcData } = await ahQuery;

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

  // 5. B2B access surcharge (per-delivery only)
  let accessSurcharge = 0;
  if (deliveryAccess) {
    const { data: cfg } = await db.from("platform_config").select("value").eq("key", "b2b_access_surcharges").single();
    const accessMap = cfg?.value ? (JSON.parse(cfg.value) as Record<string, number>) : {};
    accessSurcharge = accessMap[deliveryAccess] ?? 0;
    if (accessSurcharge > 0) {
      const accessLabels: Record<string, string> = {
        walk_up_2nd: "Walk-up 2nd", walk_up_3rd: "Walk-up 3rd", walk_up_4th_plus: "Walk-up 4th+",
        long_carry: "Long Carry", narrow_stairs: "Narrow Stairs", no_parking: "No Parking",
      };
      breakdown.push({ label: `Access surcharge (${accessLabels[deliveryAccess] || deliveryAccess})`, amount: accessSurcharge });
    }
  }

  // 6. B2B weight surcharge (per-delivery only)
  let weightSurcharge = 0;
  if (itemWeightCategory && itemWeightCategory !== "standard") {
    const { data: cfg } = await db.from("platform_config").select("value").eq("key", "b2b_weight_surcharges").single();
    const weightMap = cfg?.value ? (JSON.parse(cfg.value) as Record<string, number>) : {};
    weightSurcharge = weightMap[itemWeightCategory] ?? 0;
    if (weightSurcharge > 0) {
      const weightLabels: Record<string, string> = {
        heavy: "Heavy (100-250 lbs)", very_heavy: "Very Heavy (250-500 lbs)", oversized_fragile: "Oversized/Fragile",
      };
      breakdown.push({ label: `Weight surcharge (${weightLabels[itemWeightCategory] || itemWeightCategory})`, amount: weightSurcharge });
    }
  }

  const totalPrice = basePrice + zoneSurcharge + servicesPrice + afterHoursSurcharge + accessSurcharge + weightSurcharge;

  return {
    basePrice,
    overagePrice: 0,
    servicesPrice,
    zoneSurcharge,
    afterHoursSurcharge,
    volumeDiscount: 0,
    totalPrice,
    breakdown,
  };
}

/* ─── Zone Detection ─── */

export async function detectZone(rateCardId: string, distanceKm: number, pricingTier: "standard" | "partner", lookup?: RateCardLookup): Promise<{ zone: number; zoneName: string; surcharge: number }> {
  const db = createAdminClient();
  const lk = lookup || { rateCardId, templateId: null };

  let zq = db
    .from("rate_card_zones")
    .select("*")
    .eq("pricing_tier", pricingTier)
    .order("zone_number", { ascending: true });
  zq = applyRateFilter(zq, lk);
  const { data: zones } = await zq;

  if (!zones || zones.length === 0) return { zone: 1, zoneName: "GTA Core", surcharge: 0 };

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

export async function getVolumeDiscount(rateCardId: string, deliveryCount: number, lookup?: RateCardLookup): Promise<number> {
  const db = createAdminClient();
  const lk = lookup || { rateCardId, templateId: null };

  let bq = db
    .from("rate_card_volume_bonuses")
    .select("*")
    .order("min_deliveries", { ascending: true });
  bq = applyRateFilter(bq, lk);
  const { data: bonuses } = await bq;

  if (!bonuses || bonuses.length === 0) return 0;

  for (const b of [...bonuses].reverse()) {
    if (deliveryCount >= b.min_deliveries) return b.discount_pct;
  }

  return 0;
}

/* ─── Rate card lookup result ─── */

export interface RateCardLookup {
  rateCardId: string | null;
  templateId: string | null;
}

/** Build the correct filter for rate sub-table queries */
export function applyRateFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  lookup: RateCardLookup
): T {
  if (lookup.rateCardId) return query.eq("rate_card_id", lookup.rateCardId);
  if (lookup.templateId) return query.eq("template_id", lookup.templateId);
  throw new Error("No rate card or template configured");
}

/* ─── Get Active Rate Card for Org ─── */

export async function getActiveRateCard(organizationId: string): Promise<string | null> {
  const lookup = await getActiveRateCardLookup(organizationId);
  return lookup.rateCardId || lookup.templateId;
}

export async function getActiveRateCardLookup(organizationId: string): Promise<RateCardLookup> {
  const db = createAdminClient();

  // 1. Check legacy partner_rate_cards
  const { data: card } = await db
    .from("partner_rate_cards")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  if (card) return { rateCardId: card.id, templateId: null };

  // 2. Fallback: check organization's template_id (new template system)
  const { data: org } = await db
    .from("organizations")
    .select("template_id")
    .eq("id", organizationId)
    .single();

  if (org?.template_id) return { rateCardId: null, templateId: org.template_id };

  return { rateCardId: null, templateId: null };
}
