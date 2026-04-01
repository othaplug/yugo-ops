import { createAdminClient } from "@/lib/supabase/admin";
import NewDeliveryChoiceClient from "./NewDeliveryChoiceClient";

export const metadata = { title: "Schedule Delivery" };

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const db = createAdminClient();
  const params = await searchParams;
  const choice = typeof params?.choice === "string" ? params.choice : undefined;

  const [{ data: orgs }, { data: crews }, { data: verticalRows }] = await Promise.all([
    db.from("organizations").select("id, name, type, vertical, email, contact_name, phone, default_pickup_address").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").eq("is_active", true).order("name"),
    db.from("delivery_verticals").select("code, name, pricing_method, base_rate, default_config").eq("active", true).order("sort_order", { ascending: true }),
  ]);

  const deliveryVerticals = (verticalRows ?? []).map((row) => ({
    code: String(row.code),
    name: String(row.name),
    pricing_method: String(row.pricing_method ?? "dimensional"),
    base_rate: Number(row.base_rate ?? 0),
    default_config:
      row.default_config && typeof row.default_config === "object" && !Array.isArray(row.default_config)
        ? (row.default_config as Record<string, unknown>)
        : {},
  }));

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-6 py-5 animate-fade-up w-full">
      <h1 className="font-hero text-[22px] md:text-[24px] font-bold text-[var(--tx)] mb-4">
        {choice === "day_rate" ? "Day Rate" : choice === "b2b_oneoff" ? "B2B Jobs" : "Create Delivery"}
      </h1>
      <NewDeliveryChoiceClient organizations={orgs || []} crews={crews || []} verticals={deliveryVerticals} initialChoice={choice} />
    </div>
  );
}
