import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import DeliveryFilters from "./DeliveryFilters";

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("*")
    .order("scheduled_date", { ascending: true });

  const all = deliveries || [];
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <BackButton label="Back" />
        <div className="flex gap-1.5">
          <Link
            href="/admin/deliveries/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all duration-200"
          >
            + New Project
          </Link>
        </div>
      </div>
      <DeliveryFilters deliveries={all} today={today} />
    </div>
  );
}