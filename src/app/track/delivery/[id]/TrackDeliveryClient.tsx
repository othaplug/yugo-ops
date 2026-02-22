"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DELIVERY_STAGES = ["en_route", "arrived", "delivering", "completed"];
const STAGE_LABELS: Record<string, string> = {
  en_route: "On the way",
  arrived: "Arrived",
  delivering: "Delivering / Installing",
  completed: "Completed",
};

export default function TrackDeliveryClient({
  delivery,
  token,
}: {
  delivery: any;
  token: string;
}) {
  const [liveStage, setLiveStage] = useState<string | null>(delivery.stage || null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/track/delivery/${delivery.id}/crew-status?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (res.ok && data?.liveStage != null) setLiveStage(data.liveStage);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [delivery.id, token]);

  const itemsCount = Array.isArray(delivery.items) ? delivery.items.length : 0;
  const statusVal = liveStage === "completed" ? "delivered" : delivery.status;
  const isInProgress = ["en_route", "arrived", "delivering"].includes(liveStage || "");
  const isCompleted = statusVal === "delivered" || statusVal === "completed" || liveStage === "completed";

  const stageIdx = DELIVERY_STAGES.indexOf(liveStage || "");
  const progressPercent = isCompleted ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100 : 0;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    confirmed: "bg-emerald-500/20 text-emerald-400",
    scheduled: "bg-blue-500/20 text-blue-400",
    "in-transit": "bg-amber-400/20 text-amber-300",
    dispatched: "bg-amber-400/20 text-amber-300",
    delivered: "bg-emerald-500/20 text-emerald-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
  };
  const statusClass = statusColors[statusVal] || "bg-amber-400/20 text-amber-300";

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E8E5E0] font-sans">
      <div className="max-w-[560px] mx-auto px-5 py-8 md:py-12">
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[rgba(201,169,98,0.08)] border border-[rgba(201,169,98,0.35)] text-[#C9A962] font-semibold tracking-widest text-sm">
            OPS+
          </span>
        </div>
        <div className="text-[9px] font-bold tracking-widest uppercase text-[#C9A962] mb-2">Project Tracking</div>
        <h1 className="text-xl md:text-2xl font-bold mb-6">
          {delivery.delivery_number} — {delivery.customer_name}
        </h1>

        {isInProgress && (
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 min-w-0 overflow-hidden rounded-full bg-[#2A2A2A]">
                <div
                  className="h-full rounded-full bg-[#C9A962] transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold text-[#C9A962] tabular-nums">{Math.round(progressPercent)}%</span>
            </div>
            <p className="text-[12px] text-[#999] mt-2">{liveStage ? STAGE_LABELS[liveStage] || liveStage : "Tracking…"}</p>
          </div>
        )}

        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-5 md:p-6 space-y-5">
          <div>
            <div className="text-[9px] font-bold uppercase text-[#666] mb-2">Status</div>
            <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${statusClass}`}>
              {(liveStage ? STAGE_LABELS[liveStage] : statusVal)?.replace("-", " ")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#2A2A2A]">
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Delivery to</div>
              <div className="text-sm">{delivery.delivery_address || "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Pickup from</div>
              <div className="text-sm">{delivery.pickup_address || "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Date & window</div>
              <div className="text-sm font-semibold">
                {delivery.scheduled_date || "—"} • {delivery.delivery_window || delivery.time_slot || "—"}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Items</div>
              <div className="text-sm font-semibold">{itemsCount} items</div>
            </div>
          </div>

          {itemsCount > 0 && (
            <div className="pt-4 border-t border-[#2A2A2A]">
              <div className="text-[9px] font-bold uppercase text-[#666] mb-2">Item list</div>
              <ul className="text-[13px] text-[#E8E5E0] space-y-1">
                {(delivery.items as string[]).map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#666] mt-8">
          <Link href="/" className="text-[#C9A962] hover:underline">OPS+</Link> · Powered by OPS+
        </p>
      </div>
    </div>
  );
}
