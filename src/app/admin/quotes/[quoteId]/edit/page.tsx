import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import EditQuoteClient from "./EditQuoteClient";

interface Props {
  params: Promise<{ quoteId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { quoteId } = await params;
  return { title: `Edit Quote ${quoteId}` };
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

  const st = String(quote.service_type || "").toLowerCase();
  if (st === "b2b_delivery" || st === "b2b_oneoff") {
    redirect(`/admin/quotes/new?copy_quote=${encodeURIComponent(quoteId)}`);
  }

  const [{ data: addons }, { data: configRows }, { data: itemWeights }] = await Promise.all([
    db
      .from("addons")
      .select("id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order")
      .eq("active", true)
      .order("display_order"),
    db.from("platform_config").select("key, value"),
    db.from("item_weights").select("slug, item_name, weight_score, category, room, is_common, display_order, active").eq("active", true).order("display_order"),
  ]);

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  return (
    <div className="w-full min-w-0 py-5 md:py-6">
      <EditQuoteClient
        originalQuote={quote}
        addons={addons ?? []}
        config={config}
        itemWeights={itemWeights ?? []}
      />
    </div>
  );
}
