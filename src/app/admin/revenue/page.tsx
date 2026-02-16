import { createClient } from "@/lib/supabase/server";
import RevenueClient from "./RevenueClient";

export default async function RevenuePage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: orgs }] = await Promise.all([
    supabase.from("invoices").select("*"),
    supabase.from("organizations").select("name, type"),
  ]);
  const clientTypeMap: Record<string, string> = {};
  (orgs || []).forEach((o) => { clientTypeMap[o.name] = o.type || "retail"; });
  return <RevenueClient invoices={invoices || []} clientTypeMap={clientTypeMap} />;
}
