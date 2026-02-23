"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";
import FilterBar from "./components/FilterBar";
import LiveOperationsCard from "./components/LiveOperationsCard";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import { getStatusLabel, normalizeStatus, MOVE_STATUS_COLORS_ADMIN, MOVE_STATUS_LINE_COLOR, DELIVERY_STATUS_LINE_COLOR } from "@/lib/move-status";

const BADGE_MAP: Record<string, string> = {
  pending: "b-go",
  scheduled: "b-bl",
  confirmed: "b-bl",
  dispatched: "b-or",
  "in-transit": "b-or",
  delivered: "b-gr",
  cancelled: "b-rd",
};

function getBadgeClass(status: string) {
  return `bdg ${BADGE_MAP[status] || "b-go"}`;
}

const DELIVERY_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in-transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const MOVE_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type Delivery = {
  id: string;
  customer_name?: string;
  client_name?: string;
  items?: unknown[];
  time_slot?: string;
  status?: string;
  category?: string;
  scheduled_date?: string;
};

type Move = {
  id: string;
  client_name?: string;
  from_address?: string;
  to_address?: string;
  scheduled_date?: string;
  status?: string;
  move_type?: string;
};

type ActivityEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

interface EodSummary {
  submitted: { teamId: string; teamName: string; summary?: Record<string, unknown>; generatedAt?: string }[];
  pending: { teamId: string; teamName: string }[];
  totalTeams: number;
  submittedCount: number;
}

interface AdminPageClientProps {
  todayDeliveries: Delivery[];
  yesterdayDeliveriesCount?: number;
  allDeliveries: Delivery[];
  b2cUpcoming: Move[];
  overdueAmount: number;
  overdueInvoicesCount?: number;
  currentMonthRevenue: number;
  revenuePctChange: number;
  monthlyRevenue: { m: string; v: number }[];
  categoryBgs: Record<string, string>;
  categoryIcons: Record<string, string>;
  activityEvents?: ActivityEvent[];
  eodSummary?: EodSummary;
}

function getActivityHref(e: ActivityEvent): string {
  if (e.entity_type === "move") return `/admin/moves/${e.entity_id}`;
  if (e.entity_type === "delivery") return e.entity_id ? `/admin/deliveries/${e.entity_id}` : "/admin/deliveries";
  if (e.entity_type === "invoice") return "/admin/invoices";
  return "/admin";
}

function formatActivityTime(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatActivityDescription(desc: string, eventType?: string): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) {
    const [, name, status] = match;
    const statusLabel = getStatusLabel(status || null);
    return `${name} · ${statusLabel}`;
  }
  if (desc.toLowerCase().includes("final payment") || desc.toLowerCase().includes("payment received")) {
    const nameMatch = desc.match(/(.+?)\s*·|(.+?)\s*—/);
    const name = nameMatch ? (nameMatch[1] || nameMatch[2] || "").trim() : desc.split(/[·—]/)[0]?.trim() || desc;
    return `${name} · Paid`;
  }
  return desc;
}

function getActivityIcon(eventType: string, description: string | null): string {
  const et = (eventType || "").toLowerCase();
  const desc = (description || "").toLowerCase();
  if (et === "payment" || desc.includes("payment") || desc.includes("paid")) return "dollar";
  if (et === "client_message" || desc.includes("message")) return "messageSquare";
  if (et === "created" || desc.includes("new booking") || desc.includes("new referral")) return "calendar";
  if (et === "status_change" || et === "notification") return "target";
  return "bell";
}

const GROUP_WINDOW_MS = 30 * 60 * 1000; // 30 min

function groupActivityEvents(events: ActivityEvent[]): { id: string; events: ActivityEvent[]; count: number }[] {
  const groups: { id: string; events: ActivityEvent[]; count: number }[] = [];
  for (const e of events) {
    const key = `${e.entity_type}:${e.entity_id}`;
    const last = groups[groups.length - 1];
    const lastTime = last ? new Date(last.events[0].created_at).getTime() : 0;
    const thisTime = new Date(e.created_at).getTime();
    if (last && last.id === key && thisTime - lastTime < GROUP_WINDOW_MS) {
      last.events.unshift(e);
      last.count = last.events.length;
    } else {
      groups.push({ id: key, events: [e], count: 1 });
    }
  }
  return groups;
}

const ICON_BG: Record<string, string> = {
  mail: "var(--bldim)",
  check: "var(--grdim)",
  dollar: "var(--grdim)",
  truck: "var(--gdim)",
  package: "var(--gdim)",
  party: "var(--gdim)",
  clipboard: "var(--bldim)",
  home: "var(--gdim)",
  bell: "var(--gdim)",
  target: "var(--bldim)",
  messageSquare: "var(--bldim)",
  calendar: "var(--grdim)",
};

export default function AdminPageClient({
  todayDeliveries,
  allDeliveries,
  b2cUpcoming,
  overdueAmount,
  currentMonthRevenue,
  revenuePctChange,
  monthlyRevenue,
  categoryBgs,
  categoryIcons,
  activityEvents = [],
  eodSummary,
}: AdminPageClientProps) {
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("");
  const [moveStatusFilter, setMoveStatusFilter] = useState("");
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  useEffect(() => {
    if (!activityModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activityModalOpen]);

  const filteredDeliveries = deliveryStatusFilter
    ? (todayDeliveries.length > 0 ? todayDeliveries : allDeliveries.slice(0, 5)).filter(
        (d) => (d.status || "").toLowerCase() === deliveryStatusFilter.toLowerCase()
      )
    : todayDeliveries.length > 0 ? todayDeliveries : allDeliveries.slice(0, 5);

  const filteredMoves = moveStatusFilter
    ? b2cUpcoming.filter((m) => (m.status || "").toLowerCase() === moveStatusFilter.toLowerCase())
    : b2cUpcoming;

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      {/* Metrics — horizontal scroll on mobile, grid on desktop */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)]/50 p-4 mb-6 -mx-3 sm:mx-0">
        <div className="flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory pb-1 pl-1 pr-3 scrollbar-hide md:overflow-visible md:grid md:grid-cols-3 lg:grid-cols-6 md:snap-none md:pl-0 md:pr-0" style={{ WebkitOverflowScrolling: "touch" }}>
          <Link href="/admin/deliveries" className="embossed-hover group flex flex-col gap-1 p-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)]/40 hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-all min-w-[140px] shrink-0 snap-start md:min-w-0 md:shrink">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[var(--tx3)]">Today&apos;s Deliveries</span>
            <span className="text-[22px] font-bold font-heading text-[var(--tx)] tabular-nums">{todayDeliveries.length}</span>
            <span className="text-[10px] text-[var(--tx3)]">Scheduled today</span>
          </Link>
          <Link href="/admin/deliveries?filter=pending" className="embossed-hover group flex flex-col gap-1 p-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)]/40 hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-all min-w-[140px] shrink-0 snap-start md:min-w-0 md:shrink">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[var(--tx3)]">Pending</span>
            <span className="text-[22px] font-bold font-heading text-[var(--org)] tabular-nums">{allDeliveries.filter((d) => d.status === "pending").length}</span>
            <span className="text-[10px] text-[var(--tx3)]">Awaiting schedule</span>
          </Link>
          <Link href="/admin/moves/residential" className="embossed-hover group flex flex-col gap-1 p-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)]/40 hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-all min-w-[140px] shrink-0 snap-start md:min-w-0 md:shrink">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[var(--tx3)]">B2C Moves</span>
            <span className="text-[22px] font-bold font-heading text-[var(--tx)] tabular-nums">{b2cUpcoming.length}</span>
            <span className="text-[10px] text-[var(--tx3)]">Upcoming residential</span>
          </Link>
          <Link href="/admin/revenue" className="embossed-hover group flex flex-col gap-1 p-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)]/40 hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-all min-w-[140px] shrink-0 snap-start md:min-w-0 md:shrink">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[var(--tx3)]">Revenue</span>
            <span className="text-[22px] font-bold font-heading text-[var(--tx)] tabular-nums">
              {currentMonthRevenue >= 1000 ? `$${(currentMonthRevenue / 1000).toFixed(1)}K` : formatCurrency(currentMonthRevenue)}
            </span>
            <span className={`text-[10px] ${revenuePctChange >= 0 ? "text-[var(--grn)]" : "text-[var(--red)]"}`}>
              {currentMonthRevenue > 0 || revenuePctChange !== 0
                ? `${revenuePctChange >= 0 ? "↑" : "↓"} ${Math.abs(revenuePctChange)}% vs last month`
                : "This month"}
            </span>
          </Link>
          <Link href="/admin/invoices" className="embossed-hover group flex flex-col gap-1 p-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)]/40 hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-all min-w-[140px] shrink-0 snap-start md:min-w-0 md:shrink">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[var(--tx3)]">Overdue</span>
            <span className="text-[22px] font-bold font-heading text-[var(--red)] tabular-nums">{formatCompactCurrency(overdueAmount)}</span>
            <span className="text-[10px] text-[var(--tx3)]">Past due</span>
          </Link>
          <Link href="/admin/reports" className="embossed-hover group flex flex-col gap-1 p-3 rounded-lg border border-[var(--brd)]/60 bg-[var(--card)]/40 hover:border-[var(--gold)] hover:bg-[var(--gdim)] transition-all min-w-[140px] shrink-0 snap-start md:min-w-0 md:shrink">
            <span className="text-[10px] font-medium tracking-wide uppercase text-[var(--tx3)]">EOD Reports</span>
            <span className="text-[22px] font-bold font-heading text-[var(--tx)] tabular-nums">{eodSummary?.submittedCount ?? 0}/{eodSummary?.totalTeams ?? 0}</span>
            <span className="text-[10px] text-[var(--tx3)]">{eodSummary?.pending?.length ? `${eodSummary.pending.length} pending` : "All submitted"}</span>
          </Link>
        </div>
      </div>

      <LiveOperationsCard />

      {/* Today's B2B Deliveries - schedule layout */}
      <div className="glass rounded-xl overflow-hidden mt-6 sm:mt-8">
        <div className="sh px-4 pt-4">
          <div className="sh-t">Your schedule for today</div>
          <Link href="/admin/deliveries" className="sh-l">All →</Link>
        </div>
        <FilterBar
          filters={[
            {
              key: "status",
              label: "Status",
              value: deliveryStatusFilter,
              options: DELIVERY_STATUS_OPTIONS,
              onChange: setDeliveryStatusFilter,
            },
          ]}
          hasActiveFilters={!!deliveryStatusFilter}
          onClear={() => setDeliveryStatusFilter("")}
        />
        <div className="divide-y divide-[var(--brd)]/50 px-6 pb-4">
        {filteredDeliveries.slice(0, 5).map((d) => {
          const statusKey = (d.status || "").toLowerCase();
          const lineColor = DELIVERY_STATUS_LINE_COLOR[statusKey] || "var(--gold)";
          return (
          <Link key={d.id} href={getDeliveryDetailPath(d)} className="flex gap-3 py-4 pl-8 pr-5 hover:bg-[var(--bg)]/30 transition-colors rounded-lg">
            <div className="flex flex-col items-start shrink-0 w-14">
              <span className="text-[12px] font-semibold text-[var(--tx)]">{d.time_slot || "—"}</span>
              <span className="inline-flex mt-1 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-[var(--bg)]/60 backdrop-blur-sm border border-[var(--brd)]/40 text-[var(--tx2)]">
                {d.items?.length || 0} items
              </span>
            </div>
            <div className="w-1 rounded-full shrink-0 min-h-[48px]" style={{ backgroundColor: lineColor }} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className={`inline-flex px-2.5 py-1 rounded-md text-[9px] font-bold mb-1.5 ${getBadgeClass(statusKey)}`}>{(d.status || "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—"}</div>
              <div className="text-[14px] font-bold font-heading text-[var(--tx)]">{d.customer_name} ({d.client_name})</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">{(d.category || "Delivery")} • {d.client_name}</div>
            </div>
          </Link>
          );
        })}
        </div>
      </div>

      {/* B2C Moves - schedule layout */}
      <div className="glass rounded-xl overflow-hidden mt-4">
        <div className="sh px-4 pt-4">
          <div className="sh-t">Starting soon</div>
          <Link href="/admin/moves/residential" className="sh-l">All →</Link>
        </div>
        <FilterBar
          filters={[
            {
              key: "status",
              label: "Status",
              value: moveStatusFilter,
              options: MOVE_STATUS_OPTIONS,
              onChange: setMoveStatusFilter,
            },
          ]}
          hasActiveFilters={!!moveStatusFilter}
          onClear={() => setMoveStatusFilter("")}
        />
        <div className="divide-y divide-[var(--brd)]/50 px-6 pb-4">
        {filteredMoves.slice(0, 5).map((m, idx) => {
          const statusKey = (m.status || "").toLowerCase();
          const normalized = normalizeStatus(m.status ?? null) || "";
          const lineColor = MOVE_STATUS_LINE_COLOR[statusKey] || MOVE_STATUS_LINE_COLOR[normalized] || "var(--gold)";
          const statusStyle = MOVE_STATUS_COLORS_ADMIN[statusKey] || MOVE_STATUS_COLORS_ADMIN[normalized] || "text-[var(--tx3)] bg-[var(--gdim)]";
          return (
          <Link key={m.id} href={getMoveDetailPath(m)} className="flex gap-3 py-4 pl-8 pr-5 hover:bg-[var(--bg)]/30 transition-colors rounded-lg">
            <div className="flex flex-col items-start shrink-0 w-14">
              <span className="text-[10px] text-[var(--tx3)]">{String(idx + 1).padStart(2, "0")}</span>
              <span className="text-[11px] font-semibold text-[var(--tx)] mt-1">{formatMoveDate(m.scheduled_date)}</span>
            </div>
            <div className="w-1 rounded-full shrink-0 min-h-[48px]" style={{ backgroundColor: lineColor }} aria-hidden />
            <div className="flex-1 min-w-0">
              <div className={`inline-flex px-2.5 py-1 rounded-md text-[9px] font-bold mb-1.5 ${statusStyle}`}>{getStatusLabel(m.status ?? null)}</div>
              <div className="text-[14px] font-bold font-heading text-[var(--tx)]">{m.client_name}</div>
              <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">{m.from_address} → {m.to_address}</div>
            </div>
          </Link>
          );
        })}
        </div>
      </div>

      {/* g2 - Monthly Revenue + Activity: horizontal scroll on mobile, grid on desktop */}
      <div className="relative mt-4">
        <div className="flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Monthly Revenue card - glass */}
          <div className="glass min-w-[85vw] max-w-[90vw] md:min-w-0 md:max-w-none flex-shrink-0 snap-start rounded-[20px] p-5 flex flex-col min-h-0 transition-transform duration-200 active:scale-[0.98] md:active:scale-100 overflow-hidden">
            <div className="sh shrink-0">
              <div className="sh-t">Monthly Revenue</div>
              <Link href="/admin/revenue" className="sh-l">Details →</Link>
            </div>
            <div className="flex items-end gap-2 h-[130px] pt-1 shrink-0">
            {(monthlyRevenue.length > 0 ? monthlyRevenue : [{ m: "—", v: 0 }]).map((d, i) => {
              const maxV = Math.max(1, ...monthlyRevenue.map((x) => x.v));
              const pct = Math.round((d.v / maxV) * 100);
              const isNow = monthlyRevenue.length > 0 && i === monthlyRevenue.length - 1;
              const valLabel = d.v >= 1 ? `$${d.v.toFixed(1)}K` : formatCurrency(d.v * 1000);
              return (
                <div key={`${d.m}-${i}`} className="flex-1 flex flex-col items-center gap-1 h-full min-w-0">
                  <span className={`text-[10px] font-semibold tabular-nums ${isNow ? "text-[var(--gold)]" : "text-[var(--tx2)]"}`}>
                    {valLabel}
                  </span>
                  <div className="flex-1 w-full flex items-end min-h-[48px]">
                    <div
                      className="w-full rounded-t-md min-h-[4px] transition-all duration-300"
                      style={{
                        height: `${Math.max(pct, 8)}%`,
                        background: isNow
                          ? "linear-gradient(180deg, var(--gold) 0%, var(--gold2) 100%)"
                          : "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
                        boxShadow: isNow ? "0 -2px 12px rgba(201,169,98,0.25)" : "none",
                      }}
                    />
                  </div>
                  <span className={`text-[9px] font-medium ${isNow ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>{d.m}</span>
                </div>
              );
            })}
            </div>
          </div>

          {/* Activity card - glass, relative for right-edge fade */}
          <div className="glass relative min-w-[85vw] max-w-[90vw] md:min-w-0 md:max-w-none flex-shrink-0 snap-start rounded-[20px] p-5 flex flex-col min-h-0 transition-transform duration-200 active:scale-[0.98] md:active:scale-100 overflow-hidden" style={{ minHeight: 200 }}>
            <div className="sh shrink-0">
              <div className="sh-t">Activity</div>
            <button
              type="button"
              onClick={() => setActivityModalOpen(true)}
              className="sh-l bg-transparent border-none cursor-pointer p-0 font-inherit text-inherit"
            >
              View all activity →
            </button>
          </div>
          {activityEvents.length > 0 ? (
            (() => {
              const deduped = activityEvents.filter((a, i) => {
                if (i === 0) return true;
                return activityEvents[i - 1].description !== a.description;
              });
              const grouped = groupActivityEvents(deduped);
              return (
                <div className="space-y-1 overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 220 }}>
                  {grouped.slice(0, 8).map((item, idx) => (
                    item.count > 1 ? (
                      <Link
                        key={`${item.id}-${item.events[0].created_at}-${idx}`}
                        href={getActivityHref(item.events[0])}
                        className="act-item block rounded-lg px-2 py-2.5 -mx-2 hover:bg-[var(--bg)]/40 transition-colors border-b border-[var(--brd)]/30 last:border-0"
                      >
                        <div className="act-dot flex items-center justify-center text-[var(--tx2)]" style={{ background: ICON_BG[getActivityIcon(item.events[0].event_type, item.events[0].description)] || "var(--gdim)" }}>
                          <Icon name={getActivityIcon(item.events[0].event_type, item.events[0].description)} className="w-[14px] h-[14px]" />
                        </div>
                        <div className="act-body min-w-0">
                          <div className="act-t">{formatActivityDescription(item.events[0].description || item.events[0].event_type, item.events[0].event_type).split(" · ")[0]} — {item.count} updates (latest: {formatActivityDescription(item.events[0].description || item.events[0].event_type, item.events[0].event_type).split(" · ")[1] || "—"})</div>
                          <div className="act-tm">{formatActivityTime(item.events[0].created_at)}</div>
                        </div>
                      </Link>
                    ) : (
                      <Link key={`${item.id}-${item.events[0].created_at}-${idx}`} href={getActivityHref(item.events[0])} className="act-item block rounded-lg px-2 py-2.5 -mx-2 hover:bg-[var(--bg)]/40 transition-colors border-b border-[var(--brd)]/30 last:border-0">
                        <div className="act-dot flex items-center justify-center text-[var(--tx2)]" style={{ background: ICON_BG[getActivityIcon(item.events[0].event_type, item.events[0].description)] || "var(--gdim)" }}>
                          <Icon name={getActivityIcon(item.events[0].event_type, item.events[0].description)} className="w-[14px] h-[14px]" />
                        </div>
                        <div className="act-body min-w-0">
                          <div className="act-t">{formatActivityDescription(item.events[0].description || item.events[0].event_type, item.events[0].event_type)}</div>
                          <div className="act-tm">{formatActivityTime(item.events[0].created_at)}</div>
                        </div>
                      </Link>
                    )
                  ))}
                </div>
              );
            })()
          ) : (
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 220 }}>
              {[
                { ic: "package", bg: "var(--gdim)", t: "Delivery in transit", tm: "9:12 AM", href: "/admin/deliveries" },
                { ic: "check", bg: "var(--grdim)", t: "Invoice paid", tm: "8:45 AM", href: "/admin/invoices" },
                { ic: "home", bg: "var(--gdim)", t: "Move materials delivered", tm: "8:30 AM", href: "/admin/moves/residential" },
                { ic: "clipboard", bg: "var(--bldim)", t: "New referral: Williams", tm: "8:15 AM", href: "/admin/partners/realtors" },
              ].map((a) => (
                <Link key={a.t} href={a.href} className="act-item block rounded-lg px-2 py-2.5 -mx-2 hover:bg-[var(--bg)]/40 transition-colors border-b border-[var(--brd)]/30 last:border-0">
                  <div className="act-dot flex items-center justify-center text-[var(--tx2)]" style={{ background: a.bg }}>
                    <Icon name={a.ic} className="w-[14px] h-[14px]" />
                  </div>
                  <div className="act-body">
                    <div className="act-t">{a.t}</div>
                    <div className="act-tm">{a.tm}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
            {/* Subtle right-edge fade on Activity card (mobile) - indicates more content */}
            <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-[var(--card)]/90 to-transparent md:hidden rounded-r-[20px]" aria-hidden="true" />
          </div>
        </div>
        {/* Right edge fade on scroll container - mobile only */}
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-[var(--bg)] to-transparent md:hidden" aria-hidden="true" />
      </div>

      {activityModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex min-h-dvh min-h-screen items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title">
            <div className="fixed inset-0 bg-black/50" onClick={() => setActivityModalOpen(false)} aria-hidden="true" />
            <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brd)] shrink-0">
                <h3 id="activity-modal-title" className="font-heading text-[15px] font-bold text-[var(--tx)]">All Activity</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setActivityModalOpen(false)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Mark all read</button>
                  <button type="button" onClick={() => setActivityModalOpen(false)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-lg leading-none" aria-label="Close">&times;</button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0 p-2">
                {activityEvents.length > 0 ? (
                  groupActivityEvents(activityEvents.filter((a, i) => i === 0 || activityEvents[i - 1].description !== a.description)).map((item, idx) =>
                    item.count > 1 ? (
                      <Link
                        key={`${item.id}-${item.events[0].created_at}-${idx}`}
                        href={getActivityHref(item.events[0])}
                        onClick={() => setActivityModalOpen(false)}
                        className="act-item block rounded-lg px-2 py-2.5 -mx-2 hover:bg-[var(--bg)]/40 transition-colors border-b border-[var(--brd)]/30 last:border-0"
                      >
                        <div className="act-dot flex items-center justify-center text-[var(--tx2)]" style={{ background: ICON_BG[getActivityIcon(item.events[0].event_type, item.events[0].description)] || "var(--gdim)" }}>
                          <Icon name={getActivityIcon(item.events[0].event_type, item.events[0].description)} className="w-[14px] h-[14px]" />
                        </div>
                        <div className="act-body min-w-0">
                          <div className="act-t">{formatActivityDescription(item.events[0].description || item.events[0].event_type, item.events[0].event_type).split(" · ")[0]} — {item.count} updates (latest: {formatActivityDescription(item.events[0].description || item.events[0].event_type, item.events[0].event_type).split(" · ")[1] || "—"})</div>
                          <div className="act-tm">{formatActivityTime(item.events[0].created_at)}</div>
                        </div>
                      </Link>
                    ) : (
                      <Link
                        key={`${item.id}-${item.events[0].created_at}-${idx}`}
                        href={getActivityHref(item.events[0])}
                        onClick={() => setActivityModalOpen(false)}
                        className="act-item block rounded-lg px-2 py-2.5 -mx-2 hover:bg-[var(--bg)]/40 transition-colors border-b border-[var(--brd)]/30 last:border-0"
                      >
                        <div className="act-dot flex items-center justify-center text-[var(--tx2)]" style={{ background: ICON_BG[getActivityIcon(item.events[0].event_type, item.events[0].description)] || "var(--gdim)" }}>
                          <Icon name={getActivityIcon(item.events[0].event_type, item.events[0].description)} className="w-[14px] h-[14px]" />
                        </div>
                        <div className="act-body min-w-0">
                          <div className="act-t">{formatActivityDescription(item.events[0].description || item.events[0].event_type, item.events[0].event_type)}</div>
                          <div className="act-tm">{formatActivityTime(item.events[0].created_at)}</div>
                        </div>
                      </Link>
                    )
                  )
                ) : (
                  <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">No activity yet</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
