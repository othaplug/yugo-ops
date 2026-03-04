import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

interface QuoteInput {
  service_type: string;
  from_address: string;
  to_address: string;
  from_access?: string;
  to_access?: string;
  move_date: string;
  move_size?: string;
  specialty_items?: { type: string; qty: number }[];
  selected_addons?: AddonSelection[];
  hubspot_deal_id?: string;
  contact_id?: string;
  // Office
  square_footage?: number;
  workstation_count?: number;
  has_it_equipment?: boolean;
  has_conference_room?: boolean;
  has_reception_area?: boolean;
  timing_preference?: string;
  // Single item
  item_category?: string;
  item_weight_class?: string;
  assembly_needed?: string;
  stair_carry?: boolean;
  stair_flights?: number;
  number_of_items?: number;
  // White glove
  declared_value?: number;
  // Specialty
  project_type?: string;
  timeline_hours?: number;
  custom_crating_pieces?: number;
  climate_control?: boolean;
  special_equipment?: string[];
  // B2B
  delivery_type?: string;
}

interface AddonSelection {
  addon_id: string;
  quantity?: number;
  tier_index?: number;
}

interface TierResult {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

interface AddonBreakdownItem {
  addon_id: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const TAX_RATE_FALLBACK = 0.13;
const MAPBOX_BASE = "https://api.mapbox.com";

// ═══════════════════════════════════════════════
// Config helpers
// ═══════════════════════════════════════════════

async function loadConfig(sb: SupabaseAdmin): Promise<Map<string, string>> {
  const { data } = await sb.from("platform_config").select("key, value");
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.key, row.value);
  return map;
}

function cfgNum(config: Map<string, string>, key: string, fallback: number): number {
  const v = config.get(key);
  return v !== undefined ? Number(v) : fallback;
}

// ═══════════════════════════════════════════════
// Mapbox geocoding + directions
// ═══════════════════════════════════════════════

function mapboxToken(): string {
  return (
    process.env.MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ""
  );
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = mapboxToken();
  if (!token) return null;
  const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1&country=ca`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const feat = json.features?.[0];
  if (!feat) return null;
  const [lng, lat] = feat.center;
  return { lat, lng };
}

async function getDistance(
  fromAddr: string,
  toAddr: string,
): Promise<{ distance_km: number; drive_time_min: number } | null> {
  const [fromGeo, toGeo] = await Promise.all([geocode(fromAddr), geocode(toAddr)]);
  if (!fromGeo || !toGeo) return null;
  const token = mapboxToken();
  const url = `${MAPBOX_BASE}/directions/v5/mapbox/driving/${fromGeo.lng},${fromGeo.lat};${toGeo.lng},${toGeo.lat}?access_token=${token}&overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) return null;
  return {
    distance_km: Math.round((route.distance / 1000) * 10) / 10,
    drive_time_min: Math.round(route.duration / 60),
  };
}

// ═══════════════════════════════════════════════
// Postal extraction & neighbourhood tier
// ═══════════════════════════════════════════════

function extractPostalPrefix(address: string): string | null {
  const m = address.match(/\b([A-Z]\d[A-Z])\s*\d[A-Z]\d\b/i);
  return m ? m[1].toUpperCase() : null;
}

async function getNeighbourhood(
  sb: SupabaseAdmin,
  address: string,
): Promise<{ tier: string | null; multiplier: number; postalPrefix: string | null }> {
  const prefix = extractPostalPrefix(address);
  if (!prefix) return { tier: null, multiplier: 1.0, postalPrefix: null };
  const { data } = await sb
    .from("neighbourhood_tiers")
    .select("tier, multiplier")
    .eq("postal_prefix", prefix)
    .single();
  return {
    tier: data?.tier ?? null,
    multiplier: data?.multiplier ?? 1.0,
    postalPrefix: prefix,
  };
}

// ═══════════════════════════════════════════════
// Access surcharges
// ═══════════════════════════════════════════════

async function getAccessSurcharge(sb: SupabaseAdmin, accessType: string | undefined): Promise<number> {
  if (!accessType) return 0;
  const { data } = await sb
    .from("access_scores")
    .select("surcharge")
    .eq("access_type", accessType)
    .single();
  return data?.surcharge ?? 0;
}

// ═══════════════════════════════════════════════
// Date multiplier
// ═══════════════════════════════════════════════

function getDayName(date: Date): string {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getUTCDay()];
}

function isMonthEnd(date: Date): boolean {
  const d = date.getUTCDate();
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return d >= lastDay - 2;
}

function getSeasonKey(month: number): string {
  if (month >= 6 && month <= 8) return "peak_jun_aug";
  if (month >= 9 && month <= 11) return "shoulder_sep_nov";
  if (month >= 1 && month <= 3) return "off_peak_jan_mar";
  return "spring_apr_may";
}

async function getDateMultiplier(
  sb: SupabaseAdmin,
  moveDateStr: string,
): Promise<{ multiplier: number; factors: Record<string, number> }> {
  const { data: allFactors } = await sb.from("date_factors").select("factor_type, factor_value, multiplier");
  const lookup = new Map<string, number>();
  for (const f of allFactors ?? []) lookup.set(`${f.factor_type}:${f.factor_value}`, f.multiplier);

  const moveDate = new Date(moveDateStr + "T00:00:00Z");
  const now = new Date();
  const daysOut = Math.floor((moveDate.getTime() - now.getTime()) / 86_400_000);
  const month = moveDate.getUTCMonth() + 1;

  const factors: Record<string, number> = {};
  let combined = 1.0;

  const dayMult = lookup.get(`day_of_week:${getDayName(moveDate)}`) ?? 1.0;
  factors.day_of_week = dayMult;
  combined *= dayMult;

  if (isMonthEnd(moveDate)) {
    const meMult = lookup.get("month_period:month_end") ?? 1.0;
    factors.month_end = meMult;
    combined *= meMult;
  }

  const seasonMult = lookup.get(`season:${getSeasonKey(month)}`) ?? 1.0;
  factors.season = seasonMult;
  combined *= seasonMult;

  if (daysOut >= 0 && daysOut < 7) {
    const urgMult = lookup.get("urgency:last_minute_7days") ?? 1.0;
    factors.urgency = urgMult;
    combined *= urgMult;
  } else if (daysOut >= 30) {
    const ebMult = lookup.get("urgency:early_bird_30plus") ?? 1.0;
    factors.early_bird = ebMult;
    combined *= ebMult;
  }

  return { multiplier: Math.round(combined * 1000) / 1000, factors };
}

// ═══════════════════════════════════════════════
// Specialty surcharges
// ═══════════════════════════════════════════════

async function getSpecialtySurcharge(
  sb: SupabaseAdmin,
  items: { type: string; qty: number }[],
): Promise<number> {
  if (!items || items.length === 0) return 0;
  const types = items.map((i) => i.type);
  const { data } = await sb
    .from("specialty_surcharges")
    .select("item_type, surcharge")
    .in("item_type", types);
  const rateMap = new Map<string, number>();
  for (const r of data ?? []) rateMap.set(r.item_type, r.surcharge);
  let total = 0;
  for (const item of items) {
    total += (rateMap.get(item.type) ?? 0) * (item.qty || 1);
  }
  return total;
}

// ═══════════════════════════════════════════════
// Deposit calculation (from deposit_rules table)
// ═══════════════════════════════════════════════

function amountBracket(amount: number): string {
  if (amount < 500) return "under_500";
  if (amount < 1000) return "500_999";
  if (amount < 3000) return "1000_2999";
  if (amount < 5000) return "3000_4999";
  return "5000_plus";
}

async function calculateDeposit(
  sb: SupabaseAdmin,
  serviceType: string,
  amount: number,
): Promise<number> {
  const bracket = amountBracket(amount);
  const { data } = await sb
    .from("deposit_rules")
    .select("deposit_type, deposit_value")
    .eq("service_type", serviceType)
    .eq("amount_bracket", bracket)
    .single();

  if (!data) {
    if (amount < 500) return amount;
    return 100;
  }

  switch (data.deposit_type) {
    case "full":
      return Math.round(amount);
    case "flat":
      return data.deposit_value;
    case "percent":
      return Math.round(amount * data.deposit_value / 100);
    default:
      return 100;
  }
}

// ═══════════════════════════════════════════════
// Add-on calculation (Step 6.5)
// ═══════════════════════════════════════════════

async function calculateAddons(
  sb: SupabaseAdmin,
  selections: AddonSelection[] | undefined,
  baseTotal: number,
): Promise<{
  total: number;
  breakdown: AddonBreakdownItem[];
  byTierExclusion: Map<string, number>;
}> {
  if (!selections || selections.length === 0) {
    return { total: 0, breakdown: [], byTierExclusion: new Map() };
  }

  const addonIds = selections.map((s) => s.addon_id);
  const { data: addons } = await sb.from("addons").select("*").in("id", addonIds);
  const addonMap = new Map<string, Record<string, unknown>>();
  for (const a of addons ?? []) addonMap.set(a.id, a);

  let total = 0;
  const breakdown: AddonBreakdownItem[] = [];
  const byTierExclusion = new Map<string, number>();

  for (const sel of selections) {
    const addon = addonMap.get(sel.addon_id);
    if (!addon) continue;

    let cost = 0;
    const qty = sel.quantity || 1;

    switch (addon.price_type as string) {
      case "flat":
        cost = (addon.price as number);
        break;
      case "per_unit":
        cost = (addon.price as number) * qty;
        break;
      case "tiered": {
        const tiers = addon.tiers as { label: string; price: number }[] | null;
        cost = tiers?.[sel.tier_index ?? 0]?.price ?? 0;
        break;
      }
      case "percent":
        cost = Math.round(baseTotal * ((addon.percent_value as number) ?? 0));
        break;
    }

    total += cost;
    breakdown.push({
      addon_id: addon.id as string,
      slug: addon.slug as string,
      name: addon.name as string,
      price: cost,
      quantity: qty,
      subtotal: cost,
    });

    const excluded = addon.excluded_tiers as string[] | null;
    if (excluded && excluded.length > 0) {
      for (const tier of excluded) {
        byTierExclusion.set(tier, (byTierExclusion.get(tier) ?? 0) + cost);
      }
    }
  }

  return { total, breakdown, byTierExclusion };
}

// ═══════════════════════════════════════════════
// Quote ID generation
// ═══════════════════════════════════════════════

async function generateQuoteId(sb: SupabaseAdmin, hubspotDealId?: string): Promise<string> {
  if (hubspotDealId) return `YGO-${hubspotDealId}`;

  const { data } = await sb
    .from("quotes")
    .select("quote_id")
    .like("quote_id", "YGO-%")
    .order("created_at", { ascending: false })
    .limit(1);

  let next = 30001;
  if (data && data.length > 0) {
    const num = parseInt(data[0].quote_id.replace("YGO-", ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `YGO-${next}`;
}

// ═══════════════════════════════════════════════
// Rounding helper
// ═══════════════════════════════════════════════

function roundTo(amount: number, nearest: number): number {
  return Math.round(amount / nearest) * nearest;
}

// ═══════════════════════════════════════════════
// Tier includes definitions
// ═══════════════════════════════════════════════

function residentialIncludes(minCrew: number, estHours: number): {
  essentials: string[];
  premier: string[];
  estate: string[];
} {
  const essentials = [
    "26-ft truck",
    `${minCrew} professional movers`,
    `${estHours}-hour window`,
    "Moving blankets",
    "Basic disassembly & reassembly",
    "Floor runners",
  ];
  const premier = [
    ...essentials,
    "Full furniture wrapping",
    "Mattress covers",
    "TV screen protection",
    "Premium furniture pads",
    "Dolly service",
  ];
  const estate = [
    ...premier,
    "Full packing & unpacking",
    "Custom crating for fragile items",
    "White glove handling",
    "Dedicated move coordinator",
  ];
  return { essentials, premier, estate };
}

// ═══════════════════════════════════════════════
// RESIDENTIAL — tiered pricing
// ═══════════════════════════════════════════════

async function calcResidential(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const { data: br } = await sb
    .from("base_rates")
    .select("base_price, min_crew, estimated_hours")
    .eq("move_size", input.move_size ?? "2br")
    .single();

  const baseRate = br?.base_price ?? 1199;
  const minCrew = br?.min_crew ?? 3;
  const estHours = br?.estimated_hours ?? 5;

  const distBaseKm = cfgNum(config, "distance_base_km", 30);
  const distRateKm = cfgNum(config, "distance_rate_per_km", 4.5);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > distBaseKm ? Math.round((distKm - distBaseKm) * distRateKm) : 0;

  const [fromAccess, toAccess] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const accessSurcharge = fromAccess + toAccess;

  const specialtySurcharge = await getSpecialtySurcharge(sb, input.specialty_items ?? []);

  let subtotal = baseRate + distanceSurcharge + accessSurcharge + specialtySurcharge;
  subtotal = Math.round(subtotal * dateMult.multiplier);
  subtotal = Math.round(subtotal * neighbourhood.multiplier);

  const rounding = cfgNum(config, "rounding_nearest", 50);
  const minJob = cfgNum(config, "minimum_job_amount", 549);
  const essentialsMult = cfgNum(config, "tier_essentials_multiplier", 1.0);
  const premierMult = cfgNum(config, "tier_premier_multiplier", 1.35);
  const estateMult = cfgNum(config, "tier_estate_multiplier", 1.85);
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);

  let essBase = roundTo(subtotal * essentialsMult, rounding);
  let premBase = roundTo(subtotal * premierMult, rounding);
  let estBase = roundTo(subtotal * estateMult, rounding);

  if (essBase < minJob) essBase = minJob;
  if (premBase < essBase) premBase = essBase;
  if (estBase < premBase) estBase = premBase;

  const addonForEss = addonResult.total - (addonResult.byTierExclusion.get("essentials") ?? 0);
  const addonForPrem = addonResult.total - (addonResult.byTierExclusion.get("premier") ?? 0);
  const addonForEst = addonResult.total - (addonResult.byTierExclusion.get("estate") ?? 0);

  const essPrice = essBase + addonForEss;
  const premPrice = premBase + addonForPrem;
  const estPrice = estBase + addonForEst;

  const essTax = Math.round(essPrice * taxRate);
  const premTax = Math.round(premPrice * taxRate);
  const estTax = Math.round(estPrice * taxRate);

  const essDep = await calculateDeposit(sb, "residential", essPrice);
  const premDep = await calculateDeposit(sb, "residential", premPrice);
  const estDep = await calculateDeposit(sb, "residential", estPrice);

  const inc = residentialIncludes(minCrew, estHours);

  const tiers = {
    essentials: {
      price: essPrice,
      deposit: essDep,
      tax: essTax,
      total: essPrice + essTax,
      includes: inc.essentials,
    } as TierResult,
    premier: {
      price: premPrice,
      deposit: premDep,
      tax: premTax,
      total: premPrice + premTax,
      includes: inc.premier,
    } as TierResult,
    estate: {
      price: estPrice,
      deposit: estDep,
      tax: estTax,
      total: estPrice + estTax,
      includes: inc.estate,
    } as TierResult,
  };

  return {
    tiers,
    factors: {
      base_rate: baseRate,
      distance_surcharge: distanceSurcharge,
      access_surcharge: accessSurcharge,
      date_multiplier: dateMult.multiplier,
      specialty_surcharge: specialtySurcharge,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
    },
  };
}

// ═══════════════════════════════════════════════
// OFFICE MOVE — single price
// ═══════════════════════════════════════════════

async function calcOffice(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const { data: rates } = await sb.from("office_rates").select("parameter, value");
  const r = new Map<string, number>();
  for (const row of rates ?? []) r.set(row.parameter, row.value);

  const sqftRate = r.get("rate_per_sqft") ?? 3.5;
  const wsRate = r.get("rate_per_workstation") ?? 75;
  const itSurcharge = r.get("it_equipment_surcharge") ?? 200;
  const confRoom = r.get("conference_room") ?? 150;
  const reception = r.get("reception_area") ?? 100;
  const eveningPct = r.get("evening_night_premium") ?? 15;
  const minOffice = r.get("minimum_job_amount") ?? 1500;

  let base =
    (input.square_footage ?? 0) * sqftRate +
    (input.workstation_count ?? 0) * wsRate;

  if (input.has_it_equipment) base += itSurcharge;
  if (input.has_conference_room) base += confRoom;
  if (input.has_reception_area) base += reception;

  const distBaseKm = cfgNum(config, "distance_base_km", 30);
  const distRateKm = cfgNum(config, "distance_rate_per_km", 4.5);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > distBaseKm ? Math.round((distKm - distBaseKm) * distRateKm) : 0;
  base += distanceSurcharge;

  const timing = (input.timing_preference ?? "").toLowerCase();
  if (timing.includes("evening") || timing.includes("night")) {
    base = Math.round(base * (1 + eveningPct / 100));
  }

  base = Math.round(base * dateMult.multiplier);
  base = Math.round(base * neighbourhood.multiplier);

  const rounding = cfgNum(config, "rounding_nearest", 50);
  let price = roundTo(base, rounding);
  if (price < minOffice) price = minOffice;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "office", price);

  const includes = [
    "Professional moving crew",
    "Moving truck(s) as needed",
    "Furniture disassembly & reassembly",
    "Floor & door frame protection",
    "Labeled crate system",
  ];
  if (input.has_it_equipment) includes.push("IT equipment handling");
  if (input.has_conference_room) includes.push("Conference room teardown & setup");

  return {
    custom_price: { price, deposit, tax, total: price + tax, includes } as TierResult,
    factors: {
      base_rate: base,
      distance_surcharge: distanceSurcharge,
      date_multiplier: dateMult.multiplier,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
    },
  };
}

// ═══════════════════════════════════════════════
// LONG DISTANCE — single price
// ═══════════════════════════════════════════════

async function calcLongDistance(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const { data: br } = await sb
    .from("base_rates")
    .select("base_price")
    .eq("move_size", input.move_size ?? "2br")
    .single();

  const baseRate = (br?.base_price ?? 1199) * 1.5;
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > 100 ? Math.round((distKm - 100) * 2.5) : 0;

  let price = baseRate + distanceSurcharge;
  price = Math.round(price * dateMult.multiplier);
  price = Math.round(price * neighbourhood.multiplier);

  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);
  if (price < 2500) price = 2500;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "long_distance", price);

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: [
        "Climate-controlled truck",
        "Full packing included",
        "Professional crew",
        "Door-to-door service",
        "Furniture disassembly & reassembly",
        "Moving blankets & shrink wrap",
      ],
    } as TierResult,
    factors: {
      base_rate: Math.round(baseRate),
      distance_surcharge: distanceSurcharge,
      date_multiplier: dateMult.multiplier,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
    },
  };
}

// ═══════════════════════════════════════════════
// SINGLE ITEM — single price
// ═══════════════════════════════════════════════

async function calcSingleItem(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const { data: rate } = await sb
    .from("single_item_rates")
    .select("base_price_min, base_price_max")
    .eq("item_category", input.item_category ?? "standard_furniture")
    .single();

  const min = rate?.base_price_min ?? 199;
  const max = rate?.base_price_max ?? 349;
  let price = Math.round((min + max) / 2);

  const weight = (input.item_weight_class ?? "").toLowerCase();
  if (weight.includes("300") || weight === "over_300lbs" || weight === "300-500 lbs") price += 100;
  if (weight.includes("500") || weight === "over_500lbs" || weight === "Over 500 lbs") price += 200;

  const assemblyDis = cfgNum(config, "assembly_disassembly", 75);
  const assemblyAs = cfgNum(config, "assembly_assembly", 80);
  const assemblyBoth = cfgNum(config, "assembly_both", 140);
  const stairPerFlight = cfgNum(config, "stair_carry_per_flight", 50);

  const asm = (input.assembly_needed ?? "").toLowerCase();
  if (asm.includes("both") || asm === "Both") price += assemblyBoth;
  else if (asm.includes("disassembly") || asm.includes("dis")) price += assemblyDis;
  else if (asm.includes("assembly")) price += assemblyAs;

  if (input.stair_carry) price += stairPerFlight * (input.stair_flights ?? 1);

  const siDistBase = cfgNum(config, "single_item_distance_base", 15);
  const siDistRate = cfgNum(config, "single_item_distance_rate", 2);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > siDistBase ? Math.round((distKm - siDistBase) * siDistRate) : 0;
  price += distanceSurcharge;

  if (price < 150) price = 150;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "single_item", price);

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: [
        "Professional 2-person crew",
        "Blanket wrapping",
        "Secure transport",
        "Doorstep delivery",
      ],
    } as TierResult,
    factors: {
      base_rate: Math.round((min + max) / 2),
      distance_surcharge: distanceSurcharge,
    },
  };
}

// ═══════════════════════════════════════════════
// WHITE GLOVE — based on single item × 1.5
// ═══════════════════════════════════════════════

async function calcWhiteGlove(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const siResult = await calcSingleItem(sb, { ...input, assembly_needed: undefined }, config, distInfo, {
    total: 0,
    breakdown: [],
    byTierExclusion: new Map(),
  });

  let price = Math.round(siResult.custom_price.price * 1.5);

  if ((input.declared_value ?? 0) > 5000) price += 50;

  if (price < 250) price = 250;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "white_glove", price);

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: [
        "White glove premium handling",
        "Professional 2-person crew",
        "Full assembly included",
        "Photo documentation (before/during/after)",
        "Packaging removal",
        "Blanket & pad wrapping",
        "Secure climate transport",
      ],
    } as TierResult,
    factors: {
      base_rate: siResult.custom_price.price,
      white_glove_premium: 1.5,
      distance_surcharge: siResult.factors.distance_surcharge,
      enhanced_insurance: (input.declared_value ?? 0) > 5000 ? 50 : 0,
    },
  };
}

// ═══════════════════════════════════════════════
// SPECIALTY — project-type-based
// ═══════════════════════════════════════════════

const SPECIALTY_BASE: Record<string, number> = {
  art_installation: 800,
  "Art installation": 800,
  trade_show: 1200,
  "Trade show": 1200,
  estate_cleanout: 600,
  "Estate cleanout": 600,
  staging: 500,
  "Home staging": 500,
  wine_transport: 400,
  "Wine transport": 400,
  medical_equip: 800,
  "Medical equipment": 800,
  piano_move: 350,
  "Piano move": 350,
  event_setup: 600,
  "Event setup/teardown": 600,
  custom: 500,
  Custom: 500,
};

async function calcSpecialty(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const projectBase = SPECIALTY_BASE[input.project_type ?? "custom"] ?? 500;
  const hours = input.timeline_hours ?? 4;
  let price = Math.round(projectBase * (hours / 4));

  if (input.custom_crating_pieces && input.custom_crating_pieces > 0) {
    price += 300 * input.custom_crating_pieces;
  }
  if (input.climate_control) price += 150;

  const equipSurcharges: Record<string, number> = {
    "A-frame cart": 40,
    "Crating kit": 80,
    "Climate truck": 150,
    "Air-ride suspension": 120,
    "Lift gate": 100,
    Crane: 500,
    Custom: 200,
  };
  for (const eq of input.special_equipment ?? []) {
    price += equipSurcharges[eq] ?? 100;
  }

  if (price < 500) price = 500;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const deposit = await calculateDeposit(sb, "specialty", price);

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: [
        "Specialized handling crew",
        "Project-specific equipment",
        "Site assessment",
        "Insurance coverage",
      ],
    } as TierResult,
    factors: {
      project_base: projectBase,
      timeline_hours: hours,
      crating_surcharge: (input.custom_crating_pieces ?? 0) * 300,
      climate_surcharge: input.climate_control ? 150 : 0,
    },
  };
}

// ═══════════════════════════════════════════════
// B2B ONE-OFF — white glove base, no premium
// ═══════════════════════════════════════════════

async function calcB2bOneoff(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const wgResult = await calcWhiteGlove(sb, input, config, distInfo, {
    total: 0,
    breakdown: [],
    byTierExclusion: new Map(),
  });

  let price = wgResult.custom_price.price;

  price += addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);

  let deposit: number;
  if (price < 300) {
    deposit = price;
  } else {
    deposit = 100;
  }

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: wgResult.custom_price.includes,
    } as TierResult,
    factors: wgResult.factors,
  };
}

// ═══════════════════════════════════════════════
// MAIN POST HANDLER
// ═══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  let input: QuoteInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!input.service_type || !input.from_address || !input.to_address || !input.move_date) {
    return NextResponse.json(
      { error: "service_type, from_address, to_address, and move_date are required" },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const config = await loadConfig(sb);

  const [distInfo, neighbourhood, dateMult] = await Promise.all([
    getDistance(input.from_address, input.to_address),
    getNeighbourhood(sb, input.from_address),
    getDateMultiplier(sb, input.move_date),
  ]);

  // Pre-compute a rough base for percent-type add-ons (use base_rate as proxy)
  let roughBase = 1000;
  if (input.service_type === "local_move" || input.service_type === "long_distance") {
    const { data: br } = await sb
      .from("base_rates")
      .select("base_price")
      .eq("move_size", input.move_size ?? "2br")
      .single();
    roughBase = br?.base_price ?? 1199;
  }

  const addonResult = await calculateAddons(sb, input.selected_addons, roughBase);

  type FactorsObj = Record<string, unknown>;
  let tiers: Record<string, TierResult> | undefined;
  let custom_price: TierResult | undefined;
  let factors: FactorsObj = {};

  const svcType = input.service_type;

  switch (svcType) {
    case "local_move": {
      const res = await calcResidential(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
      tiers = res.tiers;
      factors = res.factors;
      break;
    }
    case "office_move": {
      const res = await calcOffice(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "long_distance": {
      const res = await calcLongDistance(sb, input, config, distInfo, neighbourhood, dateMult, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "single_item": {
      const res = await calcSingleItem(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "white_glove": {
      const res = await calcWhiteGlove(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "specialty": {
      const res = await calcSpecialty(sb, input, config, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    case "b2b_delivery":
    case "b2b_oneoff": {
      const res = await calcB2bOneoff(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown service_type: ${svcType}` }, { status: 400 });
  }

  const quoteId = await generateQuoteId(sb, input.hubspot_deal_id);

  const primaryPrice = tiers ? tiers.essentials.price : custom_price!.price;
  const depositAmount = tiers ? tiers.essentials.deposit : custom_price!.deposit;

  const { error: insertErr } = await sb.from("quotes").insert({
    quote_id: quoteId,
    hubspot_deal_id: input.hubspot_deal_id || null,
    contact_id: input.contact_id || null,
    service_type: svcType === "b2b_oneoff" ? "b2b_delivery" : svcType,
    status: "draft",
    from_address: input.from_address,
    from_access: input.from_access || null,
    from_postal: neighbourhood.postalPrefix || null,
    to_address: input.to_address,
    to_access: input.to_access || null,
    move_date: input.move_date,
    move_size: input.move_size || null,
    distance_km: distInfo?.distance_km ?? null,
    drive_time_min: distInfo?.drive_time_min ?? null,
    specialty_items: input.specialty_items ?? [],
    tiers: tiers ?? null,
    custom_price: custom_price?.price ?? null,
    deposit_amount: depositAmount,
    factors_applied: factors,
    selected_addons: addonResult.breakdown,
    expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const response: Record<string, unknown> = {
    quote_id: quoteId,
    quoteId, // camelCase alias for clients
    service_type: svcType,
    distance_km: distInfo?.distance_km ?? null,
    drive_time_min: distInfo?.drive_time_min ?? null,
    move_date: input.move_date,
    factors,
    addons: {
      items: addonResult.breakdown,
      total: addonResult.total,
    },
  };

  if (tiers) {
    response.tiers = tiers;
  } else {
    response.custom_price = custom_price;
    response.deposit_amount = primaryPrice;
  }

  return NextResponse.json(response);
}
