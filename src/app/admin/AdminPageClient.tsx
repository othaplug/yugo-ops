"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";
import FilterBar from "./components/FilterBar";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import { getStatusLabel } from "@/lib/move-status";

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

interface AdminPageClientProps {
  todayDeliveries: Delivery[];
  allDeliveries: Delivery[];
  b2cUpcoming: Move[];
  overdueAmount: number;
  categoryBgs: Record<string, string>;
  categoryIcons: Record<string, string>;
  activityEvents?: ActivityEvent[];
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

function formatActivityDescription(desc: string): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) {
    const [, name, status] = match;
    const statusLabel = (status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${name} · ${statusLabel}`;
  }
  return desc;
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
};

export default function AdminPageClient({
  todayDeliveries,
  allDeliveries,
  b2cUpcoming,
  overdueAmount,
  categoryBgs,
  categoryIcons,
  activityEvents = [],
}: AdminPageClientProps) {
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("");
  const [moveStatusFilter, setMoveStatusFilter] = useState("");

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
      {/* Metrics - .metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Link href="/admin/deliveries" className="mc">
          <div className="mc-l">Today</div>
          <div className="mc-v">{todayDeliveries.length}</div>
        </Link>
        <Link href="/admin/deliveries?filter=pending" className="mc">
          <div className="mc-l">Pending</div>
          <div className="mc-v text-[var(--org)]">{allDeliveries.filter((d) => d.status === "pending").length}</div>
        </Link>
        <Link href="/admin/revenue" className="mc">
          <div className="mc-l">Revenue (Feb)</div>
          <div className="mc-v">$38.4K</div>
          <div className="mc-c up">↑ 23%</div>
        </Link>
        <Link href="/admin/invoices" className="mc">
          <div className="mc-l">Overdue</div>
          <div className="mc-v text-[var(--red)]">{formatCurrency(overdueAmount)}</div>
        </Link>
        <Link href="/admin/moves/residential" className="mc">
          <div className="mc-l">B2C</div>
          <div className="mc-v">{b2cUpcoming.length}</div>
        </Link>
      </div>

      {/* Today's B2B Deliveries */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="sh px-4 pt-4">
          <div className="sh-t">Today&apos;s B2B Deliveries</div>
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
        <div className="dl px-4 pb-4 dc-wrap">
        {filteredDeliveries.slice(0, 5).map((d) => (
          <Link key={d.id} href={getDeliveryDetailPath(d)} className="dc">
            <div
              className="dc-ic flex items-center justify-center text-[var(--tx2)]"
              style={{ background: categoryBgs[d.category || ""] || "var(--gdim)" }}
            >
              <Icon name={categoryIcons[d.category || ""] || "package"} className="w-[16px] h-[16px]" />
            </div>
            <div className="dc-i">
              <div className="dc-t">{d.customer_name} ({d.client_name})</div>
              <div className="dc-s">{d.items?.length || 0} items</div>
            </div>
            <div className="dc-tm">{d.time_slot}</div>
            <span className={getBadgeClass(d.status || "")}>{(d.status || "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—"}</span>
          </Link>
        ))}
        </div>
      </div>

      {/* B2C Moves */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden mt-4">
        <div className="sh px-4 pt-4">
          <div className="sh-t">B2C Moves</div>
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
        <div className="dl px-4 pb-4 dc-wrap">
        {filteredMoves.slice(0, 5).map((m) => (
          <Link key={m.id} href={getMoveDetailPath(m)} className="dc">
            <div className="dc-ic flex items-center justify-center text-[var(--tx2)]" style={{ background: "var(--gdim)" }}>
              <Icon name={m.move_type === "office" ? "building" : "home"} className="w-[16px] h-[16px]" />
            </div>
            <div className="dc-i">
              <div className="dc-t">{m.client_name}</div>
              <div className="dc-s">{m.from_address} → {m.to_address}</div>
            </div>
            <div className="dc-tm">{formatMoveDate(m.scheduled_date)}</div>
            <span className={getBadgeClass(m.status || "")}>{getStatusLabel(m.status ?? null)}</span>
          </Link>
        ))}
        </div>
      </div>

      {/* g2 - Monthly Revenue + Activity */}
      <div className="g2 mt-4">
        <div className="panel overflow-hidden">
          <div className="sh">
            <div className="sh-t">Monthly Revenue</div>
            <Link href="/admin/revenue" className="sh-l">Details →</Link>
          </div>
          <div className="flex items-end gap-2 h-[130px] pt-1">
            {[
              { m: "Sep", v: 15 },
              { m: "Oct", v: 22 },
              { m: "Nov", v: 28 },
              { m: "Dec", v: 31 },
              { m: "Jan", v: 34 },
              { m: "Feb", v: 38.4 },
            ].map((d, i) => {
              const pct = Math.round((d.v / 40) * 100);
              const isNow = i === 5;
              return (
                <div key={d.m} className="flex-1 flex flex-col items-center gap-1 h-full min-w-0">
                  <span className={`text-[10px] font-semibold tabular-nums ${isNow ? "text-[var(--gold)]" : "text-[var(--tx2)]"}`}>
                    ${d.v}K
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

        <div className="panel overflow-hidden">
          <div className="sh">
            <div className="sh-t">Activity</div>
            {activityEvents.length > 0 && (
              <Link href="/admin/messages" className="sh-l">Messages →</Link>
            )}
          </div>
          {activityEvents.length > 0 ? (
            (() => {
              const deduped = activityEvents.filter((a, i) => {
                if (i === 0) return true;
                return activityEvents[i - 1].description !== a.description;
              });
              return (
                <div className="space-y-1">
                  {deduped.slice(0, 8).map((a) => (
                <Link key={a.id} href={getActivityHref(a)} className="act-item block rounded-lg px-2 py-2.5 -mx-2 hover:bg-[var(--bg)]/40 transition-colors border-b border-[var(--brd)]/30 last:border-0">
                  <div className="act-dot flex items-center justify-center text-[var(--tx2)]" style={{ background: ICON_BG[a.icon || ""] || "var(--gdim)" }}>
                    <Icon name={a.icon || "mail"} className="w-[14px] h-[14px]" />
                  </div>
                  <div className="act-body min-w-0">
                    <div className="act-t">{formatActivityDescription(a.description || a.event_type)}</div>
                    <div className="act-tm">{formatActivityTime(a.created_at)}</div>
                  </div>
                </Link>
              ))}
                </div>
              );
            })()
          ) : (
            <div className="space-y-1">
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
        </div>
      </div>
    </div>
  );
}
