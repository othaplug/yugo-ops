"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import Badge from "../../components/Badge";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import EditPartnerModal from "./EditPartnerModal";
import DeliverySummaryModal from "./DeliverySummaryModal";
import PartnerPaymentTermsSection from "./PartnerPaymentTermsSection";
import PartnerCardOnFileSection from "./PartnerCardOnFileSection";
import PortalAccessSection from "./PortalAccessSection";
import PartnerRateCardTab from "./PartnerRateCardTab";
import AdminPartnerAnalytics from "./AdminPartnerAnalytics";
import PartnerPortalFeaturesCard from "@/components/admin/PartnerPortalFeaturesCard";
import InvoiceDetailModal from "./InvoiceDetailModal";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { formatJobId, getMoveCode, getMoveDetailPath } from "@/lib/move-code";
import { getStatusLabel } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import { ScheduleDeliveryButton, ScheduleMoveItem } from "../../components/ScheduleItem";

interface MoveRow {
  id: string;
  move_number?: string | null;
  client_name?: string | null;
  status?: string | null;
  stage?: string | null;
  scheduled_date?: string | null;
  created_at?: string | null;
}

interface ChangeRequestRow {
  id: string;
  move_id: string;
  type: string;
  description: string;
  status: string;
  urgency?: string;
  created_at: string;
  moves?: { move_code?: string; client_name?: string } | { move_code?: string; client_name?: string }[];
}

interface ClientDetailClientProps {
  client: any;
  deliveries: any[];
  moves: MoveRow[];
  changeRequests?: ChangeRequestRow[];
  allInvoices: any[];
  outstandingTotal: number;
  partnerSince: Date | null;
  partnerDuration: string | null;
  backHref: string;
  isAdmin?: boolean;
  squareAppId?: string;
  squareLocationId?: string;
}

export default function ClientDetailClient({
  client,
  deliveries,
  moves,
  changeRequests = [],
  allInvoices,
  outstandingTotal,
  partnerSince,
  partnerDuration,
  backHref,
  isAdmin,
  squareAppId = "",
  squareLocationId = "",
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
  const [activeTab, setActiveTab] = useState<"overview" | "rate-card" | "analytics" | "portal">("overview");

  useEffect(() => {
    if (searchParams.get("edit") === "1") setEditModalOpen(true);
    if (searchParams.get("tab") === "rate-card") setActiveTab("rate-card");
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
      <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-4 transition-colors">
        ← Back
      </button>

      <div className="mb-4">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60">CRM · Client Profile</p>
      </div>

      {/* Hero + actions */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-[22px] md:text-[24px] font-bold text-[var(--tx)] break-words line-clamp-3">{client.name}</h1>
              <span className={`inline-flex px-2.5 py-[3px] rounded text-[9px] font-bold ${isClient ? "bg-[var(--bldim)] text-[var(--blue)]" : "bg-[var(--gdim)] text-[var(--gold)]"}`}>
                {personaLabel}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--tx2)]">
              <span className="capitalize font-medium text-[var(--gold)]">{isClient ? "Move" : (client.type ?? "-")}</span>
              <button type="button" onClick={() => setContactModalOpen(true)} className="text-[var(--gold)] hover:underline font-medium">
                {client.contact_name || "-"}
              </button>
              <a href={`mailto:${client.email}`} className="text-[var(--tx2)] hover:text-[var(--gold)] truncate">{client.email || "-"}</a>
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
              className="px-3 py-1 rounded text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
            >
              Delete
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Portal Access, partners only */}
      {!isClient && isAdmin && <PortalAccessSection orgId={client.id} orgName={client.name || ""} />}

      {/* Tab bar, partners only */}
      {!isClient && isAdmin && (
        <div className="flex gap-0.5 border-b border-[var(--brd)] mb-0 -mx-0">
          {(["overview", "rate-card", "analytics", "portal"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-[10px] font-bold tracking-[0.08em] uppercase transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-[var(--gold)] text-[var(--gold)]"
                  : "border-transparent text-[var(--tx3)] hover:text-[var(--tx2)]"
              }`}
            >
              {tab === "overview" ? "Overview" : tab === "rate-card" ? "Rate Card" : tab === "analytics" ? "Analytics" : "Portal"}
            </button>
          ))}
        </div>
      )}

      {/* Rate Card tab content */}
      {!isClient && isAdmin && activeTab === "rate-card" && (
        <PartnerRateCardTab orgId={client.id} orgName={client.name || ""} />
      )}

      {/* Analytics tab content */}
      {!isClient && isAdmin && activeTab === "analytics" && (
        <AdminPartnerAnalytics orgId={client.id} orgName={client.name || ""} />
      )}

      {/* Portal Features tab content */}
      {!isClient && isAdmin && activeTab === "portal" && (
        <div className="pt-6 space-y-6">
          <PartnerCardOnFileSection
            orgId={client.id}
            squareCardId={client.square_card_id}
            cardLastFour={client.card_last_four}
            cardBrand={client.card_brand}
            cardOnFile={client.card_on_file}
            squareAppId={squareAppId}
            squareLocationId={squareLocationId}
            onSaved={() => router.refresh()}
          />
          <PartnerPaymentTermsSection
            orgId={client.id}
            orgName={client.name || "Partner"}
            initialInvoiceDueDays={client.invoice_due_days ?? 30}
            initialInvoiceDueDayOfMonth={client.invoice_due_day_of_month ?? null}
            onSaved={() => router.refresh()}
          />
          <PartnerPortalFeaturesCard
            orgId={client.id}
            vertical={client.vertical}
            initialFeatures={client.portal_features}
          />
        </div>
      )}

      {/* Overview content, hidden when rate card tab active */}
      {(isClient || !isAdmin || activeTab === "overview") && (
        <>

      {/* Overview + since */}
      <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Overview</div>
        <div className="grid md:grid-cols-2 gap-6">
          {partnerSince && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">{personaLabel} since</div>
              <div className="text-[15px] font-bold font-heading text-[var(--tx)]">
                {partnerSince.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                {partnerDuration && (
                  <span className="text-[11px] font-normal text-[var(--tx3)] ml-2">({partnerDuration})</span>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">{isClient ? "Type" : "Partner type"}</div>
            <div className="text-[13px] font-semibold text-[var(--tx)] capitalize">{isClient ? "Move" : (client.type ?? "-")}</div>
            {client.address && (
              <>
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mt-3 mb-1">Address</div>
                <div className="text-[12px] text-[var(--tx2)]">{client.address}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* High-level metrics */}
      <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Metrics</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-6">
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">{isClient ? "Moves" : "Projects"}</div>
            <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--tx)]">{isClient ? moves.length : deliveries.length}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">AVG DEL</div>
            <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--tx)]">{client.deliveries_per_month ?? "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Total paid</div>
            <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(paidTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Outstanding</div>
            <div className={`text-[18px] md:text-[20px] font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
              {outstandingTotal > 0 ? formatCompactCurrency(outstandingTotal) : formatCompactCurrency(0)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Invoices</div>
            <div className="text-[18px] md:text-[20px] font-bold font-heading text-[var(--tx)]">{allInvoices.length} <span className="text-[11px] font-normal text-[var(--tx3)]">({paidInvoices.length} paid)</span></div>
          </div>
        </div>
      </div>

      {/* Recent moves (B2C) or Recent projects (partners) */}
      <div className="border-t border-[var(--brd)]/30 pt-6 pb-4">
        <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">{isClient ? "Recent moves" : "Recent projects"}</h3>
        <div className="divide-y divide-[var(--brd)]/30 -mx-2">
          {isClient ? (
          moves.length === 0 ? (
            <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No moves yet</div>
          ) : (
            moves.map((m, idx) => (
              <ScheduleMoveItem
                key={m.id}
                href={getMoveDetailPath(m)}
                leftPrimary={String(idx + 1).padStart(2, "0")}
                leftSecondary={formatMoveDate(m.scheduled_date || (m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : null))}
                status={getStatusLabel(m.status ?? null)}
                title={m.client_name || m.move_number || "Move"}
                subtitle={m.move_number ?? getMoveCode(m as { move_code?: string | null; id?: string | null })}
              />
            ))
          )
        ) : (
          <>
            {deliveries.map((d) => (
              <ScheduleDeliveryButton
                key={d.id}
                onClick={() => setSummaryDelivery(d)}
                timeSlot={d.time_slot || "-"}
                pill={`${d.items?.length || 0} items`}
                status={toTitleCase(d.status || "")}
                title={d.customer_name}
                subtitle={`${d.delivery_number} • ${d.client_name}`}
              />
            ))}
            {deliveries.length === 0 && (
              <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No deliveries yet</div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Change requests (client-submitted) */}
      {changeRequests.length > 0 && (
        <div className="border-t border-[var(--brd)]/30 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Change requests</h3>
            <Link href="/admin/change-requests" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-[var(--brd)]/30">
            {changeRequests.slice(0, 5).map((cr) => {
              const moveData = Array.isArray(cr.moves) ? cr.moves[0] : cr.moves;
              const moveCode = moveData?.move_code ? formatJobId(moveData.move_code, "move") : "-";
              return (
                <Link
                  key={cr.id}
                  href={getMoveDetailPath({ move_code: moveData?.move_code, id: cr.move_id })}
                  className="flex items-center gap-2.5 py-3 first:pt-0 hover:text-[var(--gold)] transition-colors text-left w-full"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-[var(--tx)]">{cr.type}</div>
                    <div className="text-[9px] text-[var(--tx3)] line-clamp-1">{cr.description}</div>
                  </div>
                  <span className="text-[9px] text-[var(--tx3)] shrink-0">{moveCode}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    cr.status === "pending" ? "bg-[var(--gdim)] text-[var(--gold)]" : cr.status === "approved" ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--rdim)] text-[var(--red)]"
                  }`}>
                    {toTitleCase(cr.status)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices - click opens detail popup */}
      <div className="border-t border-[var(--brd)]/30 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Invoices</h3>
          {outstandingTotal > 0 && (
            <div className="text-[11px] font-semibold text-[var(--org)]">
              Outstanding: {formatCompactCurrency(outstandingTotal)}
            </div>
          )}
        </div>
        <div className="divide-y divide-[var(--brd)]/30">
          {allInvoices.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => setSummaryInvoice(inv)}
              className="flex items-center gap-2.5 py-3 first:pt-0 hover:text-[var(--gold)] transition-colors text-left w-full"
            >
              <div className="flex-1">
                <div className="text-[11px] font-semibold">{inv.invoice_number}</div>
                <div className="text-[9px] text-[var(--tx3)]">Due: {inv.due_date}</div>
              </div>
              <div className="text-[10px] font-bold">{formatCurrency(inv.amount)}{Number(inv.amount) > 0 ? <span className="text-[9px] text-[var(--tx3)] ml-0.5">+{formatCurrency(Math.round(Number(inv.amount) * 0.13))} HST</span> : null}</div>
              <Badge status={inv.status} />
            </button>
          ))}
          {allInvoices.length === 0 && (
            <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No invoices yet</div>
          )}
        </div>
      </div>

        </>
      )}

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
