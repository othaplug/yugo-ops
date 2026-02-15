import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import Badge from "../components/Badge";
import InvoiceActions from "./InvoiceActions";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const outstanding = all.filter((i) => i.status === "sent" || i.status === "overdue");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Invoices</div>
          <div className="text-xl font-bold font-heading">{all.length}</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Paid</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">${(paidTotal / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">${(outstandingTotal / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/deliveries/new" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all flex items-center justify-center">
          <span className="text-[10px] font-semibold text-[var(--gold)]">+ New Invoice</span>
        </Link>
      </div>

      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">All Invoices</h3>
          <Link href="/admin/deliveries" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
            View deliveries →
          </Link>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Invoice</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Client</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Amount</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Due</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Status</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]"></th>
            </tr>
          </thead>
          <tbody>
            {all.map((inv) => (
              <tr key={inv.id} className="hover:bg-[var(--gdim)] transition-colors">
                <td className="px-4 py-2.5 text-[10px] font-semibold font-mono border-b border-[var(--brd)]">
                  {inv.invoice_number}
                </td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">
                  <Link href="/admin/clients" className="hover:text-[var(--gold)] transition-colors">
                    {inv.client_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[10px] font-bold border-b border-[var(--brd)]">
                  ${Number(inv.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">
                  {inv.due_date}
                </td>
                <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                  <Badge status={inv.status} />
                </td>
                <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                  <InvoiceActions invoiceId={inv.id} status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}