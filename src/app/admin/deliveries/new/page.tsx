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

  const [{ data: orgs }, { data: crews }] = await Promise.all([
    db.from("organizations").select("id, name, type, vertical, email, contact_name, phone, default_pickup_address").not("name", "like", "\\_%").order("name"),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-6 py-5 animate-fade-up w-full">
      <h1 className="font-heading text-[22px] md:text-[24px] font-bold text-[var(--tx)] mb-4">
        {choice === "day_rate" ? "Day Rate" : "Create Delivery"}
      </h1>
      <NewDeliveryChoiceClient organizations={orgs || []} crews={crews || []} initialChoice={choice} />
    </div>
  );
}
