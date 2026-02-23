"use client";

import Link from "next/link";
import { MOVE_STATUS_LINE_COLOR, DELIVERY_STATUS_LINE_COLOR } from "@/lib/move-status";

/** Timeline line color by status (delivery or move) — matches current stage */
function getLineColor(status: string): string {
  const s = (status || "").toLowerCase();
  return DELIVERY_STATUS_LINE_COLOR[s] || MOVE_STATUS_LINE_COLOR[s] || "var(--gold)";
}

/** Status → color class for schedule items (moves, deliveries, projects) */
function getStatusColor(status: string): string {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (["completed", "delivered", "paid", "confirmed"].includes(s)) return "text-[var(--grn)]";
  if (["scheduled", "in_transit", "dispatched", "in_transit"].includes(s)) return "text-[#3B82F6]";
  if (["in_progress", "pending"].includes(s)) return "text-[var(--org)]";
  if (["cancelled"].includes(s)) return "text-[var(--red)]";
  if (["quote", "project"].includes(s)) return "text-[var(--tx2)]";
  return "text-[var(--gold)]";
}

/** Schedule layout: time/date left, vertical bar, status + title + subtitle. Used for moves, deliveries, projects. */
export function ScheduleDeliveryItem({
  href,
  timeSlot,
  pill,
  status,
  title,
  subtitle,
}: {
  href: string;
  timeSlot: string;
  pill?: React.ReactNode;
  status: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="flex gap-3 py-4 hover:bg-[var(--bg)]/30 transition-colors -mx-4 px-4 rounded-lg">
      <div className="flex flex-col items-start shrink-0 w-14">
        <span className="text-[12px] font-semibold text-[var(--tx)]">{timeSlot}</span>
        {pill && (
          <span className="inline-flex mt-1 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-[var(--bg)]/60 backdrop-blur-sm border border-[var(--brd)]/40 text-[var(--tx2)]">
            {pill}
          </span>
        )}
      </div>
      <div className="w-1 rounded-full shrink-0 min-h-[48px]" style={{ backgroundColor: getLineColor(status) }} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${getStatusColor(status)}`}>{status}</div>
        <div className="text-[14px] font-bold font-heading text-[var(--tx)]">{title}</div>
        <div className="text-[11px] text-[var(--tx3)] mt-0.5">{subtitle}</div>
      </div>
    </Link>
  );
}

/** Schedule layout for moves: date/index left, vertical bar, status + client + address. */
export function ScheduleMoveItem({
  href,
  leftPrimary,
  leftSecondary,
  status,
  title,
  subtitle,
  price,
}: {
  href: string;
  leftPrimary: string;
  leftSecondary?: string;
  status: string;
  title: string;
  subtitle: string;
  price?: string;
}) {
  return (
    <Link href={href} className="flex gap-3 py-4 hover:bg-[var(--bg)]/30 transition-colors -mx-4 px-4 rounded-lg">
      <div className="flex flex-col items-start shrink-0 w-14">
        <span className="text-[10px] text-[var(--tx3)]">{leftPrimary}</span>
        {leftSecondary && <span className="text-[11px] font-semibold text-[var(--tx)] mt-1">{leftSecondary}</span>}
      </div>
      <div className="w-1 rounded-full shrink-0 min-h-[48px]" style={{ backgroundColor: getLineColor(status) }} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${getStatusColor(status)}`}>{status}</div>
        <div className="text-[14px] font-bold font-heading text-[var(--tx)]">{title}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {price && <span className="text-[13px] font-bold text-[var(--gold)]">{price}</span>}
          <span className="text-[11px] text-[var(--tx3)] truncate">{subtitle}</span>
        </div>
      </div>
    </Link>
  );
}

/** Schedule layout for deliveries - button variant (opens modal). */
export function ScheduleDeliveryButton({
  onClick,
  timeSlot,
  pill,
  status,
  title,
  subtitle,
}: {
  onClick: () => void;
  timeSlot: string;
  pill?: React.ReactNode;
  status: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex gap-3 py-4 hover:bg-[var(--bg)]/30 transition-colors -mx-4 px-4 rounded-lg w-full text-left"
    >
      <div className="flex flex-col items-start shrink-0 w-14">
        <span className="text-[12px] font-semibold text-[var(--tx)]">{timeSlot}</span>
        {pill && (
          <span className="inline-flex mt-1 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-[var(--bg)]/60 backdrop-blur-sm border border-[var(--brd)]/40 text-[var(--tx2)]">
            {pill}
          </span>
        )}
      </div>
      <div className="w-1 rounded-full shrink-0 min-h-[48px]" style={{ backgroundColor: getLineColor(status) }} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-bold uppercase tracking-wide mb-0.5 ${getStatusColor(status)}`}>{status}</div>
        <div className="text-[14px] font-bold font-heading text-[var(--tx)]">{title}</div>
        <div className="text-[11px] text-[var(--tx3)] mt-0.5">{subtitle}</div>
      </div>
    </button>
  );
}
