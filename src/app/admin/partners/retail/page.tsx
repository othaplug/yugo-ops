import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";
import Badge from "../../components/Badge";

export default async function RetailPage() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    supabase.from("organizations").select("*").eq("type", "retail").order("name"),
    supabase.from("deliveries").select("*").eq("category", "retail").order("scheduled_date"),
  ]);

  const clients = orgs || [];
  const dels = deliveries || [];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="text-xl font-bold font-heading">{clients.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="text-xl font-bold font-heading">{dels.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">On-Time</div>
            <div className="text-xl font-bold font-heading text-[var(--grn)]">100%</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
            <div className="text-xl font-bold font-heading">$17.3K</div>
          </div>
        </div>

        {/* Partners */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading text-[13px] font-bold">{clients.length} Partners</h3>
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            + Add Partner
          </Link>
        </div>
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}?from=retail`}
            className="block bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 mb-1.5 hover:border-[var(--gold)] transition-all cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold">{c.name}</div>
                <div className="text-[9px] text-[var(--tx3)]">{c.contact_name} • {c.email}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold">{c.deliveries_per_month || 0} del/mo</span>
                <div className={`w-1.5 h-1.5 rounded-full ${c.health === "good" ? "bg-[var(--grn)]" : "bg-[var(--org)]"}`} />
              </div>
            </div>
          </Link>
        ))}

        {/* Recent Deliveries */}
        <h3 className="font-heading text-[13px] font-bold mt-4 mb-2">Recent Deliveries</h3>
        <div className="flex flex-col gap-1">
          {dels.slice(0, 5).map((d) => (
            <Link
              key={d.id}
              href={`/admin/deliveries/${d.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gdim)] text-[var(--tx2)]"><Icon name="sofa" className="w-[16px] h-[16px]" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name} ({d.client_name})</div>
                <div className="text-[9px] text-[var(--tx3)]">{Array.isArray(d.items) ? d.items.length : 0} items</div>
              </div>
              <div className="text-[10px] text-[var(--tx3)]">{d.time_slot}</div>
              <Badge status={d.status} />
            </Link>
          ))}
        </div>
    </div>
  );
}