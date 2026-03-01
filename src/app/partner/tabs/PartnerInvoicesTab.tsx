"use client";

import { formatCurrency } from "@/lib/format-currency";

interface Invoice {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-50 text-green-700",
  sent: "bg-blue-50 text-blue-700",
  overdue: "bg-red-50 text-red-700",
  draft: "bg-gray-50 text-gray-600",
};

export default function PartnerInvoicesTab({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white border border-[#E8E4DF] rounded-xl p-8 text-center">
        <p className="text-[14px] text-[#888]">No invoices yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E8E4DF] rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#E8E4DF]">
            <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Invoice</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Date</th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Due</th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider uppercase text-[#888]">Amount</th>
            <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider uppercase text-[#888]">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const badgeClass = STATUS_BADGE[(inv.status || "").toLowerCase()] || "bg-gray-50 text-gray-600";
            return (
              <tr key={inv.id} className="border-b border-[#E8E4DF] last:border-0 hover:bg-[#FAF8F5] transition-colors">
                <td className="px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]">
                  {inv.invoice_number || `INV-${inv.id.slice(0, 6)}`}
                </td>
                <td className="px-4 py-3 text-[12px] text-[#888]">
                  {inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3 text-[12px] text-[#888]">
                  {inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold text-[#1A1A1A] text-right">
                  {formatCurrency(inv.amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${badgeClass}`}>
                    {inv.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
