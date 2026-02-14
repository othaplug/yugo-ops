import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";
import Badge from "../components/Badge";
import Link from "next/link";
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
    <>
      <Topbar title="All Deliveries" subtitle="Scheduling & tracking" />
      <div className="max-w-[1200px] px-6 py-5">
        {/* Actions */}
        <div className="flex gap-1.5 mb-3">
          <Link
            href="/admin/deliveries/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            + New Delivery
          </Link>
        </div>

        {/* Filter tabs + list (client component) */}
        <DeliveryFilters deliveries={all} today={today} />
      </div>
    </>
  );
}