import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import CrewMap from "./CrewMap";

export default async function CrewPage() {
  const supabase = await createClient();
  const [{ data: crews }, { data: deliveries }] = await Promise.all([
    supabase.from("crews").select("*").order("name"),
    supabase.from("deliveries").select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address").order("scheduled_date"),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
      <div className="mb-4"><BackButton label="Back" /></div>
      <CrewMap crews={crews || []} deliveries={deliveries || []} />
    </div>
  );
}