export const metadata = { title: "New Claim" };
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import NewClaimClient from "./NewClaimClient";

export default async function NewClaimPage() {
  const db = createAdminClient();

  const [{ data: moves }, { data: deliveries }] = await Promise.all([
    db.from("moves")
      .select("id, client_name, move_code, from_address, to_address, scheduled_date, valuation_tier")
      .order("scheduled_date", { ascending: false })
      .limit(100),
    db.from("deliveries")
      .select("id, customer_name, client_name, delivery_number, from_address, to_address, scheduled_date")
      .order("scheduled_date", { ascending: false })
      .limit(100),
  ]);

  return (
    <NewClaimClient
      moves={(moves || []).map((m) => ({
        id: m.id,
        label: `${m.move_code || ""}, ${m.client_name || "Unknown"}`,
        clientName: m.client_name || "",
        valuationTier: m.valuation_tier || "released",
        address: [m.from_address, m.to_address].filter(Boolean).join(" → "),
        date: m.scheduled_date || "",
      }))}
      deliveries={(deliveries || []).map((d) => ({
        id: d.id,
        label: `${d.delivery_number || ""}, ${d.customer_name || d.client_name || "Unknown"}`,
        clientName: d.customer_name || d.client_name || "",
        address: [d.from_address, d.to_address].filter(Boolean).join(" → "),
        date: d.scheduled_date || "",
      }))}
    />
  );
}
