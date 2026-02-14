import { createClient } from "@/lib/supabase/server";
import Topbar from "./components/Topbar";
import Badge from "./components/Badge";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  // Parallel data fetching
  const [deliveriesRes, movesRes, invoicesRes, eventsRes] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("moves").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("status_events").select("*").order("created_at", { ascending: false }).limit(6),
  ]);

  const deliveries = deliveriesRes.data || [];
  const moves = movesRes.data || [];
  const invoices = invoicesRes.data || [];
  const events = eventsRes.data || [];

  const todayDeliveries = deliveries.filter((d) => d.scheduled_date === today);
  const pendingCount = deliveries.filter((d) => d.status === "pending").length;
  const paidRevenue = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);
  const overdueAmount = invoices.filter((i) => i.status === "overdue").reduce((sum, i) => sum + Number(i.amount), 0);
  const upcomingMoves = moves.filter((m) => m.status === "confirmed" || m.status === "scheduled");

  const categoryIcons: Record<string, string> = {
    retail: "🛋️",
    designer: "🎨",
    hospitality: "🏨",
    gallery: "🖼️",
  };

  const categoryBgs: Record<string, string> = {
    retail: "bg-[var(--gdim)]",
    designer: "bg-[var(--prdim)]",
    hospitality: "bg-[var(--ordim)]",
    gallery: "bg-[var(--bldim)]",
  };

  return (
    <>
      <Topbar
        title="Command Center"
        subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      />
      <div className="max-w-[1200px] px-6 py-5">
        {/* Metrics Row */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <Link href="/admin/deliveries" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Today</div>
            <div className="text-xl font-bold font-serif">{todayDeliveries.length}</div>
          </Link>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Pending</div>
            <div className="text-xl font-bold font-serif text-[var(--org)]">{pendingCount}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
            <div className="text-xl font-bold font-serif">${(paidRevenue / 1000).toFixed(1)}K</div>
          </div>
          <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Overdue</div>
            <div className="text-xl font-bold font-serif text-[var(--red)]">${(overdueAmount / 1000).toFixed(1)}K</div>
          </Link>
          <Link href="/admin/moves/residential" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">B2C</div>
            <div className="text-xl font-bold font-serif">{moves.length}</div>
          </Link>
        </div>

        {/* Today's Deliveries */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-bold">Today&apos;s B2B Deliveries</h3>
          <Link href="/admin/deliveries" className="text-[10px] text-[var(--gold)] font-semibold">All →</Link>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          {(todayDeliveries.length > 0 ? todayDeliveries : deliveries.slice(0, 5)).map((d) => (
            <Link
              key={d.id}
              href={`/admin/deliveries/${d.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${categoryBgs[d.category] || "bg-[var(--gdim)]"}`}>
                {categoryIcons[d.category] || "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name} ({d.client_name})</div>
                <div className="text-[9px] text-[var(--tx3)] truncate">{d.items?.length || 0} items</div>
              </div>
              <div className="text-[10px] text-[var(--tx3)] shrink-0">{d.time_slot}</div>
              <Badge status={d.status} />
            </Link>
          ))}
        </div>

        {/* B2C Moves */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-bold">B2C Moves</h3>
          <Link href="/admin/moves/residential" className="text-[10px] text-[var(--gold)] font-semibold">All →</Link>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          {upcomingMoves.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-[var(--gdim)]">
                {m.move_type === "office" ? "🏢" : "🏠"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{m.client_name}</div>
                <div className="text-[9px] text-[var(--tx3)] truncate">{m.from_address} → {m.to_address}</div>
              </div>
              <div className="text-[10px] text-[var(--tx3)] shrink-0">{m.scheduled_date}</div>
              <Badge status={m.status} />
            </div>
          ))}
        </div>

        {/* Activity Feed */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <h3 className="text-[13px] font-bold mb-3">Activity</h3>
            {events.map((e) => (
              <div key={e.id} className="flex gap-2 py-1.5 border-b border-[var(--brd)] last:border-none">
                <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] bg-[var(--gdim)] shrink-0">
                  {e.icon || "📋"}
                </div>
                <div className="flex-1">
                  <div className="text-[10px]">{e.description}</div>
                  <div className="text-[9px] text-[var(--tx3)] mt-0.5">
                    {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <h3 className="text-[13px] font-bold mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--brd)]">
                <div className="text-[8px] text-[var(--tx3)] uppercase font-bold">Total Deliveries</div>
                <div className="text-xl font-bold font-serif">{deliveries.length}</div>
              </div>
              <div className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--brd)]">
                <div className="text-[8px] text-[var(--tx3)] uppercase font-bold">Total Moves</div>
                <div className="text-xl font-bold font-serif">{moves.length}</div>
              </div>
              <div className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--brd)]">
                <div className="text-[8px] text-[var(--tx3)] uppercase font-bold">Invoices</div>
                <div className="text-xl font-bold font-serif">{invoices.length}</div>
              </div>
              <div className="bg-[var(--bg)] p-2 rounded-lg border border-[var(--brd)]">
                <div className="text-[8px] text-[var(--tx3)] uppercase font-bold">Unassigned</div>
                <div className="text-xl font-bold font-serif text-[var(--org)]">
                  {deliveries.filter((d) => d.status === "pending").length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}