import { createClient } from "@/lib/supabase/server";

export default async function RevenuePage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase.from("invoices").select("*");

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = all
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);
  const overdueTotal = all
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);

  // Revenue by client
  const byClient: Record<string, number> = {};
  paid.forEach((i) => {
    byClient[i.client_name] = (byClient[i.client_name] || 0) + Number(i.amount);
  });
  const topClients = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Collected</div>
            <div className="text-xl font-bold font-serif">${(paidTotal / 1000).toFixed(1)}K</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
            <div className="text-xl font-bold font-serif text-[var(--org)]">${(outstanding / 1000).toFixed(1)}K</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Overdue</div>
            <div className="text-xl font-bold font-serif text-[var(--red)]">${(overdueTotal / 1000).toFixed(1)}K</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Invoices</div>
            <div className="text-xl font-bold font-serif">{all.length}</div>
          </div>
        </div>

        {/* Top Clients */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <h3 className="text-[13px] font-bold mb-3">Top Clients (by paid revenue)</h3>
            {topClients.map(([name, amount]) => (
              <div key={name} className="flex items-center gap-2 py-1 border-b border-[var(--brd)] last:border-none">
                <span className="flex-1 text-[10px] font-semibold">{name}</span>
                <span className="text-[10px] font-semibold">${amount.toLocaleString()}</span>
              </div>
            ))}
            {topClients.length === 0 && (
              <div className="text-[10px] text-[var(--tx3)]">No paid invoices yet</div>
            )}
          </div>

          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <h3 className="text-[13px] font-bold mb-3">Invoice Breakdown</h3>
            {["paid", "sent", "overdue"].map((status) => {
              const count = all.filter((i) => i.status === status).length;
              const total = all.filter((i) => i.status === status).reduce((s, i) => s + Number(i.amount), 0);
              const pct = all.length > 0 ? Math.round((count / all.length) * 100) : 0;
              const colors: Record<string, string> = { paid: "var(--grn)", sent: "var(--blue)", overdue: "var(--red)" };
              return (
                <div key={status} className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] capitalize">{status}</span>
                    <span className="text-[10px] font-semibold">${total.toLocaleString()}</span>
                  </div>
                  <div className="h-[5px] bg-[var(--bg)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[status] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}