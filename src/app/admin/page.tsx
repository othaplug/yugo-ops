import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const BADGE_MAP: Record<string, string> = {
  pending: "b-go",
  scheduled: "b-bl",
  confirmed: "b-bl",
  dispatched: "b-or",
  "in-transit": "b-or",
  delivered: "b-gr",
  cancelled: "b-rd",
};

function getBadgeClass(status: string) {
  return `bdg ${BADGE_MAP[status] || "b-go"}`;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: deliveries },
    { data: moves },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("moves").select("*"),
    supabase.from("invoices").select("*"),
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];
  const allInvoices = invoices || [];

  const todayDeliveries = allDeliveries.filter((d) => d.scheduled_date === today);
  const pendingCount = allDeliveries.filter((d) => d.status === "pending").length;
  const overdueAmount = allInvoices
    .filter((i) => i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const b2cUpcoming = allMoves.filter((m) => m.status === "confirmed" || m.status === "scheduled");

  const categoryIcons: Record<string, string> = {
    retail: "🛋️",
    designer: "🎨",
    hospitality: "🏨",
    gallery: "🖼️",
  };
  const categoryBgs: Record<string, string> = {
    retail: "var(--gdim)",
    designer: "var(--prdim)",
    hospitality: "var(--ordim)",
    gallery: "var(--bldim)",
  };

  const revenueData = [
    { m: "Sep", v: 15 },
    { m: "Oct", v: 22 },
    { m: "Nov", v: 28 },
    { m: "Dec", v: 31 },
    { m: "Jan", v: 34 },
    { m: "Feb", v: 38.4 },
  ];
  const activityItems = [
    { ic: "📦", bg: "var(--gdim)", t: "DEL in transit", tm: "9:12 AM" },
    { ic: "✅", bg: "var(--grdim)", t: "INV paid ($1,800)", tm: "8:45 AM" },
    { ic: "🏠", bg: "var(--gdim)", t: "MV-001 materials delivered", tm: "8:30 AM" },
    { ic: "📋", bg: "var(--bldim)", t: "New referral: Williams", tm: "8:15 AM" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
      {/* Metrics - .metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Link href="/admin/deliveries" className="mc">
          <div className="mc-l">Today</div>
          <div className="mc-v">{todayDeliveries.length}</div>
        </Link>
        <div className="mc">
          <div className="mc-l">Pending</div>
          <div className="mc-v text-[var(--org)]">{pendingCount}</div>
        </div>
        <div className="mc">
          <div className="mc-l">Revenue (Feb)</div>
          <div className="mc-v">$38.4K</div>
          <div className="mc-c up">↑ 23%</div>
        </div>
        <Link href="/admin/invoices" className="mc">
          <div className="mc-l">Overdue</div>
          <div className="mc-v text-[var(--red)]">${(overdueAmount / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/moves/residential" className="mc">
          <div className="mc-l">B2C</div>
          <div className="mc-v">{allMoves.length}</div>
        </Link>
      </div>

      {/* Today's B2B Deliveries - .sh + .dl */}
      <div className="sh">
        <div className="sh-t">Today&apos;s B2B Deliveries</div>
        <Link href="/admin/deliveries" className="sh-l">All →</Link>
      </div>
      <div className="dl">
        {(todayDeliveries.length > 0 ? todayDeliveries : allDeliveries.slice(0, 5)).map((d) => (
          <Link
            key={d.id}
            href={`/admin/deliveries/${d.id}`}
            className="dc"
          >
            <div
              className="dc-ic"
              style={{ background: categoryBgs[d.category] || "var(--gdim)" }}
            >
              {categoryIcons[d.category] || "📦"}
            </div>
            <div className="dc-i">
              <div className="dc-t">{d.customer_name} ({d.client_name})</div>
              <div className="dc-s">{d.items?.length || 0} items</div>
            </div>
            <div className="dc-tm">{d.time_slot}</div>
            <span className={getBadgeClass(d.status)}>{d.status?.replace("-", " ")}</span>
          </Link>
        ))}
      </div>

      {/* B2C Moves */}
      <div className="sh mt-4">
        <div className="sh-t">B2C Moves</div>
        <Link href="/admin/moves/residential" className="sh-l">All →</Link>
      </div>
      <div className="dl">
        {b2cUpcoming.slice(0, 5).map((m) => (
          <Link
            key={m.id}
            href={`/admin/moves/residential`}
            className="dc"
          >
            <div className="dc-ic" style={{ background: "var(--gdim)" }}>
              {m.move_type === "office" ? "🏢" : "🏠"}
            </div>
            <div className="dc-i">
              <div className="dc-t">{m.client_name}</div>
              <div className="dc-s">{m.from_address} → {m.to_address}</div>
            </div>
            <div className="dc-tm">{m.scheduled_date}</div>
            <span className={getBadgeClass(m.status)}>{m.status}</span>
          </Link>
        ))}
      </div>

      {/* g2 - Monthly Revenue + Activity */}
      <div className="g2 mt-4">
        <div className="panel">
          <div className="sh">
            <div className="sh-t">Monthly Revenue</div>
            <Link href="/admin/revenue" className="sh-l">Details →</Link>
          </div>
          <div className="flex items-end gap-1.5 h-[120px]">
            {revenueData.map((d, i) => {
              const pct = Math.round((d.v / 40) * 100);
              const isNow = i === 5;
              return (
                <div key={d.m} className="flex-1 flex flex-col items-center gap-0.5 h-full">
                  <span className={`text-[9px] font-semibold ${isNow ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>
                    ${d.v}K
                  </span>
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full rounded-t min-h-[3px]"
                      style={{
                        height: `${pct}%`,
                        background: isNow
                          ? "linear-gradient(to top, rgba(201,169,98,.2), rgba(201,169,98,.6))"
                          : "var(--brd)",
                      }}
                    />
                  </div>
                  <span className="text-[8px] text-[var(--tx3)]">{d.m}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="sh">
            <div className="sh-t">Activity</div>
          </div>
          {activityItems.map((a) => (
            <div key={a.t} className="act-item">
              <div className="act-dot" style={{ background: a.bg }}>{a.ic}</div>
              <div className="act-body">
                <div className="act-t">{a.t}</div>
                <div className="act-tm">{a.tm}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
