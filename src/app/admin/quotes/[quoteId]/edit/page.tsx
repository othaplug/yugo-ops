import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";
import QuoteFormClient from "../../new/QuoteFormClient";
import B2BQuoteEditClient from "./B2BQuoteEditClient";
import { sumBinsOutOnRental, availableBinInventory } from "@/lib/pricing/bin-rental";
import { overlayDeliveryVerticalDbColumns } from "@/lib/admin/delivery-vertical-column-sync";
import { mergeBundleTierIntoMergedRates } from "@/lib/b2b-bundle-line-items";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ quoteId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { quoteId } = await params;
  return { title: `Edit Quote ${quoteId}` };
}

export default async function EditQuotePage({ params }: Props) {
  const { quoteId } = await params;
  const supabase = await createClient();
  const db = createAdminClient();

  const { data: quoteRow } = await db
    .from("quotes")
    .select(
      "quote_id, service_type, factors_applied, from_address, to_address, from_access, to_access, move_date, contacts:contact_id(name, email, phone)",
    )
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!quoteRow) redirect("/admin/quotes");

  // B2B (commercial delivery) quotes get a DEDICATED full-width edit screen that
  // opens straight to the delivery form and UPDATES the quote in place. All
  // other service types keep the shared move-quote wizard (QuoteFormClient).
  const isB2bQuote =
    quoteRow.service_type === "b2b_delivery" || quoteRow.service_type === "b2b_oneoff";

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
        "id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order, variant_config",
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

  const { data: operatorRow } = user
    ? await db
        .from("platform_users")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const operatorName =
    ((operatorRow as { name?: string | null } | null)?.name ?? "").trim();

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

  if (isB2bQuote) {
    return (
      <div className="w-full min-w-0 max-w-[min(1440px,100%)] mx-auto py-5 md:py-6 animate-fade-up">
        <h1 className="admin-page-hero text-[var(--tx)] mb-1">Editing {quoteId}</h1>
        <p className="text-[13px] text-[var(--tx3)] mb-4">
          Update the commercial delivery quote. Save changes, or send the client the new version.
        </p>
        <B2BQuoteEditClient
          quoteId={quoteId}
          quote={quoteRow as Record<string, unknown>}
          organizations={orgRows ?? []}
          crews={crewRows ?? []}
          verticals={deliveryVerticals}
        />
      </div>
    );
  }

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
        operatorName={operatorName}
        prefillQuoteId={quoteId}
        editMode
      />
    </div>
  );
}
