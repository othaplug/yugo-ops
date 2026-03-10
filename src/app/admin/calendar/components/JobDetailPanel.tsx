"use client";

import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, STATUS_DOT_COLORS } from "@/lib/calendar/types";
import { toTitleCase, formatAddressForDisplay } from "@/lib/format-text";
import { Icon } from "@/components/AppIcons";
import Link from "next/link";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  move: "Move",
  delivery: "Delivery",
  project_phase: "Project Phase",
  blocked: "Blocked Time",
};

export default function JobDetailPanel({ event, onClose }: Props) {
  if (!event) return null;

  const dotColor = STATUS_DOT_COLORS[event.calendarStatus] || STATUS_DOT_COLORS.scheduled;
  const timeStr = event.start
    ? event.end
      ? `${formatTime12(event.start)} – ${formatTime12(event.end)}`
      : formatTime12(event.start)
    : event.date
      ? "Time not set"
      : "Not scheduled";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-[420px] bg-[var(--card)] border-l border-[var(--brd)] h-full overflow-y-auto shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: event.color }} />
              <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">
                {TYPE_LABELS[event.type] || event.type}
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                style={{ backgroundColor: `${dotColor}20`, color: dotColor }}
              >
                {toTitleCase(event.calendarStatus)}
              </span>
            </div>
            <h2 className="text-[18px] font-bold text-[var(--tx)]">{event.name}</h2>
            <p className="text-[12px] text-[var(--tx3)] mt-0.5">{toTitleCase(event.description)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Time */}
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">Time</div>
            <div className="text-[14px] font-semibold text-[var(--tx)]">{timeStr}</div>
            {event.durationHours && (
              <div className="text-[11px] text-[var(--tx3)]">{event.durationHours} hours estimated</div>
            )}
            <div className="text-[11px] text-[var(--tx3)]">
              {new Date(event.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>

          {/* Team & Truck */}
          {(event.crewName || event.truckName) && (
            <div>
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">Assignment</div>
              {event.crewName && <div className="flex items-center gap-1.5 text-[13px] text-[var(--tx)]"><Icon name="users" className="w-3.5 h-3.5 shrink-0 stroke-[1.75] stroke-current text-[var(--tx3)]" /> {event.crewName}</div>}
              {event.truckName && <div className="flex items-center gap-1.5 text-[13px] text-[var(--tx)]"><Icon name="truck" className="w-3.5 h-3.5 shrink-0 stroke-[1.75] stroke-current text-[var(--tx3)]" /> {event.truckName}</div>}
            </div>
          )}

          {/* Addresses */}
          {(event.fromAddress || event.toAddress || event.deliveryAddress) && (
            <div>
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">Location</div>
              {event.fromAddress && (
                <div className="text-[12px] text-[var(--tx)]">
                  <span className="text-[var(--tx3)]">From:</span> {formatAddressForDisplay(event.fromAddress)}
                </div>
              )}
              {event.toAddress && (
                <div className="text-[12px] text-[var(--tx)]">
                  <span className="text-[var(--tx3)]">To:</span> {formatAddressForDisplay(event.toAddress)}
                </div>
              )}
              {event.deliveryAddress && (
                <div className="text-[12px] text-[var(--tx)]">
                  <span className="text-[var(--tx3)]">Deliver to:</span> {formatAddressForDisplay(event.deliveryAddress)}
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">Details</div>
            {event.moveSize && <div className="text-[12px] text-[var(--tx)]">Size: {event.moveSize}</div>}
            {event.itemCount && <div className="text-[12px] text-[var(--tx)]">Items: {event.itemCount}</div>}
            {event.category && <div className="text-[12px] text-[var(--tx)]">Category: {toTitleCase(event.category)}</div>}
          </div>

          {/* Link to detail */}
          {event.href && (
            <Link
              href={event.href}
              className="block w-full text-center py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
            >
              View Full Details →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
