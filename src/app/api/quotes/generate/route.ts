import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { validateInventoryQuantities } from "@/lib/inventory-quantity-validation";
import { estimateLabourFromScore } from "@/lib/inventory-labour";

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
  specialty_item_description?: string;
  specialty_dimensions?: string;
  specialty_requirements?: string[];
  specialty_notes?: string;
  // B2B One-Off
  delivery_type?: string;
  b2b_business_name?: string;
  b2b_items?: string[];
  b2b_weight_category?: string;
  b2b_special_instructions?: string;
  // Event (round-trip venue delivery)
  event_name?: string;
  event_return_date?: string;
  event_setup_required?: boolean;
  event_setup_hours?: number; // 1, 2, 3, or 99 = half-day
  event_setup_instructions?: string;
  event_same_day?: boolean;
  event_pickup_time_after?: string;
  event_additional_services?: string[];
  event_items?: { name: string; quantity: number; weight_category: "light" | "medium" | "heavy" }[];
  // Labour Only
  labour_crew_size?: number;
  labour_hours?: number;
  labour_truck_required?: boolean;
  labour_visits?: number;
  labour_second_visit_date?: string;
  labour_description?: string;
  // Recommended tier (coordinator's manual selection)
  recommended_tier?: "curated" | "signature" | "estate";
  // Custom crating (all service types)
  crating_pieces?: { description?: string; size: "small" | "medium" | "large" | "oversized" }[];
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

function cfgStr(config: Map<string, string>, key: string, fallback: string): string {
  return config.get(key) ?? fallback;
}

function parseJsonConfig<T>(config: Map<string, string>, key: string, fallback: T): T {
  try {
    const v = config.get(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
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

/** Yugo operations base — used for deadhead and return-trip calculations. */
const YUGO_BASE_ADDRESS = "507 King Street East, Toronto, ON";

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

/** Fallback day-of-week multipliers when date_factors has no row (weekend crew costs more). */
const DEFAULT_DAY_OF_WEEK_MULTIPLIER: Record<string, number> = {
  monday: 1.0,
  tuesday: 1.0,
  wednesday: 1.0,
  thursday: 1.0,
  friday: 1.05,
  saturday: 1.10,
  sunday: 1.10,
};

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

  const dayName = getDayName(moveDate);
  const dayMult = lookup.get(`day_of_week:${dayName}`) ?? DEFAULT_DAY_OF_WEEK_MULTIPLIER[dayName] ?? 1.0;
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
): Promise<{ curated: string[]; signature: string[]; estate: string[] }> {
  const truckLabel = DEFAULT_TRUCK_BY_SIZE[moveSize ?? "2br"] ?? "Dedicated moving truck";

  const [dbCur, dbSig, dbEst] = await Promise.all([
    fetchTierFeatures(sb, "local_move", "curated"),
    fetchTierFeatures(sb, "local_move", "signature"),
    fetchTierFeatures(sb, "local_move", "estate"),
  ]);

  const crewLine = `Professional crew of ${minCrew}`;
  const estateCrewLine = `White glove specialist crew of ${minCrew}`;
  const hydrate = (list: string[]) =>
    list.map((f) => {
      if (f === "Dedicated moving truck") return truckLabel;
      if (f.toLowerCase().includes("white glove specialist crew of")) return estateCrewLine;
      if (f === "Professional movers" || f.toLowerCase().includes("professional crew of")) return crewLine;
      if (f === "Moving blankets") return f;
      return f;
    });

  const estateSuppliesLine = "All packing supplies included (boxes, wrapping, protection materials)";
  if (dbCur.length > 0) {
    const estateList = hydrate(dbEst.length > 0 ? dbEst : dbSig.length > 0 ? dbSig : dbCur);
    if (!estateList.some((f) => f.toLowerCase().includes("packing supplies"))) estateList.push(estateSuppliesLine);
    return {
      curated: hydrate(dbCur),
      signature: hydrate(dbSig.length > 0 ? dbSig : dbCur),
      estate: estateList,
    };
  }

  // Hardcoded fallback — aligned with "Your Move Includes" (QuotePageClient)
  const curated = [
    truckLabel,
    crewLine,
    "Premium moving blankets",
    "Floor & doorway protection",
    "All equipment included",
    "Real-time GPS tracking",
    "Guaranteed flat price",
    "Zero-damage commitment",
  ];
  const signature = [
    truckLabel,
    crewLine,
    "Premium moving blankets",
    "Floor & doorway protection",
    "All equipment included",
    "Real-time GPS tracking",
    "Guaranteed flat price",
    "Zero-damage commitment",
    "Basic disassembly & reassembly",
    "Debris & packaging removal",
    "Room of choice placement",
  ];
  const estate = [
    truckLabel,
    crewLine,
    "Premium moving blankets",
    "Floor & doorway protection",
    "All equipment included",
    "Real-time GPS tracking",
    "Guaranteed flat price",
    "Zero-damage commitment",
    "Basic disassembly & reassembly",
    "Debris & packaging removal",
    "All packing supplies included (boxes, wrapping, protection materials)",
    "Pre-move inventory walkthrough",
    "White glove item handling & precision placement",
    "Dedicated move coordinator",
    "30 day concierge support",
    "Exclusive partner offers & perks",
  ];
  return { curated, signature, estate };
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
  /** Override floor from platform_config (inventory_modifier_floor). Falls back to bm.min_modifier. */
  modifierFloor?: number,
  /** Override cap from platform_config (inventory_modifier_cap). Falls back to bm.max_modifier. */
  modifierCap?: number,
): Promise<{ modifier: number; inventoryScore: number; benchmarkScore: number; totalItems: number; maxModifier?: number; boxCount?: number }> {
  const noAdj = { modifier: 1.0, inventoryScore: 0, benchmarkScore: 0, totalItems: 0, maxModifier: undefined };
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
    return { modifier: 1.0, inventoryScore, benchmarkScore, totalItems, maxModifier: Number(bm.max_modifier) };
  }

  let modifier = inventoryScore / benchmarkScore;
  // Section 1: use config floor (default 0.65) — light moves get up to 35% discount
  const floor = modifierFloor ?? Number(bm.min_modifier);
  const maxMod = modifierCap ?? Number(bm.max_modifier);
  modifier = Math.max(floor, Math.min(maxMod, modifier));
  modifier = Math.round(modifier * 100) / 100;

  return { modifier, inventoryScore, benchmarkScore, totalItems, maxModifier: maxMod, boxCount };
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

type LabourEstimate = { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null;

async function calcResidential(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  neighbourhood: { tier: string | null; multiplier: number },
  dateMult: { multiplier: number },
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
  invResult: { modifier: number; inventoryScore: number; benchmarkScore: number; totalItems: number },
  labour: LabourEstimate,
  deadheadInfo: { distance_km: number; drive_time_min: number } | null,
  returnInfo: { distance_km: number; drive_time_min: number } | null,
) {
  const { data: br } = await sb
    .from("base_rates")
    .select("base_price, min_crew, estimated_hours")
    .eq("move_size", input.move_size ?? "2br")
    .single();

  const baseRate = br?.base_price ?? 1199;
  const minCrew = br?.min_crew ?? 3;
  const estHours = br?.estimated_hours ?? 5;

  // ── Section 4A/4B: Distance modifier (replaces flat per-km surcharge) ──────
  const distKm = distInfo?.distance_km ?? 0;
  let distanceModifier = 1.0;

  // Read thresholds from config (with hardcoded fallbacks)
  const distUltraShortKm  = cfgNum(config, "dist_ultra_short_km",  2);
  const distShortKm        = cfgNum(config, "dist_short_km",        5);
  const distBaselineKm     = cfgNum(config, "dist_baseline_km",     20);
  const distMediumKm       = cfgNum(config, "dist_medium_km",       40);
  const distLongKm         = cfgNum(config, "dist_long_km",         60);
  const distVeryLongKm     = cfgNum(config, "dist_very_long_km",    100);

  const distModUltraShort  = cfgNum(config, "dist_mod_ultra_short", 0.92);
  const distModShort       = cfgNum(config, "dist_mod_short",       0.95);
  const distModMedium      = cfgNum(config, "dist_mod_medium",      1.08);
  const distModLong        = cfgNum(config, "dist_mod_long",        1.15);
  const distModVeryLong    = cfgNum(config, "dist_mod_very_long",   1.25);
  const distModExtreme     = cfgNum(config, "dist_mod_extreme",     1.35);

  if (distKm <= distUltraShortKm) {
    distanceModifier = distModUltraShort;  // 8% discount for ultra-short (≤2 km)
  } else if (distKm <= distShortKm) {
    distanceModifier = distModShort;       // 5% discount for short (≤5 km)
  } else if (distKm <= distBaselineKm) {
    distanceModifier = 1.0;               // baseline (≤20 km)
  } else if (distKm <= distMediumKm) {
    distanceModifier = distModMedium;      // 8% surcharge (≤40 km)
  } else if (distKm <= distLongKm) {
    distanceModifier = distModLong;        // 15% surcharge (≤60 km)
  } else if (distKm <= distVeryLongKm) {
    distanceModifier = distModVeryLong;    // 25% surcharge (≤100 km)
  } else {
    distanceModifier = distModExtreme;     // 35% surcharge (>100 km)
  }

  // ── Access + specialty surcharges (flat — not multiplied by tier) ──────────
  const [fromAccess, toAccess] = await Promise.all([
    getAccessSurcharge(sb, input.from_access),
    getAccessSurcharge(sb, input.to_access),
  ]);
  const accessSurcharge = fromAccess + toAccess;

  const specialtySurcharge = await getSpecialtySurcharge(sb, input.specialty_items ?? []);

  // ── Section 4A-B: New multiplicative formula ──────────────────────────────
  // subtotal = baseRate × invModifier × distModifier × dateFactor × neighbourhoodMult
  // Access and specialty added FLAT after (not scaled by tier multiplier)
  let subtotal = baseRate;
  subtotal = Math.round(subtotal * invResult.modifier);
  subtotal = Math.round(subtotal * distanceModifier);
  subtotal = Math.round(subtotal * dateMult.multiplier);
  subtotal = Math.round(subtotal * neighbourhood.multiplier);
  // Add flat surcharges AFTER multiplicative chain
  subtotal += accessSurcharge + specialtySurcharge;

  // ── Labour delta (Section 3): extra man-hours above baseline, floored at 0 ─
  const labourRate = cfgNum(config, "labour_rate_per_mover_hour", 45);
  let labourDelta = 0;
  let benchmark: { baseline_crew: number; baseline_hours: number } | null = null;
  if (labour && labour.crewSize > 0 && labour.estimatedHours > 0) {
    const { data: bm } = await sb
      .from("volume_benchmarks")
      .select("baseline_crew, baseline_hours")
      .eq("move_size", input.move_size ?? "2br")
      .single();
    if (bm && typeof bm.baseline_crew === "number" && typeof bm.baseline_hours === "number") {
      benchmark = { baseline_crew: bm.baseline_crew, baseline_hours: bm.baseline_hours };
      const baselineManHours = bm.baseline_crew * bm.baseline_hours;
      const actualManHours = labour.crewSize * labour.estimatedHours;
      // Section 3: floor at 0 — light moves get cheaper price through inventory modifier, not negative labour delta
      labourDelta = Math.max(0, Math.round((actualManHours - baselineManHours) * labourRate));
    }
  }

  // ── Section 4D: Deadhead surcharge (flat addition, not tier-multiplied) ────
  const deadheadFreeKm = cfgNum(config, "deadhead_free_km", 15);
  const deadheadPerKm  = cfgNum(config, "deadhead_per_km",  2.50);
  const deadheadKm     = deadheadInfo?.distance_km ?? 0;
  const deadheadSurcharge = deadheadKm > deadheadFreeKm
    ? Math.round((deadheadKm - deadheadFreeKm) * deadheadPerKm)
    : 0;

  const rounding = cfgNum(config, "rounding_nearest", 50);
  const minJob = cfgNum(config, "minimum_job_amount", 549);
  // Support both old and new config key names during transition
  const curatedMult = cfgNum(config, "tier_curated_multiplier",
    cfgNum(config, "tier_essentials_multiplier", 1.0));
  const signatureMult = cfgNum(config, "tier_signature_multiplier",
    cfgNum(config, "tier_premier_multiplier", 1.50));
  const estateMult = cfgNum(config, "tier_estate_multiplier", 3.15);
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);

  // Tier base = round(subtotal × multiplier) + labourDelta + deadheadSurcharge (both flat, not tier-scaled)
  let curBase = roundTo(subtotal * curatedMult, rounding) + labourDelta + deadheadSurcharge;
  let sigBase = roundTo(subtotal * signatureMult, rounding) + labourDelta + deadheadSurcharge;
  let estBase = roundTo(subtotal * estateMult, rounding) + labourDelta + deadheadSurcharge;

  // Estate-only: packing supplies allowance — lookup by move size from config JSON.
  const suppliesBySize = parseJsonConfig<Record<string, number>>(config, "estate_supplies_by_size", {});
  const SUPPLIES_FALLBACK: Record<string, number> = {
    studio: 250, "1br": 300, "2br": 375, "3br": 575, "4br": 850, "5br_plus": 1100, partial: 150,
  };
  const estateSuppliesAllowance = suppliesBySize[input.move_size ?? "2br"]
    ?? SUPPLIES_FALLBACK[input.move_size ?? "2br"]
    ?? 375;
  estBase += estateSuppliesAllowance;

  // Custom crating — applies to ALL tiers (coordinator-selected per quote).
  const cratingBySize = parseJsonConfig<Record<string, number>>(config, "crating_prices", {});
  const CRATING_FALLBACK: Record<string, number> = { small: 175, medium: 250, large: 350, oversized: 500 };
  let cratingTotal = 0;
  if (input.crating_pieces && input.crating_pieces.length > 0) {
    for (const piece of input.crating_pieces) {
      cratingTotal += cratingBySize[piece.size] ?? CRATING_FALLBACK[piece.size] ?? 250;
    }
  }
  curBase += cratingTotal;
  sigBase += cratingTotal;
  estBase += cratingTotal;

  if (curBase < minJob) curBase = minJob;
  if (sigBase < curBase) sigBase = curBase;
  if (estBase < sigBase) estBase = sigBase;

  const addonForCur = addonResult.total - (addonResult.byTierExclusion.get("curated") ?? (addonResult.byTierExclusion.get("essentials") ?? 0));
  const addonForSig = addonResult.total - (addonResult.byTierExclusion.get("signature") ?? (addonResult.byTierExclusion.get("premier") ?? 0));
  const addonForEst = addonResult.total - (addonResult.byTierExclusion.get("estate") ?? 0);

  const curPrice = curBase + addonForCur;
  const sigPrice = sigBase + addonForSig;
  const estPrice = estBase + addonForEst;

  const curTax = Math.round(curPrice * taxRate);
  const sigTax = Math.round(sigPrice * taxRate);
  const estTax = Math.round(estPrice * taxRate);

  // Tiered deposits from platform_config (Residential tier-based rules)
  const curPct = cfgNum(config, "deposit_curated_pct", 10);
  const curMin = cfgNum(config, "deposit_curated_min", 150);
  const sigPct = cfgNum(config, "deposit_signature_pct", 15);
  const sigMin = cfgNum(config, "deposit_signature_min", 250);
  const estPct = cfgNum(config, "deposit_estate_pct", 25);
  const estMin = cfgNum(config, "deposit_estate_min", 500);
  const curDep = Math.max(curMin, Math.round(curPrice * curPct / 100));
  const sigDep = Math.max(sigMin, Math.round(sigPrice * sigPct / 100));
  const estDep = Math.max(estMin, Math.round(estPrice * estPct / 100));

  const inc = await residentialIncludes(sb, minCrew, estHours, input.move_size);

  const tiers = {
    curated: {
      price: curPrice,
      deposit: curDep,
      tax: curTax,
      total: curPrice + curTax,
      includes: inc.curated,
    } as TierResult,
    signature: {
      price: sigPrice,
      deposit: sigDep,
      tax: sigTax,
      total: sigPrice + sigTax,
      includes: inc.signature,
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
      inventory_modifier: invResult.modifier,
      distance_modifier: distanceModifier,
      date_multiplier: dateMult.multiplier,
      neighbourhood_multiplier: neighbourhood.multiplier,
      neighbourhood_tier: neighbourhood.tier,
      access_surcharge: accessSurcharge,
      specialty_surcharge: specialtySurcharge,
      labour_delta: labourDelta,
      labour_component: labourDelta,
      deadhead_surcharge: deadheadSurcharge,
      deadhead_km: deadheadKm,
      return_km: returnInfo?.distance_km ?? 0,
      inventory_score: invResult.inventoryScore,
      inventory_benchmark: invResult.benchmarkScore,
      inventory_items_count: invResult.totalItems,
      labour_actual_crew: labour?.crewSize ?? null,
      labour_actual_hours: labour?.estimatedHours ?? null,
      labour_baseline_crew: benchmark?.baseline_crew ?? null,
      labour_baseline_hours: benchmark?.baseline_hours ?? null,
      labour_rate: labourRate,
      labour_rate_per_mover_hour: labourRate,
      labour_extra_man_hours:
        labour && benchmark
          ? Math.max(0, labour.crewSize * labour.estimatedHours - benchmark.baseline_crew * benchmark.baseline_hours)
          : null,
      inventory_max_modifier: (invResult as { modifier: number; inventoryScore: number; benchmarkScore: number; totalItems: number; maxModifier?: number }).maxModifier ?? null,
      subtotal_before_labour: subtotal - accessSurcharge - specialtySurcharge,
      packing_supplies_included: estateSuppliesAllowance,
      crating_total: cratingTotal,
      crating_pieces_count: input.crating_pieces?.length ?? 0,
    },
    cratingTotal,
    estateSuppliesAllowance,
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
    "Basic disassembly & reassembly",
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
    "Basic disassembly & reassembly",
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
  // New specialty type keys (from redesigned form)
  piano_upright:   600,
  piano_grand:     1400,
  art_sculpture:   900,
  antiques_estate: 1750,
  safe_vault:      800,
  pool_table:      1050,
  hot_tub:         1400,
  wine_collection: 950,
  aquarium:        1000,
  trade_show:      1250,
  medical_lab:     1550,
  other:           500,
  // Legacy keys (backward compat)
  art_installation: 800,
  "Art installation": 800,
  "Trade show": 1200,
  estate_cleanout: 600,
  "Estate cleanout": 600,
  staging: 500,
  "Home staging": 500,
  wine_transport: 400,
  "Wine transport": 400,
  medical_equip: 800,
  "Medical equipment": 800,
  piano_move: 600,
  "Piano move": 600,
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
    crane_rigging: 750,
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
// B2B ONE-OFF — base + distance modifier + access + weight surcharges
// ═══════════════════════════════════════════════

function getDistanceModifier(config: Map<string, string>, distKm: number): number {
  const distUltraShortKm = cfgNum(config, "dist_ultra_short_km", 2);
  const distShortKm = cfgNum(config, "dist_short_km", 5);
  const distBaselineKm = cfgNum(config, "dist_baseline_km", 20);
  const distMediumKm = cfgNum(config, "dist_medium_km", 40);
  const distLongKm = cfgNum(config, "dist_long_km", 60);
  const distVeryLongKm = cfgNum(config, "dist_very_long_km", 100);
  const distModUltraShort = cfgNum(config, "dist_mod_ultra_short", 0.92);
  const distModShort = cfgNum(config, "dist_mod_short", 0.95);
  const distModMedium = cfgNum(config, "dist_mod_medium", 1.08);
  const distModLong = cfgNum(config, "dist_mod_long", 1.15);
  const distModVeryLong = cfgNum(config, "dist_mod_very_long", 1.25);
  const distModExtreme = cfgNum(config, "dist_mod_extreme", 1.35);
  if (distKm <= distUltraShortKm) return distModUltraShort;
  if (distKm <= distShortKm) return distModShort;
  if (distKm <= distBaselineKm) return 1.0;
  if (distKm <= distMediumKm) return distModMedium;
  if (distKm <= distLongKm) return distModLong;
  if (distKm <= distVeryLongKm) return distModVeryLong;
  return distModExtreme;
}

async function calcB2bOneoff(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const baseFee = cfgNum(config, "b2b_oneoff_base", 350);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceModifier = getDistanceModifier(config, distKm);

  const accessMap = parseJsonConfig<Record<string, number>>(config, "b2b_access_surcharges", {});
  const weightMap = parseJsonConfig<Record<string, number>>(config, "b2b_weight_surcharges", {});
  const accessKey = (k: string | undefined): string => (k === "no_parking_nearby" ? "no_parking" : (k ?? ""));
  const fromAccess = input.from_access ? (accessMap[accessKey(input.from_access)] ?? 0) : 0;
  const toAccess = input.to_access ? (accessMap[accessKey(input.to_access)] ?? 0) : 0;
  const accessSurcharge = fromAccess + toAccess;

  const weightCategory = input.b2b_weight_category || "standard";
  const weightSurcharge = weightMap[weightCategory] ?? 0;

  let price = Math.round(baseFee * distanceModifier) + accessSurcharge + weightSurcharge;
  const rounding = cfgNum(config, "rounding_nearest", 50);
  price = roundTo(price, rounding);
  if (price < 200) price = 200;

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
  const b2bIncludes = b2bFeatures.length > 0 ? b2bFeatures : [
    "Professional crew",
    "Loading and unloading",
    "Basic protection",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total: price + tax,
      includes: b2bIncludes,
    } as TierResult,
    factors: {
      base_fee: baseFee,
      distance_modifier: distanceModifier,
      distance_km: distKm,
      access_surcharge: accessSurcharge,
      weight_surcharge: weightSurcharge,
      weight_category: weightCategory,
      b2b_business_name: input.b2b_business_name || null,
      b2b_items: input.b2b_items || null,
    },
  };
}

// ═══════════════════════════════════════════════
// EVENT — round-trip delivery + optional setup
// ═══════════════════════════════════════════════

const EVENT_WEIGHT_MAP: Record<string, number> = { light: 0.5, medium: 2.0, heavy: 5.0 };

async function calcEvent(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  distInfo: { distance_km: number; drive_time_min: number } | null,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  // Build inventory-style score from event items
  let eventScore = 0;
  for (const item of input.event_items ?? []) {
    const w = EVENT_WEIGHT_MAP[item.weight_category] ?? 2.0;
    eventScore += w * (item.quantity || 1);
  }

  const distBaseKm = cfgNum(config, "dist_baseline_km", cfgNum(config, "distance_base_km", 30));
  const distRateKm = cfgNum(config, "distance_rate_per_km", 4.5);
  const distKm = distInfo?.distance_km ?? 0;
  const distanceSurcharge = distKm > distBaseKm ? Math.round((distKm - distBaseKm) * distRateKm) : 0;

  // Labour estimate from event items
  const labour = eventScore > 0
    ? estimateLabourFromScore(eventScore, distKm, input.from_access, input.to_access, "2br", {
        driveTimeMinutes: distInfo?.drive_time_min,
      })
    : { crewSize: 2, estimatedHours: 3, hoursRange: "2.5–4 hours", truckSize: "20ft" };

  // Delivery charge: crew × hours × labour rate + distance surcharge
  const labourRate = cfgNum(config, "labour_rate_per_mover_hour", 45);
  const rounding = cfgNum(config, "rounding_nearest", 50);
  let deliveryCharge = Math.round(labour.crewSize * labour.estimatedHours * labourRate * 1.4); // 1.4 ops overhead factor
  deliveryCharge += distanceSurcharge;
  deliveryCharge = roundTo(deliveryCharge, rounding);
  if (deliveryCharge < 350) deliveryCharge = 350;

  // Return charge (simpler: items already inventoried, no re-wrap)
  const returnDiscount = cfgNum(config, "event_return_discount", 0.65);
  const returnCharge = roundTo(Math.round(deliveryCharge * returnDiscount), rounding);
  const returnHours = Math.ceil(labour.estimatedHours * returnDiscount);

  // Setup fee
  let setupFee = 0;
  let setupLabel = "";
  if (input.event_setup_required) {
    const sh = input.event_setup_hours ?? 2;
    const setupPrices: Record<number, number> = {
      1:  cfgNum(config, "event_setup_fee_1hr",     150),
      2:  cfgNum(config, "event_setup_fee_2hr",     275),
      3:  cfgNum(config, "event_setup_fee_3hr",     400),
      99: cfgNum(config, "event_setup_fee_halfday", 600),
    };
    setupFee = setupPrices[sh] ?? setupPrices[2];
    setupLabel = sh === 99 ? "Half-day setup" : `${sh}hr setup`;
  }

  let price = deliveryCharge + returnCharge + setupFee + addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const total = price + tax;
  const deposit = Math.max(150, Math.round(total * 0.25));

  const eventIncludes = [
    `Delivery (${input.move_date ?? "TBD"}): ${labour.crewSize} movers, ${labour.estimatedHours}hr`,
    ...(input.event_setup_required ? [`Setup service: ${setupLabel}`] : []),
    `Return (${input.event_return_date ?? "TBD"}): same crew, ~${returnHours}hr`,
    "Round-trip — same crew knows the layout",
    "All items inventoried and protected",
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total,
      includes: eventIncludes,
    } as TierResult,
    factors: {
      event_name: input.event_name || null,
      delivery_date: input.move_date || null,
      return_date: input.event_return_date || null,
      delivery_charge: deliveryCharge,
      return_charge: returnCharge,
      return_discount: returnDiscount,
      setup_fee: setupFee,
      setup_label: setupLabel || null,
      distance_surcharge: distanceSurcharge,
      event_crew: labour.crewSize,
      event_hours: labour.estimatedHours,
      same_day: input.event_same_day ?? false,
    },
    labour,
  };
}

// ═══════════════════════════════════════════════
// LABOUR ONLY — crew at one location, no transit
// ═══════════════════════════════════════════════

async function calcLabourOnly(
  sb: SupabaseAdmin,
  input: QuoteInput,
  config: Map<string, string>,
  addonResult: Awaited<ReturnType<typeof calculateAddons>>,
) {
  const labourRate = cfgNum(config, "labour_only_rate", 85);
  const crewSize = input.labour_crew_size ?? 2;
  const hours = input.labour_hours ?? 3;
  const truckFee = input.labour_truck_required ? cfgNum(config, "labour_only_truck_fee", 150) : 0;
  const accessSurcharge = await getAccessSurcharge(sb, input.from_access);
  const rounding = cfgNum(config, "rounding_nearest", 50);

  const basePrice = crewSize * hours * labourRate;
  let visit1Price = roundTo(basePrice + truckFee + accessSurcharge, rounding);

  const visit2Discount = cfgNum(config, "labour_only_visit2_discount", 0.85);
  let visit2Price = 0;
  if ((input.labour_visits ?? 1) >= 2) {
    visit2Price = roundTo(Math.round(basePrice * visit2Discount) + truckFee + accessSurcharge, rounding);
  }

  let price = visit1Price + visit2Price + addonResult.total;
  const taxRate = cfgNum(config, "tax_rate", TAX_RATE_FALLBACK);
  const tax = Math.round(price * taxRate);
  const total = price + tax;
  const deposit = Math.max(100, Math.round(total * 0.25));

  const labourIncludes = [
    `${crewSize} movers × ${hours} hours`,
    `Labour rate: $${labourRate}/mover/hr`,
    input.labour_truck_required ? `Truck included (+$${truckFee})` : "No truck required (crew arrives in van)",
    ...(accessSurcharge > 0 ? [`Access surcharge: $${accessSurcharge}`] : []),
    ...((input.labour_visits ?? 1) >= 2
      ? [`Visit 1 (${input.move_date ?? "TBD"}): $${visit1Price}`, `Visit 2 (${input.labour_second_visit_date ?? "TBD"}): $${visit2Price} (return visit discount)`]
      : []),
  ];

  return {
    custom_price: {
      price,
      deposit,
      tax,
      total,
      includes: labourIncludes,
    } as TierResult,
    factors: {
      crew_size: crewSize,
      hours,
      labour_rate: labourRate,
      base_price: basePrice,
      truck_fee: truckFee,
      access_surcharge: accessSurcharge,
      visits: input.labour_visits ?? 1,
      visit1_price: visit1Price,
      visit2_price: visit2Price,
      visit2_date: input.labour_second_visit_date || null,
      labour_description: input.labour_description || null,
    },
    labour: {
      crewSize,
      estimatedHours: hours,
      hoursRange: `${hours}hr`,
      truckSize: input.labour_truck_required ? "20ft" : "Van",
    },
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

  // Labour-only: to_address may equal from_address (work at one location)
  const effectiveToAddress = input.to_address || (input.service_type === "labour_only" ? input.from_address : undefined);
  if (!input.service_type || !input.from_address || !effectiveToAddress || !input.move_date) {
    return NextResponse.json(
      { error: "service_type, from_address, to_address (or work_address for labour_only), and move_date are required" },
      { status: 400 },
    );
  }
  if (!input.to_address && input.service_type === "labour_only") {
    input = { ...input, to_address: input.from_address };
  }

  const sb = createAdminClient();
  const config = await loadConfig(sb);

  // Section 5: Batch all Mapbox distance calls (job route + deadhead + return trip)
  const isResidential = input.service_type === "local_move" || input.service_type === "long_distance";
  const [distInfo, neighbourhood, dateMult, deadheadInfo, returnInfo] = await Promise.all([
    getDistance(input.from_address, input.to_address),
    getNeighbourhood(sb, input.from_address),
    getDateMultiplier(sb, input.move_date),
    // Section 4D: Yugo base → pickup (deadhead)
    isResidential ? getDistance(YUGO_BASE_ADDRESS, input.from_address) : Promise.resolve(null),
    // Section 4E: drop-off → Yugo base (return trip)
    isResidential ? getDistance(input.to_address, YUGO_BASE_ADDRESS) : Promise.resolve(null),
  ]);

  // Pre-compute a rough base for percent-type add-ons (use base_rate as proxy)
  let roughBase = 1000;
  if (isResidential) {
    const { data: br } = await sb
      .from("base_rates")
      .select("base_price")
      .eq("move_size", input.move_size ?? "2br")
      .single();
    roughBase = br?.base_price ?? 1199;
  }

  const addonResult = await calculateAddons(sb, input.selected_addons, roughBase);

  // Section 1: Inventory modifier floor/cap from platform_config (default 0.65 floor, 1.50 cap)
  const invModFloor = cfgNum(config, "inventory_modifier_floor", 0.65);
  const invModCap   = cfgNum(config, "inventory_modifier_cap",   1.50);

  // Inventory volume modifier (residential / long distance only)
  const invResult = isResidential
    ? await calcInventoryModifier(sb, input.move_size ?? "2br", input.inventory_items ?? [], input.client_box_count, invModFloor, invModCap)
    : { modifier: 1.0, inventoryScore: 0, benchmarkScore: 0, totalItems: 0, maxModifier: undefined };

  // FIX 1: Inventory quantity sanity — flag for coordinator review (don't block quote)
  const inventoryWarnings = validateInventoryQuantities(input.inventory_items ?? []);

  // FIX 3: Specialty items affect crew/hours (boost score for labour estimate only; pricing uses original modifier)
  const SPECIALTY_CREW_IMPACT: Record<string, number> = {
    piano_upright: 15,
    piano_grand: 25,
    pool_table: 20,
    safe_under_300: 10,
    safe_over_300: 20,
    safe_under_300lbs: 10,
    safe_over_300lbs: 20,
    hot_tub: 25,
    motorcycle: 15,
    gym_equipment_per_piece: 5,
    gym_equipment: 5,
    artwork_per_piece: 3,
    antique_per_piece: 5,
    wine_collection: 5,
    aquarium: 15,
  };
  // Labour estimate uses lower box weight (0.15): boxes move in batches on dollies, not individually; modifier still uses 0.3 for volume.
  const boxCount = (invResult as { boxCount?: number }).boxCount ?? 0;
  const labourBaseScore = invResult.inventoryScore - boxCount * 0.15;
  let adjustedScore = labourBaseScore;
  if (input.specialty_items && input.specialty_items.length > 0) {
    for (const item of input.specialty_items) {
      const impact = SPECIALTY_CREW_IMPACT[item.type] ?? 5;
      adjustedScore += impact * (item.qty || 1);
    }
  }

  // Labour estimate (informational for coordinators); uses adjusted score so specialty items increase crew/hours
  // Section 4C: pass drive_time_min (actual minutes × 2.5) instead of distanceKm
  // Section 4E: pass return info for long drop-offs
  // Section 2: pass specialty items directly so crew is correctly sized
  let labour: { crewSize: number; estimatedHours: number; hoursRange: string; truckSize: string } | null = null;
  if (adjustedScore > 0) {
    labour = estimateLabourFromScore(
      adjustedScore,
      distInfo?.distance_km ?? 0,
      input.from_access,
      input.to_access,
      input.move_size ?? "2br",
      {
        driveTimeMinutes: distInfo?.drive_time_min,
        specialtyItems: input.specialty_items,
        dropoffToBaseKm: returnInfo?.distance_km,
        returnDriveMinutes: returnInfo?.drive_time_min,
      },
    );
  } else if (isResidential) {
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

  // Global crating calculation (applies to all service types)
  const cratingBySize = parseJsonConfig<Record<string, number>>(config, "crating_prices", {});
  const CRATING_PRICE_FALLBACK: Record<string, number> = { small: 175, medium: 250, large: 350, oversized: 500 };
  let globalCratingTotal = 0;
  if (input.crating_pieces && input.crating_pieces.length > 0) {
    for (const piece of input.crating_pieces) {
      globalCratingTotal += cratingBySize[piece.size] ?? CRATING_PRICE_FALLBACK[piece.size] ?? 250;
    }
  }

  type FactorsObj = Record<string, unknown>;
  let tiers: Record<string, TierResult> | undefined;
  let custom_price: TierResult | undefined;
  let factors: FactorsObj = {};
  let residentialCratingTotal = 0;
  let estateSuppliesAllowance = 0;
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
      const res = await calcResidential(sb, input, config, distInfo, neighbourhood, dateMult, addonResult, invResult, labour, deadheadInfo, returnInfo);
      tiers = res.tiers;
      factors = res.factors;
      residentialCratingTotal = res.cratingTotal;
      estateSuppliesAllowance = res.estateSuppliesAllowance;
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
    case "event": {
      const res = await calcEvent(sb, input, config, distInfo, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      labour = res.labour;
      break;
    }
    case "labour_only": {
      const res = await calcLabourOnly(sb, input, config, addonResult);
      custom_price = res.custom_price;
      factors = res.factors;
      labour = res.labour;
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown service_type: ${svcType}` }, { status: 400 });
  }

  // For non-residential services, apply crating cost to custom_price
  if (custom_price && globalCratingTotal > 0) {
    custom_price = {
      ...custom_price,
      price: custom_price.price + globalCratingTotal,
      total: custom_price.total + globalCratingTotal + Math.round(globalCratingTotal * cfgNum(config, "tax_rate", TAX_RATE_FALLBACK)),
      tax: custom_price.tax + Math.round(globalCratingTotal * cfgNum(config, "tax_rate", TAX_RATE_FALLBACK)),
    };
    factors = { ...factors, crating_total: globalCratingTotal, crating_pieces_count: input.crating_pieces?.length ?? 0 };
  }

  // Add crating line item to tier includes when crating is present
  const cratingForDisplay = svcType === "local_move" ? residentialCratingTotal : globalCratingTotal;
  if (cratingForDisplay > 0 && input.crating_pieces && input.crating_pieces.length > 0) {
    const cratingLine = `Custom crating for ${input.crating_pieces.length} item${input.crating_pieces.length === 1 ? "" : "s"}: $${cratingForDisplay.toLocaleString()}`;
    if (tiers) {
      for (const t of Object.values(tiers)) {
        t.includes.push(cratingLine);
      }
    } else if (custom_price) {
      custom_price.includes.push(cratingLine);
    }
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
    const crewLineStandard = `Professional crew of ${labour.crewSize}`;
    const crewLineEstate = `White glove specialist crew of ${labour.crewSize}`;
    const hoursLine = `${Math.round(labour.estimatedHours)}-hour window`;
    for (const tierName of Object.keys(tiers)) {
      const t = tiers[tierName];
      const estateCrewIdx = t.includes.findIndex((s: string) => s.toLowerCase().includes("white glove specialist crew of"));
      if (estateCrewIdx >= 0) t.includes[estateCrewIdx] = crewLineEstate;
      else {
        const crewIdx = t.includes.findIndex((s: string) =>
          s.toLowerCase().includes("professional crew of") || s.toLowerCase().includes("professional movers")
        );
        if (crewIdx >= 0) t.includes[crewIdx] = crewLineStandard;
      }
      const hoursIdx = t.includes.findIndex((s: string) => s.toLowerCase().includes("-hour window"));
      if (hoursIdx >= 0) t.includes[hoursIdx] = hoursLine;
    }
  }

  // ── Valuation upgrades lookup ──
  const INCLUDED_VALUATION: Record<string, string> = {
    curated: "released",
    signature: "enhanced",
    estate: "full_replacement",
  };
  const UPGRADE_PATHS: Record<string, string | null> = {
    curated: "enhanced",
    signature: "full_replacement",
    estate: null,
  };
  const moveSize = input.move_size ?? "2br";
  const valuationUpgrades: Record<string, { price: number; to_tier: string; assumed_shipment_value: number } | null> = {};
  for (const pkg of ["curated", "signature", "estate"]) {
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

  const primaryPrice = tiers ? tiers.curated.price : custom_price!.price;
  const depositAmount = tiers ? tiers.curated.deposit : custom_price!.deposit;

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
      service_type: svcType === "b2b_oneoff" ? "b2b_delivery" : svcType === "event" ? "event" : svcType === "labour_only" ? "labour_only" : svcType,
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
      client_box_count: input.client_box_count ?? null,
      inventory_warnings: inventoryWarnings.length > 0 ? inventoryWarnings : [],
      inventory_score: invResult.inventoryScore || null,
      inventory_modifier: invResult.modifier !== 1.0 ? invResult.modifier : null,
      est_crew_size: displayCrew ?? labour?.crewSize ?? null,
      est_hours: displayHours ?? labour?.estimatedHours ?? null,
      est_truck_size: labour?.truckSize ?? null,
      truck_primary: truckResult.primary?.vehicle_type ?? (labourTruckKey && TRUCK_DISPLAY[labourTruckKey] ? labourTruckKey : null),
      truck_secondary: truckResult.secondary?.vehicle_type ?? null,
      recommended_tier: input.recommended_tier || "signature",
      crating_pieces: input.crating_pieces ?? [],
      crating_total: cratingForDisplay,
      supplies_allowance: estateSuppliesAllowance,
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
      boxCount: (invResult as { boxCount?: number }).boxCount ?? input.client_box_count ?? null,
    },
    inventory_warnings: inventoryWarnings,
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
