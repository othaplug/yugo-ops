"use client";

import { useState, useCallback } from "react";
import { Check, MapPin, Clock, SkipForward } from "@phosphor-icons/react";

interface Stop {
  id: string;
  stop_number: number;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  client_phone: string | null;
  items_description: string | null;
  special_instructions: string | null;
  notes: string | null;
  stop_status: string;
  stop_type: string;
  arrived_at: string | null;
  completed_at: string | null;
}

interface DeliveryInfo {
  id: string;
  bookingType: string | null;
  stopsCompleted: number;
  totalStops: number;
  clientName: string;
  deliveryNumber: string | null;
}

interface Props {
  stops: Stop[];
  delivery: DeliveryInfo;
  partnerName: string;
  vehicleType?: string | null;
  onStopUpdated?: () => void;
}

const STOP_STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending:     { label: "Pending",     icon: "circle",    color: "#9CA3AF", bg: "rgba(156,163,175,0.1)" },
  current:     { label: "Up Next",     icon: "clock",     color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  arrived:     { label: "Arrived",     icon: "map-pin",   color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  in_progress: { label: "In Progress", icon: "dot-active",color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  completed:   { label: "Done",        icon: "check",     color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
  skipped:     { label: "Skipped",     icon: "skip",      color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

const STOP_TYPE_LABELS: Record<string, string> = { pickup: "Pickup", delivery: "Delivery" };

export default function DayRateStopFlow({ stops, delivery, partnerName, vehicleType, onStopUpdated }: Props) {
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const current = stops.find((s) => s.stop_status === "current" || s.stop_status === "arrived" || s.stop_status === "in_progress");
    return current?.id ?? null;
  });

  const completedCount = stops.filter((s) => s.stop_status === "completed").length;
  const totalCount = stops.length;
  const currentStop = stops.find((s) => ["current", "arrived", "in_progress"].includes(s.stop_status));

  const advanceStop = useCallback(async (stopId: string, newStatus: string) => {
    setAdvancing(stopId);
    try {
      const res = await fetch("/api/crew/stops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop_id: stopId, new_status: newStatus, delivery_id: delivery.id }),
      });
      if (!res.ok) throw new Error("Failed");
      onStopUpdated?.();
    } catch {
      // ignore
    } finally {
      setAdvancing(null);
    }
  }, [delivery.id, onStopUpdated]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--card)] rounded-2xl p-4 border border-[var(--brd)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Day Rate</span>
          <span className="text-[10px] font-semibold text-[var(--gold)] px-2 py-0.5 rounded-full bg-[var(--gold)]/10">
            {completedCount}/{totalCount} stops
          </span>
        </div>
        <h2 className="text-[18px] font-bold text-[var(--tx)] leading-tight">{partnerName}</h2>
        {vehicleType && (
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">{vehicleType} · Full day</p>
        )}
        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-[var(--brd)]/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%`,
              background: completedCount === totalCount ? "linear-gradient(90deg,#22C55E,#16A34A)" : "linear-gradient(90deg,#C9A962,#D4B56C)",
            }}
          />
        </div>
        {currentStop && (
          <p className="text-[10px] text-[var(--tx3)] mt-2">
            Current: Stop {currentStop.stop_number} — {currentStop.address}
          </p>
        )}
      </div>

      {/* Stop list */}
      <div className="space-y-2">
        {stops.map((stop, idx) => {
          const cfg = STOP_STATUS_CONFIG[stop.stop_status] ?? STOP_STATUS_CONFIG.pending;
          const isExpanded = expandedId === stop.id;
          const isCurrent = ["current", "arrived", "in_progress"].includes(stop.stop_status);
          const isDone = stop.stop_status === "completed";
          const isPending = stop.stop_status === "pending";
          const isNext = idx === stops.findIndex((s) => s.stop_status === "current") - 0 + 1 && !currentStop?.id;

          return (
            <div
              key={stop.id}
              className={`rounded-2xl border transition-all ${isCurrent ? "border-[#10B981]/40 shadow-sm" : "border-[var(--brd)]"}`}
              style={{ background: isCurrent ? "rgba(16,185,129,0.04)" : "var(--card)" }}
            >
              <button
                type="button"
                className="w-full text-left px-4 py-3"
                onClick={() => setExpandedId(isExpanded ? null : stop.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                    {cfg.icon === "check"      && <Check size={12} color={cfg.color} weight="bold" />}
                    {cfg.icon === "map-pin"    && <MapPin size={12} color={cfg.color} />}
                    {cfg.icon === "clock"      && <Clock size={12} color={cfg.color} />}
                    {cfg.icon === "dot-active" && <span className="w-3 h-3 rounded-full" style={{ background: cfg.color }} />}
                    {cfg.icon === "circle"     && <span className="w-3 h-3 rounded-full border-2" style={{ borderColor: cfg.color }} />}
                    {cfg.icon === "skip"       && <SkipForward size={12} color={cfg.color} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-bold text-[var(--tx)]">
                        Stop {stop.stop_number} of {totalCount}
                      </span>
                      <span
                        className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-[8px] text-[var(--tx3)]/60 uppercase font-semibold">
                        {STOP_TYPE_LABELS[stop.stop_type] || "Delivery"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--tx2)] truncate">{stop.address}</p>
                    {stop.items_description && (
                      <p className="text-[10px] text-[var(--tx3)] truncate mt-0.5">{stop.items_description}</p>
                    )}
                  </div>
                  {isDone && stop.completed_at && (
                    <span className="text-[9px] text-[#22C55E] shrink-0">
                      {new Date(stop.completed_at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-[var(--brd)]/30 space-y-3">
                  {/* Contact */}
                  {(stop.customer_name || stop.customer_phone || stop.client_phone) && (
                    <div className="space-y-1">
                      {stop.customer_name && (
                        <p className="text-[11px] text-[var(--tx)]">Contact: <strong>{stop.customer_name}</strong></p>
                      )}
                      {(stop.customer_phone || stop.client_phone) && (
                        <a
                          href={`tel:${stop.customer_phone || stop.client_phone}`}
                          className="text-[11px] text-[var(--gold)] hover:underline"
                        >
                          {stop.customer_phone || stop.client_phone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {(stop.special_instructions || stop.notes) && (
                    <div className="bg-[var(--bg)] rounded-lg px-3 py-2 text-[11px] text-[var(--tx2)]">
                      {stop.special_instructions || stop.notes}
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isDone && !isPending && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {stop.stop_status === "current" && (
                        <button
                          type="button"
                          onClick={() => advanceStop(stop.id, "arrived")}
                          disabled={advancing === stop.id}
                          className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[#3B82F6] text-white disabled:opacity-50"
                        >
                          {advancing === stop.id ? "…" : "Arrived"}
                        </button>
                      )}
                      {stop.stop_status === "arrived" && (
                        <button
                          type="button"
                          onClick={() => advanceStop(stop.id, "in_progress")}
                          disabled={advancing === stop.id}
                          className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[#F59E0B] text-white disabled:opacity-50"
                        >
                          {advancing === stop.id ? "…" : stop.stop_type === "pickup" ? "Loading" : "Unloading"}
                        </button>
                      )}
                      {stop.stop_status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => advanceStop(stop.id, "completed")}
                          disabled={advancing === stop.id}
                          className="px-4 py-2 rounded-xl text-[11px] font-semibold text-white disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)" }}
                        >
                          {advancing === stop.id ? "…" : "Complete stop →"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Start this stop */}
                  {stop.stop_status === "pending" && !currentStop && (
                    <button
                      type="button"
                      onClick={() => advanceStop(stop.id, "current")}
                      disabled={advancing === stop.id}
                      className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
                    >
                      {advancing === stop.id ? "…" : "Start This Stop"}
                    </button>
                  )}

                  {isDone && (
                    <div className="flex items-center gap-2 text-[10px] text-[#22C55E]">
                      <Check size={14} weight="bold" />
                      Completed {stop.completed_at ? `at ${new Date(stop.completed_at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {completedCount === totalCount && totalCount > 0 && (
        <div className="rounded-2xl p-4 text-center border border-[#22C55E]/30" style={{ background: "rgba(34,197,94,0.06)" }}>
          <p className="text-[#22C55E] font-bold text-[14px]">All {totalCount} stops completed!</p>
          <p className="text-[11px] text-[var(--tx3)] mt-1">Day rate job is done. Great work!</p>
        </div>
      )}
    </div>
  );
}
