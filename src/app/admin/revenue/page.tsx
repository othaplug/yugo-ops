export const metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import RevenueClient from "./RevenueClient";

export default async function RevenuePage() {
  const db = createAdminClient();
  const cutoffDeliveries = new Date(Date.now() - 730 * 24 * 3600_000)
    .toISOString()
    .slice(0, 10);
  const [{ data: invoices }, { data: orgs }, { data: paidMoves }, { data: deliveries }] =
    await Promise.all([
      db
        .from("invoices")
        .select(
          "id, client_name, organization_id, delivery_id, move_id, amount, status, created_at, updated_at, invoice_number, paid_at, deliveries!delivery_id(delivery_number, final_price, calculated_price, override_price, admin_adjusted_price, total_price, quoted_price)",
        ),
      db.from("organizations").select("id, name, type"),
      db
        .from("moves")
        .select(
          "id, move_code, client_name, estimate, final_amount, total_price, amount, deposit_amount, balance_amount, payment_marked_paid_at",
        )
        .eq("payment_marked_paid", true)
        .not("payment_marked_paid_at", "is", null),
      db
        .from("deliveries")
        .select("*")
        .gte("created_at", `${cutoffDeliveries}T00:00:00.000Z`)
        .order("created_at", { ascending: false })
        .limit(1500),
    ]);
  const clientTypeMap: Record<string, string> = {};
  const orgIdToType: Record<string, string> = {};
  const clientNameToOrgId: Record<string, string> = {};
  (orgs || []).forEach((o) => {
    clientTypeMap[o.name] = o.type || "retail";
    orgIdToType[o.id] = o.type || "retail";
    clientNameToOrgId[o.name] = o.id;
  });
  (invoices || []).forEach((inv) => {
    if (inv.organization_id && inv.client_name) {
      clientNameToOrgId[inv.client_name] = inv.organization_id;
    }
  });
  return (
    <RevenueClient
      invoices={invoices || []}
      deliveries={(deliveries || []) as Record<string, unknown>[]}
      paidMoves={paidMoves || []}
      clientTypeMap={clientTypeMap}
      orgIdToType={orgIdToType}
      clientNameToOrgId={clientNameToOrgId}
    />
  );
}
