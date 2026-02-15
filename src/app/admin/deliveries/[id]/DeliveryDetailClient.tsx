"use client";

import { useState } from "react";
import Link from "next/link";
import EditDeliveryModal from "./EditDeliveryModal";
import NotifyClientButton from "./NotifyClientButton";
import DownloadPDFButton from "./DownloadPDFButton";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import LiveTrackingMap from "./LiveTrackingMap";

const PROGRESS_STEPS = ["pending", "confirmed", "in-transit", "delivered"] as const;
const PROGRESS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  "in-transit": "In Transit",
  delivered: "Completed",
  cancelled: "Cancelled",
};

const CATEGORY_STYLES: Record<string, { borderClass: string }> = {
  retail: { borderClass: "border-l-4 border-l-[var(--gold)]" },
  designer: { borderClass: "border-l-4 border-l-[#B8860B]" },
  hospitality: { borderClass: "border-l-4 border-l-[#D48A29]" },
  gallery: { borderClass: "border-l-4 border-l-[#4A7CE5]" },
  b2c: { borderClass: "border-l-4 border-l-[#2D9F5A]" },
};

export default function DeliveryDetailClient({ delivery }: { delivery: any }) {
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const statusColorMap: Record<string, string> = {
    pending: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
    confirmed: "text-[var(--blue)] bg-[rgba(59,130,246,0.1)]",
    "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
    delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
    cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
  };
  const statusColor = statusColorMap[delivery.status] || "text-[var(--tx3)] bg-[var(--card)]";

  const currentStepIdx = PROGRESS_STEPS.indexOf(delivery.status as typeof PROGRESS_STEPS[number]);
  const progressPercent = delivery.status === "cancelled" ? 0 : currentStepIdx >= 0 ? ((currentStepIdx + 1) / PROGRESS_STEPS.length) * 100 : 25;
  const categoryStyle = CATEGORY_STYLES[delivery.category] || CATEGORY_STYLES.retail;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 space-y-5 animate-fade-up">
      <Link href="/admin/deliveries" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Projects
      </Link>

      {/* Header Card - partner-specific accent */}
      <div className={`bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 ${categoryStyle.borderClass}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">{delivery.delivery_number}</h1>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
                {delivery.status}
              </span>
              {delivery.scheduled_date && (
                <span className="px-2.5 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-wider bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx2)]">
                  Scheduled
                </span>
              )}
              {delivery.special_handling && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 animate-pulse">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Special Handling Required
                </span>
              )}
            </div>
            <div className="text-[12px] text-[var(--tx3)]">
              Created {new Date(delivery.created_at).toLocaleDateString()} • Customer:{" "}
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="text-[var(--gold)] hover:underline font-medium"
              >
                {delivery.customer_name}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 [&_button]:min-h-[44px] [&_button]:touch-manipulation">
            <EditDeliveryModal delivery={delivery} open={editModalOpen} onOpenChange={setEditModalOpen} />
            <button onClick={() => setEditModalOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all">
              Edit
            </button>
            <NotifyClientButton delivery={delivery} />
            <DownloadPDFButton delivery={delivery} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 pt-4 border-t border-[var(--brd)]">
          <h3 className="font-heading text-[11px] font-bold text-[var(--tx3)] mb-2 uppercase tracking-wider">Progress</h3>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--gold)] rounded-full transition-all duration-700 ease-out animate-progress-shimmer"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-[var(--gold)]">
              {PROGRESS_LABELS[delivery.status] || delivery.status}
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-[var(--tx3)]">
            {PROGRESS_STEPS.map((s) => (
              <span key={s} className={delivery.status === s ? "text-[var(--gold)] font-semibold" : ""}>
                {PROGRESS_LABELS[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Team assigned */}
        {delivery.crew_id && (
          <div className="mt-3 pt-3 border-t border-[var(--brd)]">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Team Assigned</div>
            <div className="text-[13px] text-[var(--tx)]">{delivery.crew_name || `Team ${delivery.crew_id}`}</div>
          </div>
        )}
      </div>

      {/* Live Crew Tracking Map */}
      {delivery.crew_id && (
        <LiveTrackingMap
          crewId={delivery.crew_id}
          crewName={delivery.crew_name}
        />
      )}

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Customer Info - clickable */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" onClick={() => setEditModalOpen(true)} className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" aria-label="Edit customer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Customer Information</h3>
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="w-full text-left space-y-3 hover:opacity-90 transition-opacity"
          >
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Name</div>
              <div className="text-[13px] text-[var(--gold)] font-medium">{delivery.customer_name}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Email</div>
              <div className="text-[13px] text-[var(--tx)]">{delivery.customer_email || "Not provided"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Phone</div>
              <div className="text-[13px] text-[var(--tx)]">{delivery.customer_phone || "Not provided"}</div>
            </div>
            <div className="text-[10px] text-[var(--gold)] pt-1">Click to view contact details</div>
          </button>
        </div>

        {/* Delivery Info */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" onClick={() => setEditModalOpen(true)} aria-label="Edit delivery details">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Delivery Details</h3>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Scheduled Date</div>
              <div className="text-[13px] text-[var(--tx)]">{delivery.scheduled_date || "Not scheduled"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Pickup Address</div>
              <div className="text-[13px] text-[var(--tx)]">{delivery.pickup_address || "Not specified"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Delivery Address</div>
              <div className="text-[13px] text-[var(--tx)]">{delivery.delivery_address || "Not specified"}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" onClick={() => setEditModalOpen(true)} aria-label="Edit items">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Items</h3>
          {delivery.items && delivery.items.length > 0 ? (
            <ul className="space-y-2">
              {(delivery.items as Array<string | { name: string; qty?: number }>).map((item, idx) => {
                const name = typeof item === "string" ? item : item?.name || "";
                const qty = typeof item === "object" && item?.qty != null ? item.qty : 1;
                return (
                  <li key={idx} className="flex items-center gap-2 text-[13px] text-[var(--tx)]">
                    <span className="text-[var(--gold)]">•</span>
                    <span className="flex-1">{name}</span>
                    <span className="text-[10px] font-semibold text-[var(--tx3)] bg-[var(--bg)] px-2 py-0.5 rounded">Qty: {qty}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-[12px] text-[var(--tx3)]">No items listed</div>
          )}
        </div>

        {/* Pricing */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" onClick={() => setEditModalOpen(true)} aria-label="Edit pricing">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Pricing</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--tx3)]">Quoted Price</span>
              <span className="text-[15px] font-bold text-[var(--gold)]">
                ${delivery.quoted_price?.toFixed(2) || "0.00"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      {delivery.instructions && (
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Special Instructions</h3>
          <p className="text-[13px] text-[var(--tx)] leading-relaxed">{delivery.instructions}</p>
        </div>
      )}

      <ContactDetailsModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contact={{
          name: delivery.customer_name,
          email: delivery.customer_email,
          phone: delivery.customer_phone,
        }}
      />
    </div>
  );
}
