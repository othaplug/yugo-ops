"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import CreateInvoiceModal from "./CreateInvoiceModal";
import AdminInvoiceDetailModal from "./AdminInvoiceDetailModal";
import InvoicesTable from "./InvoicesTable";
import { ToastProvider } from "../components/Toast";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

interface InvoicesPageClientProps {
  invoices: any[];
}

export default function InvoicesPageClient({ invoices }: InvoicesPageClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<typeof invoices[0] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") return invoices;
    return invoices.filter((inv) => (inv.status || "").toLowerCase() === statusFilter);
  }, [invoices, statusFilter]);

  return (
    <ToastProvider>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-[var(--brd)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-heading text-[15px] font-bold text-[var(--tx)]">All Invoices</h3>
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-[var(--tx3)]">Create and manage invoices.</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
            >
              + Create Invoice
            </button>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-[var(--brd)] flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                statusFilter === f.value
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "bg-[var(--bg)] text-[var(--tx2)] hover:bg-[var(--bg2)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <InvoicesTable invoices={filteredInvoices} onRowClick={(inv) => setDetailInvoice(inv)} />
        </div>
      </div>
      <CreateInvoiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => router.refresh()}
      />
      <AdminInvoiceDetailModal
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        invoice={detailInvoice}
        onSaved={() => router.refresh()}
      />
    </ToastProvider>
  );
}
