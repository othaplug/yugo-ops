import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { Icon } from "@/components/AppIcons";
import Badge from "../../components/Badge";

export default async function HospitalityPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    supabase.from("organizations").select("*").eq("type", "hospitality").order("name"),
    supabase.from("deliveries").select("*").eq("category", "hospitality").order("scheduled_date"),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
        <div className="mb-4"><BackButton label="Back" /></div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="text-xl font-bold font-heading">{(orgs || []).length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="text-xl font-bold font-heading">{(deliveries || []).length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
            <div className="text-xl font-bold font-heading">$6.9K</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading text-[13px] font-bold">Partners</h3>
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            + Add Partner
          </Link>
        </div>
        {(orgs || []).map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}?from=hospitality`}
            className="block bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 mb-1.5 hover:border-[var(--gold)] transition-all cursor-pointer"
          >
            <div className="text-xs font-semibold">{c.name}</div>
            <div className="text-[9px] text-[var(--tx3)]">{c.contact_name} • {c.email}</div>
          </Link>
        ))}

        <h3 className="font-heading text-[13px] font-bold mt-4 mb-2">Recent Deliveries</h3>
        <div className="flex flex-col gap-1">
          {(deliveries || []).slice(0, 5).map((d) => (
            <Link
              key={d.id}
              href={`/admin/deliveries/${d.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--ordim)] text-[var(--tx2)]"><Icon name="hotel" className="w-[16px] h-[16px]" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name} ({d.client_name})</div>
                <div className="text-[9px] text-[var(--tx3)]">{Array.isArray(d.items) ? d.items.length : 0} items</div>
              </div>
              <Badge status={d.status} />
            </Link>
          ))}
        </div>
    </div>
  );
}