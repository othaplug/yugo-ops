"use client";

import Link from "next/link";
import Badge from "../../components/Badge";

interface InvoiceDetailModalProps {
  open: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoice_number?: string;
    client_name?: string;
    amount?: number;
    due_date?: string;
    status: string;
  } | null;
}

export default function InvoiceDetailModal({ open, onClose, invoice }: InvoiceDetailModalProps) {
  if (!open || !invoice) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-md p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Invoice details</h3>
          <button type="button" onClick={onClose} className="text-[var(--tx3)] hover:text-[var(--tx)] text-lg leading-none">&times;</button>
        </div>
        <div className="space-y-3 text-[12px]">
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Invoice #</div>
            <div className="text-[var(--tx)] font-semibold font-mono">{invoice.invoice_number}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Client</div>
            <div className="text-[var(--tx)]">{invoice.client_name || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Amount</div>
            <div className="text-[var(--gold)] font-bold text-lg">${Number(invoice.amount || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Due date</div>
            <div className="text-[var(--tx)]">{invoice.due_date || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Status</div>
            <Badge status={invoice.status} />
          </div>
        </div>
        <Link
          href="/admin/invoices"
          className="mt-4 inline-block w-full text-center py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
        >
          View all invoices →
        </Link>
      </div>
    </div>
  );
}
