"use client";

import { useState, useCallback } from "react";
import { Check, MapPin, Clock, SkipForward } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

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

const STOP_STATUS_CONFIG: Record<
  string,
  { label: string; icon: string; chipClass: string }
> = {
  pending: {
    label: "Pending",
    icon: "circle",
    chipClass: "bg-zinc-500/15 text-zinc-600",
  },
  current: {
    label: "Up next",
    icon: "clock",
    chipClass: "bg-amber-500/15 text-amber-800 [font-family:var(--font-body)]",
  },
  arrived: {
    label: "Arrived",
    icon: "map-pin",
    chipClass: "bg-sky-500/12 text-sky-800 [font-family:var(--font-body)]",
  },
  in_progress: {
    label: "In progress",
    icon: "dot-active",
    chipClass:
      "bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)] [font-family:var(--font-body)]",
  },
  completed: {
    label: "Done",
    icon: "check",
    chipClass:
      "bg-[var(--yu3-wine)]/12 text-[var(--yu3-wine)] [font-family:var(--font-body)]",
  },
  skipped: {
    label: "Skipped",
    icon: "skip",
    chipClass: "bg-zinc-500/12 text-zinc-600 [font-family:var(--font-body)]",
  },
};

const STOP_TYPE_LABELS: Record<string, string> = { pickup: "Pickup", delivery: "Delivery" };

export default function DayRateStopFlow({
  stops,
  delivery,
  partnerName,
  vehicleType,
  onStopUpdated,
}: Props) {
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const current = stops.find(
      (s) =>
        s.stop_status === "current" ||
        s.stop_status === "arrived" ||
        s.stop_status === "in_progress",
    );
    return current?.id ?? null;
  });

  const completedCount = stops.filter((s) => s.stop_status === "completed").length;
  const totalCount = stops.length;
  const currentStop = stops.find((s) =>
    ["current", "arrived", "in_progress"].includes(s.stop_status),
  );

  const advanceStop = useCallback(
    async (stopId: string, newStatus: string) => {
      setAdvancing(stopId);
      try {
        const res = await fetch("/api/crew/stops", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stop_id: stopId,
            new_status: newStatus,
            delivery_id: delivery.id,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        onStopUpdated?.();
      } catch {
        // ignore
      } finally {
        setAdvancing(null);
      }
    },
    [delivery.id, onStopUpdated],
  );

  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 shadow-[var(--yu3-shadow-sm)]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
            Day rate
          </span>
          <span className="rounded-full bg-[var(--yu3-wine-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--yu3-wine)] [font-family:var(--font-body)]">
            {completedCount}/{totalCount} stops
          </span>
        </div>
        <h2 className="text-[18px] font-bold leading-tight text-[var(--yu3-ink)] [font-family:var(--font-body)]">
          {partnerName}
        </h2>
        {vehicleType && (
          <p className="mt-0.5 text-[11px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            {vehicleType} · Full day
          </p>
        )}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--yu3-line)]/30">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              completedCount === totalCount
                ? "bg-gradient-to-r from-[var(--yu3-wine)] to-[#3d1426]"
                : "bg-gradient-to-r from-[var(--yu3-wine)] to-[#5C1A33]",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {currentStop && (
          <p className="mt-2 text-[10px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            Current: Stop {currentStop.stop_number}, {currentStop.address}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {stops.map((stop) => {
          const cfg = STOP_STATUS_CONFIG[stop.stop_status] ?? STOP_STATUS_CONFIG.pending;
          const isExpanded = expandedId === stop.id;
          const isCurrent = ["current", "arrived", "in_progress"].includes(
            stop.stop_status,
          );
          const isDone = stop.stop_status === "completed";
          const isPending = stop.stop_status === "pending";

          return (
            <div
              key={stop.id}
              className={cn(
                "rounded-2xl border transition-all",
                isCurrent
                  ? "border-[var(--yu3-wine)]/35 bg-[var(--yu3-wine-tint)]/50 shadow-sm"
                  : "border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]",
              )}
            >
              <button
                type="button"
                className="w-full px-4 py-3 text-left"
                onClick={() => setExpandedId(isExpanded ? null : stop.id)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      cfg.icon === "circle" && "border-2",
                    )}
                    style={
                      cfg.icon === "circle"
                        ? { borderColor: "var(--yu3-ink-faint)" }
                        : undefined
                    }
                  >
                    {cfg.icon === "check" && (
                      <Check size={12} className="text-[var(--yu3-wine)]" weight="bold" />
                    )}
                    {cfg.icon === "map-pin" && <MapPin size={12} className="text-sky-600" />}
                    {cfg.icon === "clock" && <Clock size={12} className="text-amber-700" />}
                    {cfg.icon === "dot-active" && (
                      <span
                        className="h-3 w-3 rounded-full bg-[var(--yu3-wine)]"
                        aria-hidden
                      />
                    )}
                    {cfg.icon === "circle" && <span className="h-2 w-2 rounded-full bg-zinc-300" />}
                    {cfg.icon === "skip" && <SkipForward size={12} className="text-zinc-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                        Stop {stop.stop_number} of {totalCount}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          cfg.chipClass,
                        )}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-[9px] font-semibold uppercase text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
                        {STOP_TYPE_LABELS[stop.stop_type] || "Delivery"}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                      {stop.address}
                    </p>
                    {stop.items_description && (
                      <p className="mt-0.5 truncate text-[10px] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
                        {stop.items_description}
                      </p>
                    )}
                  </div>
                  {isDone && stop.completed_at && (
                    <span className="shrink-0 text-[9px] text-[var(--yu3-wine)] [font-family:var(--font-body)]">
                      {new Date(stop.completed_at).toLocaleTimeString("en-CA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-3 border-t border-[var(--yu3-line-subtle)]/80 px-4 pb-4 pt-0">
                  {(stop.customer_name || stop.customer_phone || stop.client_phone) && (
                    <div className="space-y-1">
                      {stop.customer_name && (
                        <p className="text-[11px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                          Contact: <strong>{stop.customer_name}</strong>
                        </p>
                      )}
                      {(stop.customer_phone || stop.client_phone) && (
                        <a
                          href={`tel:${stop.customer_phone || stop.client_phone}`}
                          className="text-[11px] text-[var(--yu3-wine)] underline-offset-2 hover:underline [font-family:var(--font-body)]"
                        >
                          {stop.customer_phone || stop.client_phone}
                        </a>
                      )}
                    </div>
                  )}

                  {(stop.special_instructions || stop.notes) && (
                    <div className="rounded-lg bg-[var(--yu3-bg-surface-sunken)]/90 px-3 py-2 text-[11px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                      {stop.special_instructions || stop.notes}
                    </div>
                  )}

                  {!isDone && !isPending && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {stop.stop_status === "current" && (
                        <button
                          type="button"
                          onClick={() => advanceStop(stop.id, "arrived")}
                          disabled={advancing === stop.id}
                          className="min-h-[40px] rounded-[var(--yu3-r-md)] bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 [font-family:var(--font-body)]"
                        >
                          {advancing === stop.id ? "…" : "Arrived"}
                        </button>
                      )}
                      {stop.stop_status === "arrived" && (
                        <button
                          type="button"
                          onClick={() => advanceStop(stop.id, "in_progress")}
                          disabled={advancing === stop.id}
                          className="min-h-[40px] rounded-[var(--yu3-r-md)] bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 [font-family:var(--font-body)]"
                        >
                          {advancing === stop.id
                            ? "…"
                            : stop.stop_type === "pickup"
                              ? "Loading"
                              : "Unloading"}
                        </button>
                      )}
                      {stop.stop_status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => advanceStop(stop.id, "completed")}
                          disabled={advancing === stop.id}
                          className="crew-premium-cta min-h-[40px] px-3 py-1.5 text-[11px] font-semibold text-[#FFFBF7] disabled:opacity-50 [font-family:var(--font-body)]"
                        >
                          {advancing === stop.id ? "…" : "Complete stop"}
                        </button>
                      )}
                    </div>
                  )}

                  {stop.stop_status === "pending" && !currentStop && (
                    <button
                      type="button"
                      onClick={() => advanceStop(stop.id, "current")}
                      disabled={advancing === stop.id}
                      className="crew-premium-cta min-h-[44px] px-3 py-2 text-[11px] font-semibold text-[#FFFBF7] disabled:opacity-50 [font-family:var(--font-body)]"
                    >
                      {advancing === stop.id ? "…" : "Start this stop"}
                    </button>
                  )}

                  {isDone && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--yu3-wine)] [font-family:var(--font-body)]">
                      <Check size={14} weight="bold" />
                      Completed{" "}
                      {stop.completed_at
                        ? `at ${new Date(stop.completed_at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {completedCount === totalCount && totalCount > 0 && (
        <div className="rounded-2xl border border-[var(--yu3-wine)]/30 bg-[var(--yu3-wine-tint)]/50 p-4 text-center">
          <p className="text-[15px] font-bold text-[var(--yu3-wine)] [font-family:var(--font-body)]">
            All {totalCount} stops completed
          </p>
          <p className="mt-1 text-[11px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            Day rate job is done. Great work.
          </p>
        </div>
      )}
    </div>
  );
}
