import { createAdminClient } from "@/lib/supabase/admin";
import { calcEstimatedCost, calcEstimatedMarginPct, calcActualMargin, getMarginFlag } from "@/lib/pricing/engine";
import AllMovesClient from "./AllMovesClient";

export const metadata = { title: "Moves" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AllMovesPage() {
  const db = createAdminClient();

  const [{ data: moves }, { data: quotes }, { data: cfgRows }] = await Promise.all([
    db
      .from("moves")
      .select(
        "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, status, move_type, service_type, tier_selected, crew_id, created_at, margin_percent, margin_flag, est_margin_percent, est_hours, est_crew_size, truck_primary, distance_km, move_size, actual_hours, actual_crew_count",
      )
      .order("scheduled_date", { ascending: false }),
    db
      .from("quotes")
      .select("id, quote_id, contact_id, service_type, status, tiers, custom_price, sent_at, created_at, from_address, to_address")
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("platform_config").select("key, value"),
  ]);

  // Build config map for pricing engine
  const cfg: Record<string, string> = {};
  for (const r of cfgRows ?? []) cfg[r.key] = r.value;

  // Compute margin on-the-fly for any move missing stored values
  const movesWithMargin = (moves || []).map((m) => {
    const revenue = m.estimate ?? 0;
    if (revenue <= 0) return m;

    const isCompleted = ["completed", "delivered", "paid"].includes((m.status || "").toLowerCase());
    const truck = ((m.truck_primary || "sprinter") as string).toLowerCase().replace(/[^a-z0-9]/g, "");
    const km = (m.distance_km as number | null) ?? 20;
    const tier = (m.tier_selected as string | null) || "curated";
    const size = (m.move_size as string | null) || "2br";

    let marginPercent = m.margin_percent as number | null;
    let estMarginPercent = m.est_margin_percent as number | null;
    let marginFlag = m.margin_flag as string | null;

    if (isCompleted && marginPercent == null) {
      try {
        const result = calcActualMargin(
          {
            actualHours: (m.actual_hours as number | null) ?? null,
            estimatedHours: (m.est_hours as number | null) ?? null,
            actualCrew: (m.actual_crew_count as number | null) ?? null,
            crewSize: (m.est_crew_size as number | null) ?? null,
            truckType: truck,
            distanceKm: km,
            tier,
            moveSize: size,
            totalPrice: revenue,
          },
          cfg,
        );
        marginPercent = result.margin_percent;
        marginFlag = result.margin_flag;
      } catch { /* keep null */ }
    }

    if (!isCompleted && estMarginPercent == null) {
      try {
        const hours = (m.est_hours as number | null) ?? 4;
        const crew = (m.est_crew_size as number | null) ?? 2;
        const cost = calcEstimatedCost({ actualEstimatedHours: hours, crew, recommendedTruck: truck, distanceKm: km, tier, moveSize: size }, cfg);
        estMarginPercent = calcEstimatedMarginPct(revenue, cost);
        if (!marginFlag) marginFlag = getMarginFlag(estMarginPercent);
      } catch { /* keep null */ }
    }

    return { ...m, margin_percent: marginPercent, est_margin_percent: estMarginPercent, margin_flag: marginFlag };
  });

  // Resolve contact names for recent quotes
  const contactIds = (quotes || []).map((q) => q.contact_id).filter(Boolean);
  let contactMap: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await db
      .from("contacts")
      .select("id, name")
      .in("id", contactIds);
    if (contacts) {
      contactMap = Object.fromEntries(contacts.map((c) => [c.id, c.name || ""]));
    }
  }

  // Resolve crew names
  const crewIds = [...new Set((moves || []).map((m) => m.crew_id).filter(Boolean))];
  let crewMap: Record<string, string> = {};
  if (crewIds.length > 0) {
    const { data: crews } = await db.from("crews").select("id, name").in("id", crewIds);
    if (crews) {
      crewMap = Object.fromEntries(crews.map((c) => [c.id, c.name || ""]));
    }
  }

  return (
    <AllMovesClient
      moves={movesWithMargin}
      recentQuotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
      crewMap={crewMap}
    />
  );
}
