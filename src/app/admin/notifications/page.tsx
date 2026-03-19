"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/AppIcons";

interface InAppNotification {
  id: string;
  title: string;
  body: string | null;
  icon: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  source_type: string | null;
  source_id: string | null;
  event_slug: string | null;
  created_at: string;
}

const SOURCE_FILTERS = [
  { key: "", label: "All" },
  { key: "quote", label: "Quotes" },
  { key: "move", label: "Moves" },
  { key: "delivery", label: "Deliveries" },
  { key: "payment", label: "Payments" },
  { key: "claim", label: "Claims" },
  { key: "system", label: "System" },
];

const SOURCE_COLORS: Record<string, { color: string; bg: string }> = {
  delivery: { color: "#C9A962", bg: "rgba(201,169,98,0.12)" },
  quote: { color: "#6B8CFF", bg: "rgba(107,140,255,0.12)" },
  move: { color: "#2D9F5A", bg: "rgba(45,159,90,0.12)" },
  payment: { color: "#2D9F5A", bg: "rgba(45,159,90,0.12)" },
  claim: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  system: { color: "var(--tx3)", bg: "var(--gdim)" },
};

function formatRelativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 172800) return "Yesterday";
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    if (sourceFilter) params.set("source_type", sourceFilter);
    if (search) params.set("q", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    try {
      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [offset, sourceFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [sourceFilter, search, dateFrom, dateTo]);

  async function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const unreadOnPage = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="p-4 sm:p-6 pt-[72px] max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Admin</p>
          <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Notifications</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-2">
            {total} total{unreadOnPage > 0 ? ` · ${unreadOnPage} unread on this page` : ""}
          </p>
        </div>
        {unreadOnPage > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] font-semibold text-[var(--gold)] hover:underline px-3 py-1.5 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)] transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-[var(--tx3)] stroke-current stroke-[1.75]" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[12px] text-[var(--tx)] placeholder-[var(--tx3)] focus:border-[var(--brd)] focus:outline-none transition-colors"
          />
        </div>

        {/* Source type filter */}
        <div className="flex gap-1 flex-wrap">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSourceFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                sourceFilter === f.key
                  ? "border-[var(--gold)] bg-[var(--gdim)] text-[var(--gold)]"
                  : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)]/50 hover:text-[var(--tx2)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[11px] text-[var(--tx)] focus:border-[var(--brd)] focus:outline-none transition-colors"
            title="From date"
          />
          <span className="text-[10px] text-[var(--tx3)]">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[11px] text-[var(--tx)] focus:border-[var(--brd)] focus:outline-none transition-colors"
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-[10px] text-[var(--tx3)] hover:text-[var(--tx)] px-1"
              title="Clear dates"
            >
              <Icon name="x" className="w-3 h-3 stroke-current stroke-[2]" />
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="border border-[var(--brd)] rounded-xl bg-[var(--card)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[12px] text-[var(--tx3)]">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-[13px] text-[var(--tx3)]">No notifications found</div>
            {(search || sourceFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(""); setSourceFilter(""); setDateFrom(""); setDateTo(""); }}
                className="mt-2 text-[11px] text-[var(--gold)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          notifications.map((notif, i) => {
            const tag = notif.source_type ? SOURCE_COLORS[notif.source_type] : null;
            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  markAsRead(notif.id);
                  if (notif.link) router.push(notif.link);
                }}
                className={`flex items-start gap-4 px-5 py-4 w-full text-left transition-colors hover:bg-[var(--gdim)] ${
                  i > 0 ? "border-t border-[var(--brd)]" : ""
                } ${!notif.is_read ? "bg-[var(--gdim)]/50" : ""}`}
              >
                {/* Unread indicator */}
                <div className="flex-shrink-0 mt-1.5 w-3 flex justify-center">
                  {!notif.is_read && (
                    <span className="block w-2 h-2 rounded-full bg-[var(--gold)]" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`text-[13px] leading-snug ${!notif.is_read ? "font-bold text-[var(--tx)]" : "text-[var(--tx2)]"}`}>
                      {notif.title}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {notif.source_type && tag && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ color: tag.color, backgroundColor: tag.bg }}
                        >
                          {notif.source_type}
                        </span>
                      )}
                    </div>
                  </div>
                  {notif.body && (
                    <div className="text-[12px] text-[var(--tx3)] mt-1 line-clamp-2">
                      {notif.body}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-[var(--tx3)]/60" title={formatFullDate(notif.created_at)}>
                      {formatRelativeTime(notif.created_at)}
                    </span>
                    {notif.link && (
                      <span className="text-[10px] text-[var(--gold)] font-medium">
                        View details
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-[11px] text-[var(--tx3)]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] disabled:opacity-30 hover:border-[var(--gold)] transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] disabled:opacity-30 hover:border-[var(--gold)] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
