"use client";

import Link from "next/link";

type BadgeType = "project" | "move-residential" | "move-office";

const BADGE_STYLES: Record<BadgeType, string> = {
  "project": "bg-[#6B7280]/15 text-[#6B7280]",
  "move-residential": "bg-[#4A7CE5]/15 text-[#4A7CE5]",
  "move-office": "bg-[rgba(201,169,98,0.2)] text-[var(--gold)]",
};

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
  const t = time.trim();
  if (/^\d{1,2}:\d{2}/.test(t) || /^\d{1,2}\s*[ap]m/i.test(t)) return t;
  return t;
}

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
    <Link
      href={href}
      className="group relative block px-4 py-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--brd)] hover:border-[var(--gold)]/50 hover:bg-[var(--gdim)]/30 hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99]"
    >
      <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-medium ${BADGE_STYLES[badgeType]}`}>
        {badgeType === "project" ? "Project" : badgeType === "move-office" ? "Office" : "Move"}
      </span>
      <div className="pr-16 min-w-0">
        <div className="text-[13px] font-semibold text-[var(--tx)] truncate">{name}</div>
        <div className="text-[11px] text-[var(--tx3)] mt-0.5">{secondary}</div>
      </div>
    </Link>
  );
}
