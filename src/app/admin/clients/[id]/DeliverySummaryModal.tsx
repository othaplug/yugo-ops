"use client";

import Link from "next/link";
import Badge from "../../components/Badge";
import ModalOverlay from "../../components/ModalOverlay";

interface DeliverySummaryModalProps {
  open: boolean;
  onClose: () => void;
  delivery: {
    id: string;
    delivery_number?: string;
    customer_name?: string;
    delivery_address?: string;
    pickup_address?: string;
    scheduled_date?: string;
    delivery_window?: string;
    status: string;
    items?: unknown[];
  } | null;
}

export default function DeliverySummaryModal({ open, onClose, delivery }: DeliverySummaryModalProps) {
  if (!open || !delivery) return null;
  const itemCount = Array.isArray(delivery.items) ? delivery.items.length : 0;
  return (
    <ModalOverlay open={open} onClose={onClose} title="Project summary" maxWidth="md">
      <div className="p-5 space-y-3 text-[12px]">
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Project #</div>
          <div className="text-[var(--tx)] font-semibold font-mono">{delivery.delivery_number}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Customer</div>
          <div className="text-[var(--tx)]">{delivery.customer_name || "—"}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Delivery address</div>
          <div className="text-[var(--tx2)]">{delivery.delivery_address || "—"}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Date</div>
          <div className="text-[var(--tx)]">{delivery.scheduled_date || "—"} {delivery.delivery_window && ` • ${delivery.delivery_window}`}</div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Status</span>
          <Badge status={delivery.status} />
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Items</div>
          <div className="text-[var(--tx)]">{itemCount} items</div>
        </div>
        <Link href={`/admin/deliveries/${delivery.id}`} className="mt-4 inline-block w-full text-center py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all">
          View full project →
        </Link>
      </div>
    </ModalOverlay>
  );
}
