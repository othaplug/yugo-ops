"use client";

import { getDeliveryTimelineIndex, DELIVERY_TIMELINE_STEPS } from "@/lib/partner-type";

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
  delivered: "bg-green-50 text-green-700",
  completed: "bg-green-50 text-green-700",
  pending: "bg-orange-50 text-orange-600",
  cancelled: "bg-red-50 text-red-600",
};

export default function PartnerDeliveriesTab({
  deliveries,
  label,
  onShare,
  orgType,
}: {
  deliveries: Delivery[];
  label: "today" | "upcoming";
  onShare: (d: Delivery) => void;
  orgType: string;
}) {
  if (deliveries.length === 0) {
    return (
      <div className="bg-white border border-[#E8E4DF] rounded-xl p-8 text-center">
        <p className="text-[14px] text-[#888]">
          {label === "today" ? "No deliveries scheduled for today." : "No upcoming deliveries."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliveries.map((d) => (
        <DeliveryCard key={d.id} delivery={d} onShare={() => onShare(d)} />
      ))}
    </div>
  );
}

function DeliveryCard({ delivery: d, onShare }: { delivery: Delivery; onShare: () => void }) {
  const timelineIdx = getDeliveryTimelineIndex(d.status);
  const items = Array.isArray(d.items) ? d.items : [];
  const itemsDisplay = items.length > 0
    ? items.map((i: unknown) => typeof i === "string" ? i : (i as { name?: string })?.name || "").filter(Boolean).join(", ")
    : null;

  const statusLabel = (d.status || "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const badgeClass = STATUS_BADGE[(d.status || "").toLowerCase().replace(/ /g, "_")] || "bg-gray-50 text-gray-600";

  return (
    <div className="bg-white border border-[#E8E4DF] rounded-xl p-5 hover:border-[#C9A962]/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-[#1A1A1A]">{d.customer_name || d.delivery_number}</h3>
          </div>
          <p className="text-[12px] text-[#888] mt-0.5">
            {d.delivery_address || "Address TBD"}
            {d.scheduled_date && ` — ${new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            {d.time_slot && `, ${d.time_slot}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${badgeClass}`}>
            {statusLabel}
          </span>
          <button onClick={onShare} className="p-1.5 rounded-lg hover:bg-[#F5F3F0] transition-colors" title="Share tracking link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>

      {/* Timeline */}
      <DeliveryTimeline currentIndex={timelineIdx} />

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
