"use client";

import { useState, useEffect, useMemo } from "react";
import { getDeliveryTimelineIndex, DELIVERY_TIMELINE_STEPS } from "@/lib/partner-type";
import DeliveryProgressBar from "@/components/DeliveryProgressBar";
import { toTitleCase } from "@/lib/format-text";

const DELIVERY_STAGES = ["en_route", "arrived", "delivering", "completed"];
const STAGE_LABELS: Record<string, string> = {
  en_route: "On the way",
  arrived: "Arrived",
  delivering: "Delivering / Installing",
  completed: "Completed",
};

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
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-600",
  confirmed: "bg-green-50 text-green-600",
  dispatched: "bg-amber-50 text-amber-600",
  "in-transit": "bg-amber-50 text-amber-700",
  in_transit: "bg-amber-50 text-amber-700",
  in_progress: "bg-amber-50 text-amber-700",
  delivered: "bg-green-50 text-green-700",
  completed: "bg-green-50 text-green-700",
  pending: "bg-orange-50 text-orange-600",
  pending_approval: "bg-orange-50 text-orange-600",
  cancelled: "bg-red-50 text-red-600",
};

const STATUS_OPTIONS = ["all", "pending_approval", "scheduled", "confirmed", "dispatched", "in_progress", "in-transit", "delivered", "completed", "cancelled"];

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
  label: "today" | "upcoming" | "all";
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
      result = result.filter((d) => (d.status || "").toLowerCase().replace(/ /g, "-") === statusFilter);
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, address, or delivery #..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#999] focus:border-[#C9A962] focus:outline-none transition-colors bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#E8E4DF] text-[12px] font-semibold text-[#1A1A1A] bg-white focus:border-[#C9A962] focus:outline-none transition-colors min-w-[130px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="bg-white border border-[#E8E4DF] rounded-xl p-8 text-center">
          <p className="text-[14px] text-[#888]">
            {label === "today" ? "No deliveries scheduled for today." : label === "upcoming" ? "No upcoming deliveries." : "No deliveries found."}
          </p>
          {label === "today" && onScheduleDelivery && (
            <button
              type="button"
              onClick={onScheduleDelivery}
              className="mt-4 px-4 py-2 rounded-lg text-[13px] font-medium border border-[#C9A962]/50 text-[#B8962E] hover:bg-[#C9A962]/8 transition-colors"
            >
              Schedule delivery
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E8E4DF] rounded-xl p-8 text-center">
          <p className="text-[14px] text-[#888]">No deliveries match your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              onShare={() => onShare(d)}
              onDetailClick={onDetailClick ? () => onDetailClick(d) : undefined}
              onEditClick={onEditClick ? () => onEditClick(d) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryCard({ delivery: d, onShare, onDetailClick, onEditClick }: { delivery: Delivery; onShare: () => void; onDetailClick?: () => void; onEditClick?: () => void }) {
  const [liveStage, setLiveStage] = useState<string | null>(d.stage || null);
  const [copied, setCopied] = useState(false);
  const isInProgress = IN_PROGRESS_STATUSES.includes((d.status || "").toLowerCase().replace(/-/g, "_"));
  const isCompleted = ["delivered", "completed"].includes((d.status || "").toLowerCase());
  const isLocked = ["delivered", "completed", "cancelled"].includes((d.status || "").toLowerCase());

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

  const stageIdx = DELIVERY_STAGES.indexOf(liveStage || "");
  const progressPercent = isCompleted || liveStage === "completed" ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100 : 0;
  const showProgressBar = (isInProgress || isCompleted) && (stageIdx >= 0 || liveStage === "completed" || isCompleted);

  const timelineIdx = getDeliveryTimelineIndex(liveStage === "completed" ? "delivered" : d.status);
  const items = Array.isArray(d.items) ? d.items : [];
  const itemsDisplay = items.length > 0
    ? items.map((i: unknown) => typeof i === "string" ? i : (i as { name?: string })?.name || "").filter(Boolean).join(", ")
    : null;

  const statusLabel = toTitleCase(d.status || "");
  const badgeClass = STATUS_BADGE[(d.status || "").toLowerCase().replace(/ /g, "_")] || "bg-gray-50 text-gray-600";

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
      className={`bg-white border border-[#E8E4DF] rounded-xl p-5 hover:border-[#C9A962]/40 transition-colors ${onDetailClick ? "cursor-pointer" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-[#1A1A1A] truncate">{d.customer_name || d.delivery_number}</h3>
            <span className="text-[10px] text-[#999] font-mono flex-shrink-0">{d.delivery_number}</span>
          </div>
          <p className="text-[12px] text-[#888] mt-0.5 truncate">
            {d.delivery_address || "Address TBD"}
            {d.scheduled_date && ` — ${new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            {d.time_slot && `, ${d.time_slot}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${badgeClass}`}>
            {statusLabel}
          </span>
          {/* Copy tracking link */}
          <button
            onClick={(e) => { e.stopPropagation(); copyTrackingLink(); }}
            className="p-1.5 rounded-lg hover:bg-[#F5F3F0] transition-colors relative"
            title="Copy tracking link"
          >
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2D9F5A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            )}
          </button>
          {/* Edit */}
          {!isLocked && onEditClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditClick(); }}
              className="p-1.5 rounded-lg hover:bg-[#F5F3F0] transition-colors"
              title="Edit delivery"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {/* Share */}
          <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="p-1.5 rounded-lg hover:bg-[#F5F3F0] transition-colors" title="Share tracking link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {showProgressBar && (
        <div className="mb-4">
          <DeliveryProgressBar
            percent={progressPercent}
            label={liveStage ? STAGE_LABELS[liveStage] || liveStage : isCompleted ? "Completed" : "Tracking…"}
            sublabel={`${Math.round(progressPercent)}%`}
            variant="light"
          />
        </div>
      )}

      {/* Timeline (when no progress bar) */}
      {!showProgressBar && <DeliveryTimeline currentIndex={timelineIdx} />}

      {/* Details */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-[12px]">
        {d.time_slot && (
          <div>
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Time</div>
            <div className="text-[#1A1A1A] font-medium mt-0.5">{d.time_slot}</div>
          </div>
        )}
        {itemsDisplay && (
          <div className="col-span-2 sm:col-span-1">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Items</div>
            <div className="text-[#1A1A1A] font-medium mt-0.5 truncate">{itemsDisplay}</div>
          </div>
        )}
      </div>
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
                      : "bg-white border-[#D4D0CB]"
                }`}
              />
              <span className={`text-[9px] mt-1.5 whitespace-nowrap ${isDone || isCurrent ? "text-[#1A1A1A] font-semibold" : "text-[#aaa]"}`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-14px] ${i < currentIndex ? "bg-[#2D9F5A]" : "bg-[#E8E4DF]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
