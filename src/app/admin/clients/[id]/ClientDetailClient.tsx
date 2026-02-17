"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import Badge from "../../components/Badge";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import EditPartnerModal from "./EditPartnerModal";
import DeliverySummaryModal from "./DeliverySummaryModal";
import InvoiceDetailModal from "./InvoiceDetailModal";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";

interface MoveRow {
  id: string;
  move_number?: string | null;
  client_name?: string | null;
  status?: string | null;
  stage?: string | null;
  scheduled_date?: string | null;
  created_at?: string | null;
}

interface ClientDetailClientProps {
  client: any;
  deliveries: any[];
  moves: MoveRow[];
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
  moves,
  allInvoices,
  outstandingTotal,
  partnerSince,
  partnerDuration,
  backHref,
  isAdmin,
}: ClientDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resendPortalLoading, setResendPortalLoading] = useState(false);
  const [summaryDelivery, setSummaryDelivery] = useState<typeof deliveries[0] | null>(null);
  const [summaryInvoice, setSummaryInvoice] = useState<typeof allInvoices[0] | null>(null);

  useEffect(() => {
    if (searchParams.get("edit") === "1") setEditModalOpen(true);
  }, [searchParams]);

  const paidInvoices = allInvoices.filter((i) => i.status === "paid");
  const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  const isClient = client.type === "b2c";
  const personaLabel = isClient ? "Client" : "Partner";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${client.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast("Client deleted", "check");
      setDeleteConfirmOpen(false);
      router.push(backHref);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "x");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-4 transition-colors">
        ← Back
      </Link>

      {/* Hero + actions */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-[22px] md:text-[24px] font-bold text-[var(--tx)] truncate">{client.name}</h1>
              <span className={`inline-flex px-2.5 py-[3px] rounded text-[9px] font-bold ${isClient ? "bg-[var(--bldim)] text-[var(--blue)]" : "bg-[var(--gdim)] text-[var(--gold)]"}`}>
                {personaLabel}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--tx2)]">
              <span className="capitalize font-medium text-[var(--gold)]">{isClient ? "Move" : (client.type ?? "—")}</span>
              <button type="button" onClick={() => setContactModalOpen(true)} className="text-[var(--gold)] hover:underline font-medium">
                {client.contact_name || "—"}
              </button>
              <a href={`mailto:${client.email}`} className="text-[var(--tx2)] hover:text-[var(--gold)] truncate">{client.email || "—"}</a>
              {client.address && <span className="text-[var(--tx3)] truncate">{client.address}</span>}
            </div>
          </div>
          {isAdmin && (
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {isClient ? (
              <button
                type="button"
                onClick={async () => {
                  const moveId = moves[0]?.id;
                  if (!moveId) {
                    toast("No move yet. Create a move first.", "x");
                    return;
                  }
                  if (!client.email?.trim()) {
                    toast("Add client email first (Edit).", "x");
                    return;
                  }
                  setResendPortalLoading(true);
                  try {
                    const res = await fetch(`/api/moves/${moveId}/send-tracking-link`, { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to send");
                    toast("Tracking link sent.", "mail");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Failed to send", "x");
                  } finally {
                    setResendPortalLoading(false);
                  }
                }}
                disabled={resendPortalLoading || !client.email?.trim() || moves.length === 0}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all disabled:opacity-50"
              >
                {resendPortalLoading ? "Sending…" : "Send tracking link"}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  if (!client.email?.trim()) {
                    toast("Add partner email first (Edit).", "x");
                    return;
                  }
                  setResendPortalLoading(true);
                  try {
                    const res = await fetch(`/api/admin/organizations/${client.id}/resend-portal`, { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to send");
                    toast("Partner portal access sent.", "mail");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Failed to send", "x");
                  } finally {
                    setResendPortalLoading(false);
                  }
                }}
                disabled={resendPortalLoading || !client.email?.trim()}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all disabled:opacity-50"
              >
                {resendPortalLoading ? "Sending…" : "Resend portal access"}
              </button>
            )}
            <button
              onClick={() => setEditModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              Edit {isClient ? "client" : "partner"}
            </button>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--red)] text-[var(--red)] hover:bg-[var(--rdim)] transition-all"
            >
              Delete
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Overview + since */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {partnerSince && (
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{personaLabel} since</div>
            <div className="text-[15px] font-bold font-heading text-[var(--tx)]">
              {partnerSince.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              {partnerDuration && (
                <span className="text-[11px] font-normal text-[var(--tx3)] ml-2">({partnerDuration})</span>
              )}
            </div>
          </div>
        )}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{isClient ? "Type" : "Partner type"}</div>
          <div className="text-[13px] font-semibold text-[var(--tx)] capitalize">{isClient ? "Move" : (client.type ?? "—")}</div>
          {client.address && (
            <>
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mt-2 mb-1">Address</div>
              <div className="text-[12px] text-[var(--tx2)]">{client.address}</div>
            </>
          )}
        </div>
      </div>

      {/* High-level metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)]/50 transition-colors">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{isClient ? "Moves" : "Projects"}</div>
          <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--tx)]">{isClient ? moves.length : deliveries.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)]/50 transition-colors">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">AVG DEL</div>
          <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--tx)]">{client.deliveries_per_month ?? "—"}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)]/50 transition-colors">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Total paid</div>
          <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--grn)]">${(paidTotal / 1000).toFixed(1)}K</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 hover:border-[var(--gold)]/50 transition-colors">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className={`text-[18px] md:text-[20px] font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
            {outstandingTotal > 0 ? `$${outstandingTotal.toLocaleString()}` : "$0"}
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Invoices</div>
          <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--tx)]">{allInvoices.length} <span className="text-[11px] font-normal text-[var(--tx3)]">({paidInvoices.length} paid)</span></div>
        </div>
      </div>

      {/* Recent moves (B2C) or Recent projects (partners) */}
      <h3 className="text-[13px] font-bold mb-2">{isClient ? "Recent moves" : "Recent projects"}</h3>
      <div className="flex flex-col gap-1 mb-4">
        {isClient ? (
          moves.length === 0 ? (
            <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No moves yet</div>
          ) : (
            moves.map((m) => (
              <Link
                key={m.id}
                href={`/admin/moves/${m.id}`}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all text-left w-full"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{m.client_name || m.move_number || "Move"}</div>
                  <div className="text-[9px] text-[var(--tx3)]">{m.move_number ?? m.id}</div>
                </div>
                <div className="text-[10px] text-[var(--tx3)]">{m.scheduled_date || (m.created_at ? new Date(m.created_at).toLocaleDateString() : "—")}</div>
                <Badge status={m.status ?? m.stage ?? "—"} />
              </Link>
            ))
          )
        ) : (
          <>
            {deliveries.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSummaryDelivery(d)}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all text-left w-full"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{d.customer_name}</div>
                  <div className="text-[9px] text-[var(--tx3)]">{d.delivery_number} • {d.items?.length || 0} items</div>
                </div>
                <div className="text-[10px] text-[var(--tx3)]">{d.scheduled_date}</div>
                <Badge status={d.status} />
              </button>
            ))}
            {deliveries.length === 0 && (
              <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No deliveries yet</div>
            )}
          </>
        )}
      </div>

      {/* Invoices - click opens detail popup */}
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
          <button
            key={inv.id}
            type="button"
            onClick={() => setSummaryInvoice(inv)}
            className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all text-left w-full"
          >
            <div className="flex-1">
              <div className="text-[11px] font-semibold">{inv.invoice_number}</div>
              <div className="text-[9px] text-[var(--tx3)]">Due: {inv.due_date}</div>
            </div>
            <div className="text-[10px] font-bold">${Number(inv.amount).toLocaleString()}</div>
            <Badge status={inv.status} />
          </button>
        ))}
        {allInvoices.length === 0 && (
          <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No invoices yet</div>
        )}
      </div>

      <DeliverySummaryModal open={!!summaryDelivery} onClose={() => setSummaryDelivery(null)} delivery={summaryDelivery} />
      <InvoiceDetailModal open={!!summaryInvoice} onClose={() => setSummaryInvoice(null)} invoice={summaryInvoice} />

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
      {typeof document !== "undefined" &&
        deleteConfirmOpen &&
        createPortal(
          <ModalOverlay open onClose={() => setDeleteConfirmOpen(false)} title="Delete client?" maxWidth="sm">
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[var(--tx2)]">
                This will remove the client from the list. Linked moves or invoices will not be deleted. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </ModalOverlay>,
          document.body
        )}
    </div>
  );
}
