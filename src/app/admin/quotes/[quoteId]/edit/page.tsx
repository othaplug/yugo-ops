import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import EditQuoteClient from "./EditQuoteClient";

interface Props {
  params: Promise<{ quoteId: string }>;
}

export default async function EditQuotePage({ params }: Props) {
  const { quoteId } = await params;
  const db = createAdminClient();

  const { data: quote } = await db
    .from("quotes")
    .select("*, contacts:contact_id(id, name, email, phone)")
    .eq("quote_id", quoteId)
    .single();

  if (!quote) redirect("/admin/quotes");

  const [{ data: addons }, { data: configRows }, { data: itemWeights }] = await Promise.all([
    db
      .from("addons")
      .select("id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order")
      .eq("active", true)
      .order("display_order"),
    db.from("platform_config").select("key, value"),
    db.from("item_weights").select("slug, item_name, weight_score, category, is_common").order("item_name"),
  ]);

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <EditQuoteClient
        originalQuote={quote}
        addons={addons ?? []}
        config={config}
        itemWeights={itemWeights ?? []}
      />
    </div>
  );
}
