import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";
import QuoteFormClient from "./QuoteFormClient";
import { sumBinsOutOnRental, availableBinInventory } from "@/lib/pricing/bin-rental";
import { overlayDeliveryVerticalDbColumns } from "@/lib/admin/delivery-vertical-column-sync";
import { mergeBundleTierIntoMergedRates } from "@/lib/b2b-bundle-line-items";

export const metadata = { title: "New Quote" };

export default async function NewQuotePage() {
  const supabase = await createClient();
  const db = createAdminClient();

  const [
    { data: addons },
    { data: configRows },
    { data: itemWeights },
    { data: orgRows },
    { data: crewRows },
  ] = await Promise.all([
    db
      .from("addons")
      .select(
        "id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order",
      )
      .eq("active", true)
      .order("display_order"),
    db.from("platform_config").select("key, value"),
    db
      .from("item_weights")
      .select("slug, item_name, weight_score, category, room, is_common, display_order, active, num_people_min, assembly_complexity, disassembly_required")
      .eq("active", true)
      .order("display_order"),
    db
      .from("organizations")
      .select("id, name, type, vertical, email, contact_name, phone, default_pickup_address")
      .not("name", "like", "\\_%")
      .order("name"),
    db.from("crews").select("id, name, members").eq("is_active", true).order("name"),
  ]);

  const dvRes = await db.from("delivery_verticals").select("*").eq("active", true).order("sort_order", {
    ascending: true,
  });
  const deliveryVerticalRows = dvRes.error ? [] : (dvRes.data ?? []);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: pu } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .single();
  const userRole = pu?.role ?? "viewer";
  const isSuperAdmin = isSuperAdminEmail(user?.email);

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  const deliveryVerticals = (deliveryVerticalRows ?? []).map((row) => {
    const raw =
      row.default_config && typeof row.default_config === "object" && !Array.isArray(row.default_config)
        ? { ...(row.default_config as Record<string, unknown>) }
        : {};
    overlayDeliveryVerticalDbColumns(row as Record<string, unknown>, raw);
    const default_config = mergeBundleTierIntoMergedRates(raw);
    return {
      code: String(row.code),
      name: String(row.name),
      pricing_method: String(row.pricing_method ?? "dimensional"),
      base_rate: Number(row.base_rate ?? 0),
      default_config,
    };
  });

  const totalBins = Number(config.bin_total_inventory ?? "500") || 500;
  const outOnRental = await sumBinsOutOnRental(db);
  const binInventorySnapshot = {
    total: totalBins,
    out: outOnRental,
    available: availableBinInventory(totalBins, outOnRental),
  };

  return (
    <div className="w-full min-w-0 py-5 md:py-6">
      <QuoteFormClient
        addons={addons ?? []}
        config={config}
        itemWeights={itemWeights ?? []}
        deliveryVerticals={deliveryVerticals}
        b2bOrganizations={orgRows ?? []}
        b2bCrews={crewRows ?? []}
        userRole={userRole}
        isSuperAdmin={isSuperAdmin}
        binInventorySnapshot={binInventorySnapshot}
        uiVariant="v2"
      />
    </div>
  );
}
