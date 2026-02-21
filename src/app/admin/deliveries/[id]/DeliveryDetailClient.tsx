"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EditDeliveryModal from "./EditDeliveryModal";
import NotifyClientButton from "./NotifyClientButton";
import DownloadPDFButton from "./DownloadPDFButton";
import { formatPhone } from "@/lib/phone";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import LiveTrackingMap from "./LiveTrackingMap";
import IncidentsSection from "../../components/IncidentsSection";

const PROGRESS_STEPS = ["pending", "confirmed", "in-transit", "delivered"] as const;
const PROGRESS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  "in-transit": "In Transit",
  delivered: "Completed",
  cancelled: "Cancelled",
};

const STAGE_OPTIONS = [
  { value: "quote", label: "Quote" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const CATEGORY_STYLES: Record<string, { borderClass: string }> = {
  retail: { borderClass: "border-l-4 border-l-[var(--gold)]" },
  designer: { borderClass: "border-l-4 border-l-[#B8860B]" },
  hospitality: { borderClass: "border-l-4 border-l-[#D48A29]" },
  gallery: { borderClass: "border-l-4 border-l-[#4A7CE5]" },
  b2c: { borderClass: "border-l-4 border-l-[#2D9F5A]" },
};

export default function DeliveryDetailClient({ delivery: initialDelivery, clientEmail }: { delivery: any; clientEmail?: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<"status" | "stage" | "next_action" | null>(null);
  const [saving, setSaving] = useState(false);
  const [editNextAction, setEditNextAction] = useState("");
  useEffect(() => setDelivery(initialDelivery), [initialDelivery]);

  const statusColorMap: Record<string, string> = {
    pending: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
    confirmed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
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
              {delivery.updated_at && (
                <span className="ml-2 text-[10px] text-[var(--tx3)]">
                  • Last update: {new Date(delivery.updated_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 [&_button]:min-h-[44px] [&_button]:touch-manipulation">
            <EditDeliveryModal delivery={delivery} open={editModalOpen} onOpenChange={setEditModalOpen} />
            <button onClick={() => setEditModalOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all">
              Edit
            </button>
            <NotifyClientButton delivery={delivery} clientEmail={clientEmail} />
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
        {/* Status - editable dropdown with colors */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" onClick={() => setEditingCard(editingCard === "status" ? null : "status")} aria-label="Edit status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Status</h3>
          {editingCard === "status" ? (
            <select
              defaultValue={delivery.status}
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]"
              onChange={async (e) => {
                const v = e.target.value;
                setSaving(true);
                const { data } = await supabase.from("deliveries").update({ status: v, updated_at: new Date().toISOString() }).eq("id", delivery.id).select().single();
                if (data) setDelivery(data);
                setSaving(false);
                setEditingCard(null);
                router.refresh();
              }}
            >
              {Object.entries(PROGRESS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-block px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusColorMap[delivery.status] || "text-[var(--tx3)] bg-[var(--card)]"}`}>
              {PROGRESS_LABELS[delivery.status] || delivery.status}
            </span>
          )}
        </div>

        {/* Stage - editable dropdown */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" onClick={() => setEditingCard(editingCard === "stage" ? null : "stage")} aria-label="Edit stage">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Stage</h3>
          {editingCard === "stage" ? (
            <select
              defaultValue={delivery.stage ?? ""}
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]"
              onChange={async (e) => {
                const v = e.target.value || null;
                setSaving(true);
                const { data } = await supabase.from("deliveries").update({ stage: v, updated_at: new Date().toISOString() }).eq("id", delivery.id).select().single();
                if (data) setDelivery(data);
                setSaving(false);
                setEditingCard(null);
                router.refresh();
              }}
            >
              <option value="">—</option>
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <div className="text-[13px] text-[var(--tx)]">{STAGE_OPTIONS.find((o) => o.value === delivery.stage)?.label ?? delivery.stage ?? "—"}</div>
          )}
        </div>

        {/* Next action - editable text */}
        <div className="group/card bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 relative hover:border-[var(--gold)]/50 transition-all">
          <button type="button" className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--gdim)] text-[var(--tx3)] hover:text-[var(--gold)]" onClick={() => { setEditNextAction(delivery.next_action ?? ""); setEditingCard(editingCard === "next_action" ? null : "next_action"); }} aria-label="Edit next action">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Next action</h3>
          {editingCard === "next_action" ? (
            <input
              type="text"
              value={editNextAction}
              onChange={(e) => setEditNextAction(e.target.value)}
              onBlur={async () => {
                setSaving(true);
                const { data } = await supabase.from("deliveries").update({ next_action: editNextAction.trim() || null, updated_at: new Date().toISOString() }).eq("id", delivery.id).select().single();
                if (data) setDelivery(data);
                setSaving(false);
                setEditingCard(null);
                router.refresh();
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder="e.g. Confirm date with client"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)]"
              autoFocus
            />
          ) : (
            <div className="text-[13px] text-[var(--tx)]">{delivery.next_action || "—"}</div>
          )}
        </div>

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
              <div className="text-[13px] text-[var(--tx)]">{delivery.customer_phone ? formatPhone(delivery.customer_phone) : "Not provided"}</div>
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
                const display = qty > 1 ? `${name} x${qty}` : name;
                return (
                  <li key={idx} className="flex items-center gap-2 text-[13px] text-[var(--tx)]">
                    <span className="text-[var(--gold)]">•</span>
                    <span className="flex-1">{display}</span>
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

      {/* Reported Issues from crew */}
      <IncidentsSection jobId={delivery.id} jobType="delivery" />

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
