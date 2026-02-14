import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";
import Badge from "../../components/Badge";

export default async function HospitalityPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    supabase.from("organizations").select("*").eq("type", "hospitality").order("name"),
    supabase.from("deliveries").select("*").eq("category", "hospitality").order("scheduled_date"),
  ]);

  return (
    <>
      <Topbar title="Hospitality" subtitle="FF&E & seasonal" />
      <div className="max-w-[1200px] px-6 py-5">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="text-xl font-bold font-serif">{(orgs || []).length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="text-xl font-bold font-serif">{(deliveries || []).length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
            <div className="text-xl font-bold font-serif">$6.9K</div>
          </div>
        </div>

        {(orgs || []).map((c) => (
          <div key={c.id} className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 mb-1.5 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-xs font-semibold">{c.name}</div>
            <div className="text-[9px] text-[var(--tx3)]">{c.contact_name} • {c.email}</div>
          </div>
        ))}

        <h3 className="text-[13px] font-bold mt-4 mb-2">Recent Deliveries</h3>
        <div className="flex flex-col gap-1">
          {(deliveries || []).slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-[var(--ordim)]">🏨</div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name} ({d.client_name})</div>
                <div className="text-[9px] text-[var(--tx3)]">{d.items?.length || 0} items</div>
              </div>
              <Badge status={d.status} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}