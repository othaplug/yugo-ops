import { getStatusLabel } from "@/lib/move-status";

export type ActivityEventRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

export function formatActivityTime(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 0) return "just now";
  if (secs < 45) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;

  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const isToday = startOfDay(d) === startOfDay(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = startOfDay(d) === startOfDay(yesterday);

  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday · ${timeStr}`;

  const showYear = d.getFullYear() !== now.getFullYear();
  const datePart = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(showYear ? { year: "numeric" as const } : {}),
  });
  return `${datePart} · ${timeStr}`;
}

export function getActivityHref(e: ActivityEventRow): string {
  if (e.entity_type === "move") return `/admin/moves/${e.entity_id}`;
  if (e.entity_type === "delivery")
    return e.entity_id
      ? `/admin/deliveries/${e.entity_id}`
      : "/admin/deliveries";
  if (e.entity_type === "invoice") return "/admin/invoices";
  if (e.entity_type === "quote") return `/admin/quotes/${e.entity_id}/edit`;
  if (e.entity_type === "crew") return "/admin/platform";
  return "/admin/activity";
}

/** `truncateAt`: max characters before ellipsis; omit or `null` for no cap (use CSS line-clamp in UI). */
export function formatActivityDescription(
  desc: string,
  opts?: { truncateAt?: number | null },
): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) return `${match[1]} · ${getStatusLabel(match[2] || null)}`;
  if (desc.toLowerCase().includes("payment")) {
    const nameMatch = desc.match(/(.+?)\s*[·-]/);
    return nameMatch ? `${nameMatch[1].trim()} · Paid` : desc;
  }
  const max =
    opts?.truncateAt === undefined ? 72 : opts.truncateAt;
  if (max === null || max <= 0) return desc;
  return desc.length > max ? desc.slice(0, max - 1) + "…" : desc;
}
