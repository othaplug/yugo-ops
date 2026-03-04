import { createClient } from "@/lib/supabase/server";
import QuoteFormClient from "./QuoteFormClient";

export default async function NewQuotePage() {
  const supabase = await createClient();

  const [{ data: addons }, { data: configRows }] = await Promise.all([
    supabase
      .from("addons")
      .select("id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order")
      .eq("active", true)
      .order("display_order"),
    supabase
      .from("platform_config")
      .select("key, value"),
  ]);

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <QuoteFormClient addons={addons ?? []} config={config} />
    </div>
  );
}
