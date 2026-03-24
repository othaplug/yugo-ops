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
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function getActivityHref(e: ActivityEventRow): string {
  if (e.entity_type === "move") return `/admin/moves/${e.entity_id}`;
  if (e.entity_type === "delivery") return e.entity_id ? `/admin/deliveries/${e.entity_id}` : "/admin/deliveries";
  if (e.entity_type === "invoice") return "/admin/invoices";
  if (e.entity_type === "quote") return `/admin/quotes/${e.entity_id}/edit`;
  return "/admin/activity";
}

export function formatActivityDescription(desc: string): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) return `${match[1]} · ${getStatusLabel(match[2] || null)}`;
  if (desc.toLowerCase().includes("payment")) {
    const nameMatch = desc.match(/(.+?)\s*[·-]/);
    return nameMatch ? `${nameMatch[1].trim()} · Paid` : desc;
  }
  return desc.length > 72 ? desc.slice(0, 69) + "…" : desc;
}
