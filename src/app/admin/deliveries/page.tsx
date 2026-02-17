import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import AllProjectsView from "./AllProjectsView";

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const [{ data: deliveries }, { data: moves }] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("moves").select("*").order("scheduled_date", { ascending: true }),
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
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
      <AllProjectsView deliveries={allDeliveries} moves={allMoves} today={today} />
    </div>
  );
}