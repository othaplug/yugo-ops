"use client";

import Link from "next/link";

type BadgeType = "project" | "move-residential" | "move-office";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const m = dateStr.match(/(\w+)\s*(\d+)/) || dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    if (m[2] && !m[3]) return `${m[1]} ${m[2]}`;
    if (m[3]) {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }
  return dateStr;
}

function formatTime(time: string | null | undefined): string {
  if (!time || !time.trim()) return "";
  return time.trim();
}

const STATUS_LABELS: Record<BadgeType, string> = {
  "project": "Project",
  "move-residential": "Move",
  "move-office": "Office",
};

interface UpcomingItemProps {
  href: string;
  name: string;
  date: string | null | undefined;
  time?: string | null;
  badgeType: BadgeType;
}

export default function UpcomingItem({ href, name, date, time, badgeType }: UpcomingItemProps) {
  const dateFormatted = formatDate(date);
  const timeFormatted = formatTime(time);
  const secondary = timeFormatted ? `${dateFormatted} • ${timeFormatted}` : dateFormatted;

  return (
    <Link href={href} className="flex gap-3 py-3 pl-8 pr-5 hover:bg-[var(--bg)]/30 transition-colors rounded-lg">
      <div className="flex flex-col items-start shrink-0 w-14">
        <span className="text-[10px] text-[var(--tx3)]">{dateFormatted}</span>
        {timeFormatted && <span className="text-[11px] font-semibold text-[var(--tx)] mt-1">{timeFormatted}</span>}
      </div>
      <div className="w-1 rounded-full shrink-0 bg-[var(--gold)]/80 min-h-[40px]" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-semibold text-[var(--tx3)] mb-0.5">{STATUS_LABELS[badgeType]}</div>
        <div className="text-[13px] font-bold font-heading text-[var(--tx)] truncate">{name}</div>
        <div className="text-[10px] text-[var(--tx3)] mt-0.5">{secondary}</div>
      </div>
    </Link>
  );
}
