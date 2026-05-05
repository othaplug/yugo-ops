export const metadata = { title: "Quotes" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";
import QuotesListV3Client from "./QuotesListV3Client";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = isSuperAdminEmail(user?.email);

  const db = createAdminClient();

  const { data: quotes } = await db
    .from("quotes")
    .select("id, quote_id, contact_id, service_type, status, tiers, custom_price, recommended_tier, from_address, to_address, move_date, sent_at, viewed_at, accepted_at, expires_at, created_at, loss_reason")
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
    <QuotesListV3Client
      isSuperAdmin={isSuperAdmin}
      quotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
    />
  );
}
