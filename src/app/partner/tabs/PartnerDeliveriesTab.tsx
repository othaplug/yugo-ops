"use client";

import { useState, useEffect, useMemo } from "react";
import { MagnifyingGlass, Check, Link, PencilSimple, ShareNetwork, Info, CalendarBlank } from "@phosphor-icons/react";
import RescheduleDeliveryModal from "@/components/partner/RescheduleDeliveryModal";
import { getDeliveryTimelineIndex, DELIVERY_TIMELINE_STEPS } from "@/lib/partner-type";
import DeliveryProgressBar from "@/components/DeliveryProgressBar";
import { toTitleCase } from "@/lib/format-text";

/** Full 5 stages for admin/partner (two-leg delivery) */
const DELIVERY_STAGES = ["en_route_to_pickup", "arrived_at_pickup", "en_route_to_destination", "arrived_at_destination", "completed"];
const STAGE_LABELS: Record<string, string> = {
  en_route_to_pickup: "En Route to Pick Up",
  arrived_at_pickup: "Arrived at Pickup",
  en_route_to_destination: "En Route to Drop Off",
  arrived_at_destination: "Delivering/Installing",
  completed: "Complete",
  en_route: "En Route to Pick Up",
  arrived: "Arrived at Pickup",
  delivering: "Delivering/Installing",
};

function normalizeDeliveryStage(stage: string | null): string | null {
  if (!stage) return null;
  const legacy: Record<string, string> = { en_route: "en_route_to_pickup", arrived: "arrived_at_pickup", delivering: "en_route_to_destination" };
  return legacy[stage] || stage;
}

const IN_PROGRESS_STATUSES = ["dispatched", "in-transit", "in_transit", "in_transit_to_destination", "in_progress"];

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string;
  stage: string | null;
  scheduled_date: string | null;
  time_slot: string | null;
  delivery_address: string | null;
  pickup_address: string | null;
  items: unknown[] | string[] | null;
  category: string | null;
  crew_id: string | null;
  created_at: string;
  booking_type?: string | null;
  vehicle_type?: string | null;
  num_stops?: number | null;
  total_price?: number | null;
  delivery_type?: string | null;
  zone?: number | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending_approval: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-500",
  confirmed: "bg-green-500/10 text-green-600",
  approved: "bg-green-500/10 text-green-600",
  dispatched: "bg-amber-500/10 text-amber-500",
  "in-transit": "bg-amber-500/10 text-amber-600",
  in_transit: "bg-amber-500/10 text-amber-600",
  in_progress: "bg-amber-500/10 text-amber-600",
  delivered: "bg-green-500/10 text-green-600",
  completed: "bg-green-500/10 text-green-600",
  pending: "bg-orange-500/10 text-orange-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const STATUS_LABEL_OVERRIDE: Record<string, string> = {
  pending_approval: "Pending Acceptance",
  in_progress: "In Progress",
  "in-transit": "In Transit",
  delivered: "Completed",
  completed: "Completed",
};

const STATUS_OPTIONS = ["all", "pending_approval", "scheduled", "confirmed", "approved", "dispatched", "in_progress", "in-transit", "completed", "cancelled"];

export default function PartnerDeliveriesTab({
  deliveries,
  label,
  onShare,
  onDetailClick,
  onEditClick,
  onScheduleDelivery,
  orgType,
}: {
  deliveries: Delivery[];
  label: "today" | "upcoming" | "history" | "all";
  onShare: (d: Delivery) => void;
  onDetailClick?: (d: Delivery) => void;
  onEditClick?: (d: Delivery) => void;
  onScheduleDelivery?: () => void;
  orgType: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = deliveries;
    if (statusFilter !== "all") {
      result = result.filter((d) => {
        const s = (d.status || "").toLowerCase().replace(/ /g, "-");
        if (statusFilter === "completed") return s === "completed" || s === "delivered";
        return s === statusFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.customer_name || "").toLowerCase().includes(q) ||
          (d.delivery_number || "").toLowerCase().includes(q) ||
          (d.delivery_address || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [deliveries, search, statusFilter]);

  return (
    <div>
      {/* Search + Filter bar */}
      {deliveries.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlass size={16} color="#999" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, address, or delivery #..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#C9A962] focus:outline-none transition-colors bg-[var(--bg)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] bg-[var(--bg)] focus:border-[#C9A962] focus:outline-none transition-colors min-w-[130px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? "All statuses"
                  : (STATUS_LABEL_OVERRIDE[s] ?? s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}
              </option>
            ))}
          </select>
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="empty-state border-t border-[var(--brd)]/30">
          <p className="empty-state-title">
            {label === "today" ? "No deliveries today" : label === "upcoming" ? "No upcoming deliveries" : label === "history" ? "No completed deliveries" : "No deliveries"}
          </p>
          <p className="empty-state-sub">
            {label === "today" ? "Nothing scheduled for today. Check back soon or schedule a new delivery." : label === "upcoming" ? "No deliveries scheduled yet." : label === "history" ? "Completed deliveries will appear here." : "No deliveries found."}
          </p>
          {label === "today" && onScheduleDelivery && (
            <div className="empty-state-action">
              <button
                type="button"
                onClick={onScheduleDelivery}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border border-[#C9A962]/40 text-[#B8962E] hover:bg-[#C9A962]/10 transition-colors"
              >
                Schedule delivery
              </button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state border-t border-[var(--brd)]/30">
          <p className="empty-state-title">No results</p>
          <p className="empty-state-sub">No deliveries match your current search or filter.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {filtered.map((d, i) => (
            <div key={d.id} className={i > 0 ? "border-t border-[var(--brd)]/30 pt-4" : ""}>
              <DeliveryCard
                delivery={d}
                onShare={() => onShare(d)}
                onDetailClick={onDetailClick ? () => onDetailClick(d) : undefined}
                onEditClick={onEditClick ? () => onEditClick(d) : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryCard({ delivery: d, onShare, onDetailClick, onEditClick }: { delivery: Delivery; onShare: () => void; onDetailClick?: () => void; onEditClick?: () => void }) {
  const [liveStage, setLiveStage] = useState<string | null>(d.stage || null);
  const [copied, setCopied] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const isInProgress = IN_PROGRESS_STATUSES.includes((d.status || "").toLowerCase().replace(/-/g, "_"));
  const isCompleted = ["delivered", "completed"].includes((d.status || "").toLowerCase());
  const isLocked = ["delivered", "completed", "cancelled"].includes((d.status || "").toLowerCase());

  // Allow reschedule if not locked and > 24hr away
  const hoursUntil = d.scheduled_date
    ? (new Date(d.scheduled_date + "T12:00:00").getTime() - Date.now()) / 3600000
    : 0;
  const canReschedule = !isLocked && !isInProgress && hoursUntil >= 24;

  useEffect(() => {
    if (!isInProgress && !isCompleted) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/partner/deliveries/${d.id}/crew-status`);
        if (res.ok) {
          const data = await res.json();
          if (data?.liveStage != null) setLiveStage(data.liveStage);
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [d.id, isInProgress, isCompleted]);

  const normalizedStage = normalizeDeliveryStage(liveStage);
  const stageIdx = DELIVERY_STAGES.indexOf(normalizedStage || "");
  const progressPercent = isCompleted || normalizedStage === "completed" ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100 : 0;
  const showProgressBar = (isInProgress || isCompleted) && (stageIdx >= 0 || normalizedStage === "completed" || isCompleted);

  const timelineIdx = getDeliveryTimelineIndex(liveStage === "completed" ? "delivered" : d.status);
  const items = Array.isArray(d.items) ? d.items : [];
  const itemsDisplay = items.length > 0
    ? items.map((i: unknown) => typeof i === "string" ? i : (i as { name?: string })?.name || "").filter(Boolean).join(", ")
    : null;

  const statusKey = (d.status || "").toLowerCase().replace(/ /g, "_");
  const statusLabel = STATUS_LABEL_OVERRIDE[statusKey] || toTitleCase(d.status || "");
  const badgeClass = STATUS_BADGE[statusKey] || "bg-gray-50 text-gray-600";

  const copyTrackingLink = async () => {
    try {
      const res = await fetch("/api/partner/share-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_id: d.id, method: "link", recipient: "copy" }),
      });
      const data = await res.json();
      const url = data.trackUrl || `${window.location.origin}/track/delivery/${encodeURIComponent(d.delivery_number)}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      role={onDetailClick ? "button" : undefined}
      tabIndex={onDetailClick ? 0 : undefined}
      onClick={onDetailClick}
      onKeyDown={onDetailClick ? (e) => e.key === "Enter" && onDetailClick() : undefined}
      className={`py-4 transition-colors ${onDetailClick ? "cursor-pointer hover:opacity-90" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[16px] font-bold text-[var(--tx)] truncate">{d.customer_name || d.delivery_number}</h3>
            <span className="text-[11px] text-[var(--tx3)] font-mono flex-shrink-0">{d.delivery_number}</span>
            {d.booking_type === "day_rate" ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Day Rate</span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Delivery</span>
            )}
          </div>
          <p className="text-[13px] text-[var(--tx3)] mt-0.5 truncate">
            {d.booking_type === "day_rate"
              ? [d.vehicle_type ? `${d.vehicle_type}` : null, d.num_stops != null ? `${d.num_stops} stops` : null].filter(Boolean).join(" · ") || d.delivery_address || "Address TBD"
              : [d.delivery_type ? toTitleCase(String(d.delivery_type).replace(/_/g, " ")) : null, d.zone != null ? `Z${d.zone}` : null].filter(Boolean).join(" · ") || d.delivery_address || "Address TBD"}
            {d.scheduled_date && ` — ${new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            {d.time_slot && `, ${d.time_slot}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass}`}>
            {statusLabel}
          </span>
          {/* Copy tracking link */}
          <button
            onClick={(e) => { e.stopPropagation(); copyTrackingLink(); }}
            className="icon-btn"
            title="Copy tracking link"
            data-no-min-height
          >
            {copied ? (
              <Check size={15} color="#2D9F5A" weight="bold" />
            ) : (
              <Link size={15} />
            )}
          </button>
          {/* Reschedule */}
          {canReschedule && (
            <button
              onClick={(e) => { e.stopPropagation(); setRescheduleOpen(true); }}
              className="icon-btn"
              title="Reschedule delivery"
              data-no-min-height
            >
              <CalendarBlank size={15} />
            </button>
          )}
          {/* Edit */}
          {!isLocked && onEditClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditClick(); }}
              className="icon-btn"
              title="Edit delivery"
              data-no-min-height
            >
              <PencilSimple size={15} />
            </button>
          )}
          {/* Share */}
          <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="icon-btn" title="Share tracking link" data-no-min-height>
            <ShareNetwork size={15} />
          </button>
        </div>
      </div>

      {/* Pending acceptance notice */}
      {statusKey === "pending_approval" && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Info size={13} color="#D97706" />
          <span className="text-[11px] text-amber-600 font-medium">Awaiting confirmation from Yugo — we&apos;ll update you shortly.</span>
        </div>
      )}

      {/* Progress bar */}
      {showProgressBar && (
        <div className="mb-4">
          <DeliveryProgressBar
            percent={progressPercent}
            label={normalizedStage ? ((STAGE_LABELS[normalizedStage] || liveStage) ?? "Tracking…") : isCompleted ? "Complete" : "Tracking…"}
            sublabel={`${Math.round(progressPercent)}%`}
            variant="light"
          />
        </div>
      )}

      {/* Timeline (when no progress bar) */}
      {!showProgressBar && <DeliveryTimeline currentIndex={timelineIdx} />}

      {/* Details */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
        {d.time_slot && (
          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)]">Time</div>
            <div className="text-[var(--tx)] font-medium mt-0.5">{d.time_slot}</div>
          </div>
        )}
        {d.booking_type === "day_rate" && d.num_stops != null && d.num_stops > 0 && (
          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)]">Stops</div>
            <div className="text-[var(--tx)] font-medium mt-0.5">{d.num_stops} stop{d.num_stops !== 1 ? "s" : ""}</div>
          </div>
        )}
        {d.booking_type === "day_rate" && d.vehicle_type && (
          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)]">Vehicle</div>
            <div className="text-[var(--tx)] font-medium mt-0.5 capitalize">{d.vehicle_type.replace(/_/g, " ")}</div>
          </div>
        )}
        {d.total_price != null && d.total_price > 0 && (
          <div>
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)]">Price</div>
            <div className="text-[#C9A962] font-bold mt-0.5">${Number(d.total_price).toLocaleString()}</div>
          </div>
        )}
        {itemsDisplay && (
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold tracking-wide uppercase text-[var(--tx3)]">Items</div>
            <div className="text-[var(--tx)] font-medium mt-0.5 truncate">{itemsDisplay}</div>
          </div>
        )}
      </div>

      {rescheduleOpen && (
        <RescheduleDeliveryModal
          deliveryId={d.id}
          deliveryNumber={d.delivery_number}
          currentDate={d.scheduled_date}
          currentWindow={d.time_slot}
          onClose={() => setRescheduleOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function DeliveryTimeline({ currentIndex }: { currentIndex: number }) {
  const steps = DELIVERY_TIMELINE_STEPS;
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const isDone = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 transition-colors ${
                  isDone
                    ? "bg-[#2D9F5A] border-[#2D9F5A]"
                    : isCurrent
                      ? "bg-[#C9A962] border-[#C9A962]"
                      : "bg-[var(--bg)] border-[var(--brd)]"
                }`}
              />
              <span className={`text-[9px] mt-1.5 whitespace-nowrap ${isDone || isCurrent ? "text-[var(--tx)] font-semibold" : "text-[var(--tx3)]"}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-14px] ${i < currentIndex ? "bg-[#2D9F5A]" : "bg-[var(--brd)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
