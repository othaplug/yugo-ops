import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { Icon } from "@/components/AppIcons";
import Badge from "../../components/Badge";
import { getDeliveryDetailPath } from "@/lib/move-code";

export default async function HospitalityPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: deliveries }] = await Promise.all([
    supabase.from("organizations").select("*").eq("type", "hospitality").order("name"),
    supabase.from("deliveries").select("*").eq("category", "hospitality").order("scheduled_date"),
  ]);

  const orgsList = orgs || [];
  const delsList = deliveries || [];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
        <div className="mb-4"><BackButton label="Back" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="text-xl font-bold font-heading">{orgsList.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="text-xl font-bold font-heading">{delsList.length}</div>
          </div>
          <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
            <div className="text-xl font-bold font-heading text-[var(--gold)]">$6.9K</div>
          </Link>
          <Link href="/admin/clients/new" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all flex items-center justify-center">
            <span className="text-[10px] font-semibold text-[var(--gold)]">+ Add Partner</span>
          </Link>
        </div>

        <div className="sh">
          <div className="sh-t">{orgsList.length} Partners</div>
          <Link href="/admin/clients/new" className="sh-l">+ Add Partner</Link>
        </div>
        <div className="dl mt-2">
        {orgsList.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
            No hospitality partners yet. <Link href="/admin/clients/new" className="text-[var(--gold)] hover:underline">Add one</Link>
          </div>
        ) : orgsList.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}?from=hospitality`}
            className="block bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 mb-1.5 hover:border-[var(--gold)] transition-all cursor-pointer"
          >
            <div className="text-xs font-semibold">{c.name}</div>
            <div className="text-[9px] text-[var(--tx3)]">{c.contact_name} • {c.email}</div>
          </Link>
        ))}
        </div>

        <div className="sh mt-6">
          <div className="sh-t">Recent Deliveries</div>
          <Link href="/admin/deliveries" className="sh-l">All →</Link>
        </div>
        <div className="dl mt-2">
          {delsList.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
              No deliveries yet
            </div>
          ) : delsList.slice(0, 5).map((d) => (
            <Link
              key={d.id}
              href={getDeliveryDetailPath(d)}
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