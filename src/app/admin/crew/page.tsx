import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import UnifiedTrackingView from "./UnifiedTrackingView";

export default async function CrewPage() {
  const supabase = await createClient();
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address")
    .order("scheduled_date");

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <UnifiedTrackingView initialCrews={[]} initialDeliveries={deliveries || []} />
    </div>
  );
}