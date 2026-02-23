"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CreateInvoiceModal from "./CreateInvoiceModal";
import AdminInvoiceDetailModal from "./AdminInvoiceDetailModal";
import InvoicesTable from "./InvoicesTable";
import { ToastProvider } from "../components/Toast";

interface InvoicesPageClientProps {
  invoices: any[];
}

export default function InvoicesPageClient({ invoices }: InvoicesPageClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<typeof invoices[0] | null>(null);

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
        <div className="overflow-x-auto">
          <InvoicesTable invoices={invoices} onRowClick={(inv) => setDetailInvoice(inv)} />
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
