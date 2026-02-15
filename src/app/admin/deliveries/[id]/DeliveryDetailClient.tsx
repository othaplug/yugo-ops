"use client";

import { useState } from "react";
import Link from "next/link";
import EditDeliveryModal from "./EditDeliveryModal";
import NotifyClientButton from "./NotifyClientButton";
import DownloadPDFButton from "./DownloadPDFButton";
import ContactDetailsModal from "../../components/ContactDetailsModal";

const PROGRESS_STEPS = ["pending", "confirmed", "in-transit", "delivered"] as const;
const PROGRESS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  "in-transit": "In Transit",
  delivered: "Completed",
  cancelled: "Cancelled",
};

export default function DeliveryDetailClient({ delivery }: { delivery: any }) {
  const [contactModalOpen, setContactModalOpen] = useState(false);

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

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 space-y-5 animate-fade-up">
      <Link href="/admin/deliveries" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Deliveries
      </Link>

      {/* Header Card */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">{delivery.delivery_number}</h1>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
                {delivery.status}
              </span>
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
            <EditDeliveryModal delivery={delivery} />
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
                className="h-full bg-[var(--gold)] rounded-full transition-all duration-500"
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

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Customer Info - clickable */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
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
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
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
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Items</h3>
          {delivery.items && delivery.items.length > 0 ? (
            <ul className="space-y-2">
              {delivery.items.map((item: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-[13px] text-[var(--tx)]">
                  <span className="text-[var(--gold)]">•</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[12px] text-[var(--tx3)]">No items listed</div>
          )}
        </div>

        {/* Pricing */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
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
