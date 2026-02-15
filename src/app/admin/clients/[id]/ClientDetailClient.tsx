"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "../../components/Badge";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import EditPartnerModal from "./EditPartnerModal";

interface ClientDetailClientProps {
  client: any;
  deliveries: any[];
  allInvoices: any[];
  outstandingTotal: number;
  partnerSince: Date | null;
  partnerDuration: string | null;
  backHref: string;
  isAdmin?: boolean;
}

export default function ClientDetailClient({
  client,
  deliveries,
  allInvoices,
  outstandingTotal,
  partnerSince,
  partnerDuration,
  backHref,
  isAdmin,
}: ClientDetailClientProps) {
  const router = useRouter();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3 transition-colors">
        ← Back
      </Link>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="font-heading text-xl">{client.name}</div>
          <div className="text-[10px] text-[var(--tx3)]">
          {client.type} •{" "}
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="text-[var(--gold)] hover:underline font-medium"
          >
            {client.contact_name}
          </button>
          {" • "}{client.email}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditModalOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            Edit partner
          </button>
        )}
      </div>

      {/* Partner since card */}
      {partnerSince && (
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Partner since</div>
          <div className="text-[15px] font-bold font-heading text-[var(--tx)]">
            {partnerSince.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            {partnerDuration && (
              <span className="text-[11px] font-normal text-[var(--tx3)] ml-2">({partnerDuration})</span>
            )}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
          <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Deliveries/Mo</div>
          <div className="text-lg font-bold font-heading">{client.deliveries_per_month}</div>
        </div>
        <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
          <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Outstanding</div>
          <div className={`text-lg font-bold font-heading ${client.outstanding_balance > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
            {client.outstanding_balance > 0 ? `$${Number(client.outstanding_balance).toLocaleString()}` : "$0"}
          </div>
        </div>
        <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
          <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Health</div>
          <div className={`w-2.5 h-2.5 rounded-full mt-1 ${client.health === "good" ? "bg-[var(--grn)]" : "bg-[var(--org)]"}`} />
        </div>
      </div>

      {/* Recent Deliveries */}
      <h3 className="text-[13px] font-bold mb-2">Recent Deliveries</h3>
      <div className="flex flex-col gap-1 mb-4">
        {deliveries.map((d) => (
          <Link
            key={d.id}
            href={`/admin/deliveries/${d.id}`}
            className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold truncate">{d.customer_name}</div>
              <div className="text-[9px] text-[var(--tx3)]">{d.delivery_number} • {d.items?.length || 0} items</div>
            </div>
            <div className="text-[10px] text-[var(--tx3)]">{d.scheduled_date}</div>
            <Badge status={d.status} />
          </Link>
        ))}
        {deliveries.length === 0 && (
          <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No deliveries yet</div>
        )}
      </div>

      {/* Invoices */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-bold">Invoices</h3>
        {outstandingTotal > 0 && (
          <div className="text-[11px] font-semibold text-[var(--org)]">
            Outstanding: ${outstandingTotal.toLocaleString()}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {allInvoices.map((inv) => (
          <Link key={inv.id} href="/admin/invoices" className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all">
            <div className="flex-1">
              <div className="text-[11px] font-semibold">{inv.invoice_number}</div>
              <div className="text-[9px] text-[var(--tx3)]">Due: {inv.due_date}</div>
            </div>
            <div className="text-[10px] font-bold">${Number(inv.amount).toLocaleString()}</div>
            <Badge status={inv.status} />
          </Link>
        ))}
        {allInvoices.length === 0 && (
          <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No invoices yet</div>
        )}
      </div>

      <ContactDetailsModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contact={{
          name: client.contact_name || client.name,
          email: client.email,
          phone: client.phone,
          company: client.name,
        }}
      />
      {isAdmin && (
        <EditPartnerModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          client={client}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
