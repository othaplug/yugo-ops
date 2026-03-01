import { createClient } from "@/lib/supabase/server";
import RevenueClient from "./RevenueClient";

export default async function RevenuePage() {
  const supabase = await createClient();
  const [
    { data: invoices },
    { data: orgs },
    { data: paidMoves },
  ] = await Promise.all([
    supabase.from("invoices").select("id, client_name, organization_id, amount, status, created_at, updated_at, invoice_number"),
    supabase.from("organizations").select("id, name, type"),
    supabase
      .from("moves")
      .select("id, move_code, client_name, estimate, payment_marked_paid_at")
      .eq("payment_marked_paid", true)
      .not("payment_marked_paid_at", "is", null),
  ]);
  const clientTypeMap: Record<string, string> = {};
  const clientNameToOrgId: Record<string, string> = {};
  (orgs || []).forEach((o) => {
    clientTypeMap[o.name] = o.type || "retail";
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
      paidMoves={paidMoves || []}
      clientTypeMap={clientTypeMap}
      clientNameToOrgId={clientNameToOrgId}
    />
  );
}
