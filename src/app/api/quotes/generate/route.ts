import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

interface InventoryItem {
  slug?: string;
  name?: string;
  quantity: number;
  weight_score?: number; // For custom items not in item_weights
}

interface QuoteInput {
  /** When provided, update existing quote in place instead of creating a new one */
  quote_id?: string;
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
  inventory_items?: InventoryItem[];
  client_box_count?: number;
  // Office
  square_footage?: number;
  workstation_count?: number;
  has_it_equipment?: boolean;
  has_conference_room?: boolean;
  has_reception_area?: boolean;
  timing_preference?: string;
  // Single item / White glove
  item_description?: string;
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
  // Recommended tier (coordinator's manual selection)
  recommended_tier?: "essentials" | "premier" | "estate";
  // Client info (used to look up / create a contact)
  client_name?: string;
  client_email?: string;
  client_phone?: string;
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

/** Max numeric part we treat as "our" sequence (30001, 30002, ...). Larger = legacy HubSpot-style IDs we ignore. */
const QUOTE_ID_NUMERIC_MAX = 999_999;

async function generateQuoteId(sb: SupabaseAdmin): Promise<string> {
  const { data: prefixRow } = await sb
    .from("platform_config")
    .select("value")
    .eq("key", "quote_id_prefix")
    .maybeSingle();
  const prefix = (prefixRow?.value || "YG-").trim() || "YG-";
  const likePattern = prefix.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";

  const { data } = await sb
    .from("quotes")
    .select("quote_id")
    .like("quote_id", likePattern)
    .order("created_at", { ascending: false })
    .limit(100);

  let next = 30001;
  if (data && data.length > 0) {
    const nums = data
      .map((row) => {
        const id = row.quote_id || "";
        const numPart = id.startsWith(prefix) ? id.slice(prefix.length) : id;
        return parseInt(numPart, 10);
      })
      .filter((n) => !isNaN(n) && n <= QUOTE_ID_NUMERIC_MAX);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    if (max >= 30001) next = max + 1;
  }
  return `${prefix}${next}`;
}

// ═══════════════════════════════════════════════
// Rounding helper
// ═══════════════════════════════════════════════

function roundTo(amount: number, nearest: number): number {
  return Math.round(amount / nearest) * nearest;
}

// ═══════════════════════════════════════════════
// Tier includes — loaded from DB with hardcoded fallback
// ═══════════════════════════════════════════════

const DEFAULT_TRUCK_BY_SIZE: Record<string, string> = {
  studio: "16-ft truck",
  "1br": "16-ft truck",
  "2br": "20-ft truck",
  "3br": "20-ft truck",
  "4br": "26-ft truck",
  "5br_plus": "26-ft truck",
  office: "26-ft truck",
};

/** Fetch active features for a service_type+tier combo from the DB, ordered by display_order. */
async function fetchTierFeatures(
  sb: SupabaseAdmin,
  serviceType: string,
  tier: string,
): Promise<string[]> {
  const { data } = await sb
    .from("tier_features")
    .select("feature")
    .eq("service_type", serviceType)
    .eq("tier", tier)
    .eq("active", true)
    .order("display_order");
  if (data && data.length > 0) return data.map((r: { feature: string }) => r.feature);
  return [];
}

async function residentialIncludes(
  sb: SupabaseAdmin,
  minCrew: number,
  estHours: number,
  moveSize?: string,
): Promise<{ essentials: string[]; premier: string[]; estate: string[] }> {
  const truckLabel = DEFAULT_TRUCK_BY_SIZE[moveSize ?? "2br"] ?? "Dedicated moving truck";

  const [dbEss, dbPrem, dbEst] = await Promise.all([
    fetchTierFeatures(sb, "local_move", "essentials"),
    fetchTierFeatures(sb, "local_move", "premier"),
    fetchTierFeatures(sb, "local_move", "estate"),
  ]);

  // Replace generic placeholders with dynamic values when using DB features
  const hydrate = (list: string[]) =>
    list.map((f) => {
      if (f === "Dedicated moving truck") return truckLabel;
      if (f === "Professional movers") return `${minCrew} professional movers`;
      if (f === "Moving blankets") return f;
      return f;
    });

  if (dbEss.length > 0) {
    return {
      essentials: hydrate(dbEss),
      premier: hydrate(dbPrem.length > 0 ? dbPrem : dbEss),
      estate: hydrate(dbEst.length > 0 ? dbEst : dbPrem.length > 0 ? dbPrem : dbEss),
    };
  }

  // Hardcoded fallback
  const essentials = [
    truckLabel,
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
    "Premium gloves handling",
    "Dedicated move coordinator",
  ];
  return { essentials, premier, estate };
}

// ═══════════════════════════════════════════════
// Inventory volume modifier
// ═══════════════════════════════════════════════

/** Legacy slug → new slug map for quotes created before expand_inventory (85 items). */
const LEGACY_SLUG_MAP: Record<string, string> = {
  "bed-queen": "queen-bed-frame",
  "bed-king": "king-bed-frame",
  "bed-double": "double-bed-frame",
  "bed-single": "single-twin-bed-frame",
  sofa: "sofa-3-seater",
  loveseat: "sofa-2-seater-loveseat",
  sectional: "sectional-sofa",
  dresser: "dresser-large",
  wardrobe: "wardrobe-armoire",
  "dining-table": "dining-table-6-seater",
  "tv-stand": "tv-stand-entertainment-centre",
  bookshelf: "bookshelf-large",
  "desk-large": "office-desk-large",
  "desk-small": "office-desk-small",
  "accent-chair": "armchair-accent-chair",
  "side-table": "side-end-table",
  "lamp-floor": "floor-lamp",
  "lamp-table": "table-lamp",
  "tv-large": "tv-large-65",
  "tv-small": "tv-mounted-flat",
  ottoman: "ottoman-footstool",
  fridge: "refrigerator",
  "piano-grand": "piano-grand-baby-grand",
  "safe-light": "safe-vault",
  "safe-heavy": "safe-vault",
  mirror: "mirror-large-full-length",
  rug: "rug-large",
  "shoe-rack": "shoe-rack-storage",
  "small-table": "side-end-table",
  monitor: "computer-monitor",
};

async function getItemWeight(sb: SupabaseAdmin, slugOrName: string): Promise<number> {
  const trimmed = (slugOrName || "").trim();
  if (!trimmed) return 1.0;

  // Try exact slug first
  const { data } = await sb
    .from("item_weights")
    .select("weight_score")
    .eq("slug", trimmed)
    .single();
  if (data) return Number(data.weight_score);

  // Try legacy slug → new slug mapping (for old quotes)
  const mapped = LEGACY_SLUG_MAP[trimmed];
  if (mapped) {
    const { data: mappedData } = await sb
      .from("item_weights")
      .select("weight_score")
      .eq("slug", mapped)
      .single();
    if (mappedData) return Number(mappedData.weight_score);
  }

  // Fallback: fuzzy match by item_name (for custom items)
  const { data: byName } = await sb
    .from("item_weights")
    .select("weight_score")
    .ilike("item_name", `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`)
    .limit(1)
    .maybeSingle();
  if (byName) return Number(byName.weight_score);

  return 1.0;
}

async function calcInventoryModifier(
  sb: SupabaseAdmin,
  moveSize: string,
  inventoryItems: InventoryItem[],
  clientBoxCount?: number,
): Promise<{ modifier: number; inventoryScore: number; benchmarkScore: number; totalItems: number }> {
  const noAdj = { modifier: 1.0, inventoryScore: 0, benchmarkScore: 0, totalItems: 0 };
  if (!inventoryItems || inventoryItems.length === 0) return noAdj;

  const { data: bm } = await sb
    .from("volume_benchmarks")
    .select("*")
    .eq("move_size", moveSize)
    .single();
  if (!bm) return noAdj;

  let itemScore = 0;
  let totalItems = 0;
  for (const item of inventoryItems) {
    const weight =
      typeof item.weight_score === "number"
        ? item.weight_score
        : await getItemWeight(sb, item.slug || item.name || "");
    const qty = item.quantity || 1;
    itemScore += weight * qty;
    totalItems += qty;
  }

  const boxCount = clientBoxCount ?? Number(bm.assumed_boxes);
  const boxScore = boxCount * 0.3;
  const inventoryScore = itemScore + boxScore;
  const benchmarkScore = Number(bm.benchmark_score);

  if (totalItems < Number(bm.min_items_for_adjustment)) {
    return { modifier: 1.0, inventoryScore, benchmarkScore, totalItems };
  }

  let modifier = inventoryScore / benchmarkScore;
  modifier = Math.max(Number(bm.min_modifier), Math.min(Number(bm.max_modifier), modifier));
  modifier = Math.round(modifier * 100) / 100;

  return { modifier, inventoryScore, benchmarkScore, totalItems };
}

function estimateLabour(
  inventoryScore: number,
  distanceKm: number,
  fromAccess?: string,
  toAccess?: string,
): { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } {
  let crewSize = 2;
  if (inventoryScore > 30) crewSize = 3;
  if (inventoryScore > 70) crewSize = 4;
  if (inventoryScore > 110) crewSize = 5;

  const hardAccess = ["walk_up_3", "walk_up_4_plus", "walk_up_4plus"];
  if (fromAccess && hardAccess.includes(fromAccess)) crewSize += 1;
  if (toAccess && hardAccess.includes(toAccess)) crewSize += 1;
  crewSize = Math.min(crewSize, 6);

  const loadHours = inventoryScore / 15;
  const driveHours = distanceKm / 40;
  const unloadHours = loadHours * 0.8;
  let totalHours = loadHours + driveHours + unloadHours;
  totalHours = Math.max(2, Math.round(totalHours * 2) / 2);

  let truckSize = "16ft";
  if (inventoryScore > 25) truckSize = "20ft";
  if (inventoryScore > 50) truckSize = "24ft";
  if (inventoryScore > 75) truckSize = "26ft";
  if (inventoryScore > 90) truckSize = "26ft + trailer or 2 trucks";

  const lo = Math.max(2, totalHours - 0.5);
  const hi = totalHours + 1;

  return {
    crewSize,
    estimatedHours: totalHours,
    hoursRange: `${lo}–${hi} hours`,
    truckSize,
  };
}

// ═══════════════════════════════════════════════
// Truck allocation
// ═══════════════════════════════════════════════

interface TruckAllocation {
  primary: { vehicle_type: string; display_name: string; cargo_cubic_ft: number } | null;
  secondary: { vehicle_type: string; display_name: string; cargo_cubic_ft: number } | null;
  isMultiVehicle: boolean;
  notes: string | null;
  range: string;
}

function inventoryRange(modifier: number): string {
  if (modifier === 1.0) return "no_inventory";
  if (modifier <= 0.90) return "light";
  if (modifier <= 1.10) return "standard";
  return "heavy";
}

async function allocateTruck(
  sb: SupabaseAdmin,
  moveSize: string,
  invModifier: number,
): Promise<TruckAllocation> {
  const range = inventoryRange(invModifier);

  const { data: rule } = await sb
    .from("truck_allocation_rules")
    .select("primary_vehicle, secondary_vehicle, notes")
    .eq("move_size", moveSize)
    .eq("inventory_range", range)
    .maybeSingle();

  if (!rule) {
    return { primary: null, secondary: null, isMultiVehicle: false, notes: null, range };
  }

  const { data: primary } = await sb
    .from("fleet_vehicles")
    .select("vehicle_type, display_name, cargo_cubic_ft")
    .eq("vehicle_type", rule.primary_vehicle)
    .single();

  let secondary = null;
  if (rule.secondary_vehicle) {
    const { data: sec } = await sb
      .from("fleet_vehicles")
      .select("vehicle_type, display_name, cargo_cubic_ft")
      .eq("vehicle_type", rule.secondary_vehicle)
      .single();
    secondary = sec;
  }

  return {
    primary: primary ?? null,
    secondary,
    isMultiVehicle: !!secondary,
    notes: rule.notes,
    range,
  };
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
  invResult: { modifier: number; inventoryScore: number; benchmarkScore: number; totalItems: number },
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
  subtotal = Math.round(subtotal * invResult.modifier);
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

  const inc = await residentialIncludes(sb, minCrew, estHours, input.move_size);

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
    minCrew,
    estHours,
    factors: {
      base_rate: baseRate,
      distance_surcharge: distanceSurcharge,
      access_surcharge: accessSurcharge,
      date_multiplier: dateMult.multiplier,
      specialty_surcharge: specialtySurcharge,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
      inventory_modifier: invResult.modifier,
      inventory_score: invResult.inventoryScore,
      inventory_benchmark: invResult.benchmarkScore,
      inventory_items_count: invResult.totalItems,
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

  const officeFeatures = await fetchTierFeatures(sb, "office_move", "custom");
  const includes = officeFeatures.length > 0 ? [...officeFeatures] : [
    "Professional moving crew",
    "Moving truck(s) as needed",
    "Furniture disassembly & reassembly",
    "Floor & door frame protection",
    "Labeled crate system",
  ];
  if (input.has_it_equipment && !includes.includes("IT equipment handling"))
    includes.push("IT equipment handling");
  if (input.has_conference_room && !includes.includes("Conference room teardown & setup"))
    includes.push("Conference room teardown & setup");

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

  const ldIncludes = await fetchTierFeatures(sb, "long_distance", "custom");
  const longDistanceIncludes = ldIncludes.length > 0 ? ldIncludes : [
    "Climate-controlled truck",
    "Full packing included",
    "Professional crew",
    "Door-to-door service",
    "Furniture disassembly & reassembly",
    "Moving blankets & shrink wrap",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: longDistanceIncludes,
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

  const siFeatures = await fetchTierFeatures(sb, "single_item", "custom");
  const singleItemIncludes = siFeatures.length > 0 ? siFeatures : [
    "Professional 2-person crew",
    "Blanket wrapping",
    "Secure transport",
    "Doorstep delivery",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: singleItemIncludes,
    } as TierResult,
    factors: {
      base_rate: Math.round((min + max) / 2),
      distance_surcharge: distanceSurcharge,
      item_description: input.item_description || null,
      item_category: input.item_category || null,
      weight_class: input.item_weight_class || null,
      assembly_surcharge: asm ? (asm.includes("both") || asm === "Both" ? assemblyBoth : asm.includes("disassembly") || asm.includes("dis") ? assemblyDis : assemblyAs) : null,
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

  const wgFeatures = await fetchTierFeatures(sb, "white_glove", "custom");
  const whiteGloveIncludes = wgFeatures.length > 0 ? wgFeatures : [
    "Premium gloves handling",
    "Professional 2-person crew",
    "Full assembly included",
    "Photo documentation (before/during/after)",
    "Packaging removal",
    "Blanket & pad wrapping",
    "Secure climate transport",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: whiteGloveIncludes,
    } as TierResult,
    factors: {
      ...siResult.factors,
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
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const projectBase = SPECIALTY_BASE[input.project_type ?? "custom"] ?? 500;
  const hours = input.timeline_hours ?? 4;
  let price = Math.round(projectBase * (hours / 4));

  // Distance surcharge (same formula as residential)
  const distBaseKm = cfgNum(config, "distance_base_km", 30);
  const distRateKm = cfgNum(config, "distance_rate_per_km", 4.5);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > distBaseKm ? Math.round((distKm - distBaseKm) * distRateKm) : 0;
  price += distanceSurcharge;

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

  const spFeatures = await fetchTierFeatures(sb, "specialty", "custom");
  const specialtyIncludes = spFeatures.length > 0 ? spFeatures : [
    "Specialized handling crew",
    "Project-specific equipment",
    "Site assessment",
    "Insurance coverage",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: specialtyIncludes,
    } as TierResult,
    factors: {
      project_base: projectBase,
      timeline_hours: hours,
      distance_surcharge: distanceSurcharge,
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

  const b2bFeatures = await fetchTierFeatures(sb, "b2b_delivery", "custom");
  const b2bIncludes = b2bFeatures.length > 0 ? b2bFeatures : wgResult.custom_price.includes;

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: b2bIncludes,
    } as TierResult,
    factors: wgResult.factors,
  };
}

// ═══════════════════════════════════════════════
// MAIN POST HANDLER
// ═══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { user: authUser, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  // ?preview=true → run all pricing logic but skip the DB insert
  const isPreview = new URL(req.url).searchParams.get("preview") === "true";

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

  // Inventory volume modifier (residential / long distance only)
  const invResult = (input.service_type === "local_move" || input.service_type === "long_distance")
    ? await calcInventoryModifier(sb, input.move_size ?? "2br", input.inventory_items ?? [], input.client_box_count)
    : { modifier: 1.0, inventoryScore: 0, benchmarkScore: 0, totalItems: 0 };

  // Labour estimate (informational for coordinators)
  // When inventory is empty, derive from base_rates (move_size) so coordinators see sensible defaults
  let labour: { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null = null;
  if (invResult.inventoryScore > 0) {
    labour = estimateLabour(invResult.inventoryScore, distInfo?.distance_km ?? 0, input.from_access, input.to_access);
  } else if (input.service_type === "local_move" || input.service_type === "long_distance") {
    const { data: br } = await sb
      .from("base_rates")
      .select("min_crew, estimated_hours")
      .eq("move_size", input.move_size ?? "2br")
      .single();
    const minCrew = br?.min_crew ?? 2;
    const estHours = br?.estimated_hours ?? 3;
    const truckSize = DEFAULT_TRUCK_BY_SIZE[input.move_size ?? "2br"]?.replace("-ft truck", "ft") ?? "16ft";
    const lo = Math.max(2, Number(estHours) - 0.5);
    const hi = Number(estHours) + 1;
    labour = {
      crewSize: minCrew,
      estimatedHours: Number(estHours),
      hoursRange: `${lo}–${hi} hours`,
      truckSize,
    };
  }

  type FactorsObj = Record<string, unknown>;
  let tiers: Record<string, TierResult> | undefined;
  let custom_price: TierResult | undefined;
  let factors: FactorsObj = {};
  /** For local moves: crew/hours shown to client (from base_rates). Used so ops matches client. */
  let displayCrew: number | null = null;
  let displayHours: number | null = null;

  const svcType = input.service_type;

  // Truck allocation
  const truckMoveSize = (svcType === "single_item" || svcType === "white_glove")
    ? svcType
    : (input.move_size ?? "2br");
  const truckResult = await allocateTruck(sb, truckMoveSize, invResult.modifier);

  switch (svcType) {
    case "local_move": {
      const res = await calcResidential(sb, input, config, distInfo, neighbourhood, dateMult, addonResult, invResult);
      tiers = res.tiers;
      factors = res.factors;
      // Use labour (inventory-based or base_rates fallback) when available so quote shows correct crew/hours
      displayCrew = labour ? labour.crewSize : res.minCrew;
      displayHours = labour ? labour.estimatedHours : res.estHours;
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
      const res = await calcSpecialty(sb, input, config, distInfo, addonResult);
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

  const TRUCK_DISPLAY: Record<string, string> = {
    sprinter: "Extended Sprinter van",
    "16ft": "16ft climate-protected truck",
    "20ft": "20ft dedicated moving truck",
    "24ft": "24ft full-size moving truck",
    "26ft": "26ft maximum-capacity truck",
  };

  // Resolve truck line: from allocation when available, else from labour estimate so tier copy matches actual size
  const labourTruckKey = labour?.truckSize?.replace(/ \+ .*$/i, "")?.toLowerCase() ?? null;
  const fallbackTruckLine = labourTruckKey && TRUCK_DISPLAY[labourTruckKey]
    ? TRUCK_DISPLAY[labourTruckKey]
    : labour?.truckSize ?? "Dedicated moving truck";

  if (truckResult.primary && tiers) {
    const truckLine = truckResult.isMultiVehicle && truckResult.secondary
      ? `${TRUCK_DISPLAY[truckResult.primary.vehicle_type] || truckResult.primary.display_name} + support van`
      : TRUCK_DISPLAY[truckResult.primary.vehicle_type] || truckResult.primary.display_name;
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const idx = t.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter"));
      if (idx >= 0) t.includes[idx] = truckLine;
      else t.includes.unshift(truckLine);
    }
  } else if (tiers && fallbackTruckLine) {
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const idx = t.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter"));
      if (idx >= 0) t.includes[idx] = fallbackTruckLine;
      else t.includes.unshift(fallbackTruckLine);
    }
  }

  if (truckResult.primary && custom_price) {
    const truckLine = TRUCK_DISPLAY[truckResult.primary.vehicle_type] || truckResult.primary.display_name;
    const idx = custom_price.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter") || s.toLowerCase().includes("transport"));
    if (idx >= 0) custom_price.includes[idx] = truckLine;
    else custom_price.includes.unshift(truckLine);
  } else if (custom_price && fallbackTruckLine) {
    const idx = custom_price.includes.findIndex((s: string) => s.toLowerCase().includes("truck") || s.toLowerCase().includes("sprinter") || s.toLowerCase().includes("transport"));
    if (idx >= 0) custom_price.includes[idx] = fallbackTruckLine;
    else custom_price.includes.unshift(fallbackTruckLine);
  }

  // When labour exists (inventory-based or base_rates fallback), use it for tier includes so the public quote page shows crew/hours that match the estimate
  if (labour && tiers) {
    const crewLine = `${labour.crewSize} professional movers`;
    const hoursLine = `${Math.round(labour.estimatedHours)}-hour window`;
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const crewIdx = t.includes.findIndex((s: string) => s.toLowerCase().includes("professional movers"));
      if (crewIdx >= 0) t.includes[crewIdx] = crewLine;
      const hoursIdx = t.includes.findIndex((s: string) => s.toLowerCase().includes("-hour window"));
      if (hoursIdx >= 0) t.includes[hoursIdx] = hoursLine;
    }
  }

  // ── Valuation upgrades lookup ──
  const INCLUDED_VALUATION: Record<string, string> = {
    essentials: "released",
    premier: "enhanced",
    estate: "full_replacement",
  };
  const UPGRADE_PATHS: Record<string, string | null> = {
    essentials: "enhanced",
    premier: "full_replacement",
    estate: null,
  };
  const moveSize = input.move_size ?? "2br";
  const valuationUpgrades: Record<string, { price: number; to_tier: string; assumed_shipment_value: number } | null> = {};
  for (const pkg of ["essentials", "premier", "estate"]) {
    const target = UPGRADE_PATHS[pkg];
    if (!target) { valuationUpgrades[pkg] = null; continue; }
    const { data: vu } = await sb
      .from("valuation_upgrades")
      .select("price, to_tier, assumed_shipment_value")
      .eq("move_size", moveSize)
      .eq("from_package", pkg)
      .eq("to_tier", target)
      .eq("active", true)
      .maybeSingle();
    valuationUpgrades[pkg] = vu ?? null;
  }

  const { data: valTiers } = await sb
    .from("valuation_tiers")
    .select("tier_slug, display_name, rate_description, rate_per_pound, max_per_item, max_per_shipment, deductible, damage_process, covers, excludes, included_in_package")
    .eq("active", true)
    .order("tier_slug");

  const isUpdate = !isPreview && !!input.quote_id?.trim();
  let quoteId: string;
  if (isPreview) {
    quoteId = "PREVIEW";
  } else if (isUpdate) {
    const { data: existing } = await sb.from("quotes").select("quote_id").eq("quote_id", input.quote_id!.trim()).maybeSingle();
    quoteId = existing?.quote_id ?? (await generateQuoteId(sb));
  } else {
    quoteId = await generateQuoteId(sb);
  }

  const primaryPrice = tiers ? tiers.essentials.price : custom_price!.price;
  const depositAmount = tiers ? tiers.essentials.deposit : custom_price!.deposit;

  // Resolve contact: use provided contact_id, or look up / create from client info
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
    } else {
      const { data: created } = await sb
        .from("contacts")
        .insert({
          name: input.client_name?.trim() || null,
          email: input.client_email.trim().toLowerCase(),
          phone: input.client_phone?.trim() || null,
        })
        .select("id")
        .single();
      if (created) contactId = created.id;
    }
  }

  const expiryDays = cfgNum(config, "quote_expiry_days", 7);

  if (!isPreview) {
    const quotePayload = {
      hubspot_deal_id: input.hubspot_deal_id || null,
      contact_id: contactId,
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
      expires_at: new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
      inventory_items: input.inventory_items ?? [],
      inventory_score: invResult.inventoryScore || null,
      inventory_modifier: invResult.modifier !== 1.0 ? invResult.modifier : null,
      est_crew_size: displayCrew ?? labour?.crewSize ?? null,
      est_hours: displayHours ?? labour?.estimatedHours ?? null,
      est_truck_size: labour?.truckSize ?? null,
      truck_primary: truckResult.primary?.vehicle_type ?? (labourTruckKey && TRUCK_DISPLAY[labourTruckKey] ? labourTruckKey : null),
      truck_secondary: truckResult.secondary?.vehicle_type ?? null,
      recommended_tier: input.recommended_tier || "premier",
    };

    if (isUpdate) {
      const { error: updateErr } = await sb.from("quotes").update(quotePayload).eq("quote_id", quoteId);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await sb.from("quotes").insert({
        quote_id: quoteId,
        ...quotePayload,
      });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }
  }

  const expiresAtStr = new Date(Date.now() + expiryDays * 86_400_000).toISOString();

  const response: Record<string, unknown> = {
    quote_id: quoteId,
    quoteId,
    preview: isPreview,
    service_type: svcType,
    distance_km: distInfo?.distance_km ?? null,
    drive_time_min: distInfo?.drive_time_min ?? null,
    move_date: input.move_date,
    expires_at: expiresAtStr,
    factors,
    addons: {
      items: addonResult.breakdown,
      total: addonResult.total,
    },
    inventory: {
      modifier: invResult.modifier,
      score: invResult.inventoryScore,
      benchmark: invResult.benchmarkScore,
      totalItems: invResult.totalItems,
    },
    labour: labour ?? null,
    truck: {
      primary: truckResult.primary,
      secondary: truckResult.secondary,
      isMultiVehicle: truckResult.isMultiVehicle,
      notes: truckResult.notes,
      range: truckResult.range,
    },
  };

  if (tiers) {
    response.tiers = tiers;
  } else {
    response.custom_price = custom_price;
    response.deposit_amount = custom_price?.deposit ?? primaryPrice;
  }

  response.valuation = {
    included: INCLUDED_VALUATION,
    upgrades: valuationUpgrades,
    tiers: valTiers ?? [],
  };

  logAudit({
    userId: authUser?.id,
    userEmail: authUser?.email,
    action: "send_quote",
    resourceType: "quote",
    resourceId: response.quote_id as string | undefined,
    details: { service_type: input.service_type, preview: isPreview },
  });

  return NextResponse.json(response);
}
