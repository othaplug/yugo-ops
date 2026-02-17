"use client";

import Link from "next/link";
import Badge from "../../components/Badge";
import ModalOverlay from "../../components/ModalOverlay";
import { formatCurrency } from "@/lib/format-currency";

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
    <ModalOverlay open={open} onClose={onClose} title="Invoice details" maxWidth="md">
      <div className="p-5 space-y-3 text-[12px]">
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
          <div className="text-[var(--gold)] font-bold text-lg">{formatCurrency(invoice.amount ?? 0)}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Due date</div>
          <div className="text-[var(--tx)]">{invoice.due_date || "—"}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Status</div>
          <Badge status={invoice.status} />
        </div>
        <Link
          href="/admin/invoices"
          className="mt-4 inline-block w-full text-center py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
        >
          View all invoices →
        </Link>
      </div>
    </ModalOverlay>
  );
}
