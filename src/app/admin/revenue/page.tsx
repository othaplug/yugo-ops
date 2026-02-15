import { createClient } from "@/lib/supabase/server";
import RevenueClient from "./RevenueClient";

export default async function RevenuePage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase.from("invoices").select("*");

  return <RevenueClient invoices={invoices || []} />;
}
