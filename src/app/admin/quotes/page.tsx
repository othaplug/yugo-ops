export const metadata = { title: "Quotes" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import QuotesListClient from "./QuotesListClient";

export default async function QuotesPage() {
  const db = createAdminClient();

  const { data: quotes } = await db
    .from("quotes")
    .select("id, quote_id, contact_id, service_type, status, tiers, custom_price, from_address, to_address, move_date, sent_at, viewed_at, accepted_at, expires_at, created_at")
    .neq("status", "superseded")
    .order("created_at", { ascending: false });

  const contactIds = (quotes || []).map((q) => q.contact_id).filter(Boolean);
  let contactMap: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await db.from("contacts").select("id, name").in("id", contactIds);
    if (contacts) {
      contactMap = Object.fromEntries(contacts.map((c) => [c.id, c.name || ""]));
    }
  }

  return (
    <QuotesListClient
      quotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
    />
  );
}
