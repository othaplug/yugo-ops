import { createClient } from "@/lib/supabase/server";
import Topbar from "./components/Topbar";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createClient();
  
  // Fetch counts
  const { count: deliveryCount } = await supabase.from("deliveries").select("*", { count: "exact", head: true });
  const { count: invoiceCount } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  const { count: clientCount } = await supabase.from("clients").select("*", { count: "exact", head: true });

  // Fetch recent deliveries
  const { data: recentDeliveries } = await supabase
    .from("deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const statusColor: Record<string, string> = {
    pending: "text-[var(--org)] bg-[var(--ordim)]",
    confirmed: "text-[var(--blue)] bg-[var(--bldim)]",
    "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
    delivered: "text-[var(--grn)] bg-[var(--grdim)]",
    cancelled: "text-[var(--red)] bg-[var(--rdim)]",
  };

  return (
    <>
      <Topbar title="Command Center" subtitle="Operations overview" />
      <div className="max-w-[1200px] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-4">
          <Link href="/admin/deliveries" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="text-[20px] font-bold text-[var(--tx)]">{deliveryCount || 0}</div>
            <div className="text-[9px] text-[var(--grn)] mt-0.5">+12% ↑</div>
          </Link>

          <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Invoices</div>
            <div className="text-[20px] font-bold text-[var(--tx)]">{invoiceCount || 0}</div>
            <div className="text-[9px] text-[var(--grn)] mt-0.5">+8% ↑</div>
          </Link>

          <Link href="/admin/clients" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all cursor-pointer">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Clients</div>
            <div className="text-[20px] font-bold text-[var(--tx)]">{clientCount || 0}</div>
            <div className="text-[9px] text-[var(--grn)] mt-0.5">+3% ↑</div>
          </Link>

          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
            <div className="text-[20px] font-bold text-[var(--gold)]">$48K</div>
            <div className="text-[9px] text-[var(--grn)] mt-0.5">+15% ↑</div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Active</div>
            <div className="text-[20px] font-bold text-[var(--tx)]">7</div>
            <div className="text-[9px] text-[var(--tx3)] mt-0.5">In transit</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-bold text-[var(--tx)]">Recent Deliveries</div>
            <Link href="/admin/deliveries" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
              View all →
            </Link>
          </div>

          <div className="space-y-2">
            {recentDeliveries && recentDeliveries.length > 0 ? (
              recentDeliveries.map((delivery) => (
                <Link
                  key={delivery.id}
                  href={`/admin/deliveries/${delivery.id}`}
                  className="flex items-center gap-2 sm:gap-3 p-3 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] active:bg-[var(--gdim)] transition-all cursor-pointer min-h-[52px] touch-manipulation"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--gdim)] flex items-center justify-center text-[14px] flex-shrink-0">
                    📦
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--tx)] truncate">
                      {delivery.delivery_number}
                    </div>
                    <div className="text-[10px] text-[var(--tx3)] truncate">
                      {delivery.customer_name}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide ${statusColor[delivery.status] || "text-[var(--tx3)] bg-[var(--card)]"}`}>
                    {delivery.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-[11px] text-[var(--tx3)]">
                No deliveries yet
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-3">
          <Link
            href="/admin/deliveries"
            className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)] transition-all group"
          >
            <div className="text-[24px] mb-2">📦</div>
            <div className="text-[13px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
              New Delivery
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-1">
              Create a new delivery order
            </div>
          </Link>

          <Link
            href="/admin/invoices"
            className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)] transition-all group"
          >
            <div className="text-[24px] mb-2">💰</div>
            <div className="text-[13px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
              New Invoice
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-1">
              Generate client invoice
            </div>
          </Link>

          <Link
            href="/admin/clients"
            className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)] transition-all group"
          >
            <div className="text-[24px] mb-2">👥</div>
            <div className="text-[13px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
              Add Client
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-1">
              Onboard new partner
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
