import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import QuoteFormClient from "./QuoteFormClient";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const db = createAdminClient();

  const [{ data: addons }, { data: configRows }, { data: itemWeights }] = await Promise.all([
    db
      .from("addons")
      .select("id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order")
      .eq("active", true)
      .order("display_order"),
    db
      .from("platform_config")
      .select("key, value"),
    db
      .from("item_weights")
      .select("slug, item_name, weight_score, category, room, is_common, display_order, active")
      .eq("active", true)
      .order("display_order"),
  ]);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: pu } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .single();
  const userRole = pu?.role ?? "viewer";

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <QuoteFormClient addons={addons ?? []} config={config} itemWeights={itemWeights ?? []} userRole={userRole} />
    </div>
  );
}
