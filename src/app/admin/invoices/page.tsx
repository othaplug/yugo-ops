import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";
import Badge from "../components/Badge";
import InvoiceActions from "./InvoiceActions";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  const all = invoices || [];

  return (
    <>
      <Topbar title="Invoices" subtitle="Billing & payments" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Invoice</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Client</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Amount</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Due</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Status</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]"></th>
              </tr>
            </thead>
            <tbody>
              {all.map((inv) => (
                <tr key={inv.id} className="hover:bg-[var(--gdim)] transition-colors">
                  <td className="px-3 py-2 text-[10px] font-semibold font-mono border-b border-[var(--brd)]">
                    {inv.invoice_number}
                  </td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">
                    {inv.client_name}
                  </td>
                  <td className="px-3 py-2 text-[10px] font-bold border-b border-[var(--brd)]">
                    ${Number(inv.amount).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">
                    {inv.due_date}
                  </td>
                  <td className="px-3 py-2 border-b border-[var(--brd)]">
                    <Badge status={inv.status} />
                  </td>
                  <td className="px-3 py-2 border-b border-[var(--brd)]">
                    <InvoiceActions invoiceId={inv.id} status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}