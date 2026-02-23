import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import BackButton from "../../../components/BackButton";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { getMoveDetailPath } from "@/lib/move-code";

export default async function ClientRevenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("id, name").eq("id", orgId).single();
  if (!org) notFound();

  const [byOrg, byName] = await Promise.all([
    supabase.from("invoices").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    org.name ? supabase.from("invoices").select("*").ilike("client_name", org.name).is("organization_id", null).order("created_at", { ascending: false }) : { data: [] },
  ]);
  const seen = new Set<string>();
  const invoices = [...(byOrg.data || []), ...(byName.data || [])].filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const outstanding = all.filter((i) => i.status === "sent" || i.status === "overdue");
  const overdue = all.filter((i) => i.status === "overdue");

  const totalPaid = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalOutstanding = outstanding.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalOverdue = overdue.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <BackButton label="Back" />
        <Link href={`/admin/clients/${orgId}`} className="text-[11px] font-semibold text-[var(--gold)] hover:underline">
          View client profile
        </Link>
      </div>

      <h1 className="font-heading text-[22px] font-bold text-[var(--tx)] mb-1">{org.name}</h1>
      <p className="text-[12px] text-[var(--tx3)] mb-6">Revenue and invoices for this client</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total paid</div>
          <div className="text-lg font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(totalPaid)}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-lg font-bold font-heading text-[var(--gold)]">{formatCompactCurrency(totalOutstanding)}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Past due</div>
          <div className="text-lg font-bold font-heading text-[var(--red)]">{formatCompactCurrency(totalOverdue)}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Invoices</div>
          <div className="text-lg font-bold font-heading">{all.length}</div>
        </div>
      </div>

      {/* All invoices */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--brd)]">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">All invoices</h3>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5">Paid, sent, and overdue</p>
        </div>
        <div className="divide-y divide-[var(--brd)]">
          {all.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">No invoices for this client</div>
          ) : (
            all.map((inv) => (
              <Link
                key={inv.id}
                href={inv.move_id ? getMoveDetailPath({ id: inv.move_id }) : "/admin/invoices"}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--gdim)]/30 transition-colors"
              >
                <div>
                  <div className="text-[12px] font-semibold text-[var(--tx)]">{inv.invoice_number}</div>
                  <div className="text-[10px] text-[var(--tx3)]">Due {inv.due_date || "—"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-[var(--tx)]">{formatCurrency(Number(inv.amount || 0))}</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                      inv.status === "paid" ? "bg-[var(--grdim)] text-[var(--grn)]" : inv.status === "overdue" ? "bg-[var(--rdim)] text-[var(--red)]" : "bg-[var(--gdim)] text-[var(--gold)]"
                    }`}
                  >
                    {inv.status || "—"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
