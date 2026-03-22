import { createAdminClient } from "@/lib/supabase/admin";
import AllMovesClient from "./AllMovesClient";

export const metadata = { title: "Moves" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AllMovesPage() {
  const db = createAdminClient();

  const [{ data: moves }, { data: quotes }] = await Promise.all([
    db
      .from("moves")
      .select(
        "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, status, move_type, service_type, tier_selected, crew_id, created_at, margin_percent, margin_flag, est_margin_percent",
      )
      .order("scheduled_date", { ascending: false }),
    db
      .from("quotes")
      .select("id, quote_id, contact_id, service_type, status, tiers, custom_price, sent_at, created_at, from_address, to_address")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

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
      moves={moves || []}
      recentQuotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
      crewMap={crewMap}
    />
  );
}
