"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { CaretLeft, CaretRight, Calendar, Clock } from "@phosphor-icons/react";
import type { CalendarEvent, ViewMode, YearHeatData } from "@/lib/calendar/types";
import { formatTime12, timeToMinutes, minutesToTime, STATUS_DOT_COLORS, JOB_COLORS } from "@/lib/calendar/types";
import { CALENDAR_PILL_TEXT } from "@/lib/calendar/calendar-job-styles";
import PartnerDeliveriesTab from "./PartnerDeliveriesTab";

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  accepted: "Accepted",
  approved: "Approved",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  "in-transit": "In Transit",
  in_progress: "In Progress",
  delivered: "Delivered",
  completed: "Completed",
  pending: "Pending",
  pending_approval: "Pending Acceptance",
  en_route_to_pickup: "En Route to Pickup",
  cancelled: "Cancelled",
  booked: "Booked",
  new: "New",
};
function fmtDeliveryStatus(s: string) {
  return DELIVERY_STATUS_LABELS[s.toLowerCase().replace(/-/g, "_")] || s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Interfaces ────────────────────────────────── */

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string;
  stage: string | null;
  created_at: string;
  scheduled_date: string | null;
  time_slot: string | null;
  delivery_address: string | null;
  pickup_address: string | null;
  items: unknown[] | string[] | null;
  category: string | null;
  crew_id: string | null;
  delivery_type?: string | null;
  vehicle_type?: string | null;
  booking_type?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  estimated_duration_hours?: number | null;
  calendar_status?: string | null;
}

interface Props {
  deliveries: Delivery[];
  upcomingDeliveries?: Delivery[];
  onSelectDate?: (date: string) => void;
  onDeliveryClick?: (d: Delivery) => void;
  onShare?: (d: Delivery) => void;
  onDetailClick?: (d: Delivery) => void;
  onEditClick?: (d: Delivery) => void;
  onRescheduled?: () => void;
  orgType?: string;
}

/* ── Helpers ────────────────────────────────────── */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  scheduled: { bg: "#2C3E2D10", text: "#2C3E2D", border: "#2C3E2D" },
  confirmed: { bg: "#2C3E2D10", text: "#2C3E2D", border: "#2C3E2D" },
  in_progress: { bg: "#B8962E10", text: "#B8962E", border: "#B8962E" },
  dispatched: { bg: "#B8962E10", text: "#B8962E", border: "#B8962E" },
  "in-transit": { bg: "#B8962E10", text: "#B8962E", border: "#B8962E" },
  in_transit: { bg: "#B8962E10", text: "#B8962E", border: "#B8962E" },
  delivered: { bg: "#22C55E10", text: "#22C55E", border: "#22C55E" },
  completed: { bg: "#22C55E10", text: "#22C55E", border: "#22C55E" },
  cancelled: { bg: "#D1434310", text: "#D14343", border: "#D14343" },
  pending: { bg: "#C9A96210", text: "#C9A962", border: "#C9A962" },
  pending_approval: { bg: "#F59E0B10", text: "#F59E0B", border: "#F59E0B" },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status.toLowerCase()] || STATUS_COLORS.pending;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const adjusted = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < adjusted; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function getWeekDays(anchor: Date): { date: Date; key: string }[] {
  const d = new Date(anchor);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    return { date: day, key };
  });
}

/* ── Main Component ───────────────────────────── */

const HOUR_HEIGHT = 60;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const DRAG_THRESHOLD = 6;

function yToTime(y: number): string {
  const rawMins = DAY_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
  const snapped = Math.round(rawMins / 15) * 15;
  return minutesToTime(Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - 15, snapped)));
}

export default function PartnerCalendarTab({ deliveries, upcomingDeliveries = [], onSelectDate, onDeliveryClick, onShare, onDetailClick, onEditClick, onRescheduled, orgType = "" }: Props) {
  const [view, setView] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [yearView, setYearView] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const todayKey = getToday();

  // Fetch calendar events (projects, phases) for the visible date range
  useEffect(() => {
    let startStr: string;
    let endStr: string;
    if (view === "year") {
      startStr = `${yearView}-01-01`;
      endStr = `${yearView}-12-31`;
    } else if (view === "month") {
      const start = new Date(monthYear.year, monthYear.month, 1);
      const end = new Date(monthYear.year, monthYear.month + 1, 0);
      startStr = start.toISOString().slice(0, 10);
      endStr = end.toISOString().slice(0, 10);
    } else if (view === "week") {
      const days = getWeekDays(weekAnchor);
      startStr = days[0].key;
      endStr = days[6].key;
    } else {
      startStr = selectedDate;
      endStr = selectedDate;
    }
    fetch(`/api/partner/calendar?start=${startStr}&end=${endStr}`)
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((d) => setCalendarEvents(d.events || []))
      .catch(() => setCalendarEvents([]));
  }, [view, monthYear.year, monthYear.month, weekAnchor, selectedDate, yearView]);

  const projectEventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of calendarEvents) {
      if ((e.type === "project" || e.type === "project_phase") && e.date) {
        if (!map[e.date]) map[e.date] = [];
        map[e.date].push(e);
      }
    }
    return map;
  }, [calendarEvents]);

  const deliveriesByDate = useMemo(() => {
    const map: Record<string, Delivery[]> = {};
    deliveries.forEach((d) => {
      if (!d.scheduled_date) return;
      const key = d.scheduled_date.slice(0, 10);
      const status = (d.status || "").toLowerCase();
      if (statusFilter && status !== statusFilter) return;
      if (typeFilter) {
        const bt = d.booking_type || d.delivery_type || "";
        if (typeFilter === "day_rate" && bt !== "day_rate") return;
        if (typeFilter === "per_delivery" && bt === "day_rate") return;
      }
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.scheduled_start || a.time_slot || "99:99").localeCompare(b.scheduled_start || b.time_slot || "99:99"));
    }
    return map;
  }, [deliveries, statusFilter, typeFilter]);

  const yearHeat = useMemo(() => {
    const heat: Record<string, number> = {};
    deliveries.forEach((d) => {
      if (!d.scheduled_date) return;
      const key = d.scheduled_date.slice(0, 10);
      if (!key.startsWith(String(yearView))) return;
      const status = (d.status || "").toLowerCase();
      if (statusFilter && status !== statusFilter) return;
      if (typeFilter) {
        const bt = d.booking_type || d.delivery_type || "";
        if (typeFilter === "day_rate" && bt !== "day_rate") return;
        if (typeFilter === "per_delivery" && bt === "day_rate") return;
      }
      heat[key] = (heat[key] || 0) + 1;
    });
    return heat;
  }, [deliveries, yearView, statusFilter, typeFilter]);

  const navigate = useCallback((dir: number) => {
    if (view === "month") {
      setMonthYear((prev) => {
        let m = prev.month + dir;
        let y = prev.year;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        return { year: y, month: m };
      });
    } else if (view === "week") {
      setWeekAnchor((prev) => { const n = new Date(prev); n.setDate(n.getDate() + dir * 7); return n; });
    } else if (view === "day") {
      setSelectedDate((prev) => { const d = new Date(prev + "T12:00:00"); d.setDate(d.getDate() + dir); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    } else if (view === "year") {
      setYearView((prev) => prev + dir);
    }
  }, [view]);

  const goToday = useCallback(() => {
    const d = new Date();
    setSelectedDate(todayKey);
    setMonthYear({ year: d.getFullYear(), month: d.getMonth() });
    setWeekAnchor(d);
    setYearView(d.getFullYear());
  }, [todayKey]);

  const headerLabel = useMemo(() => {
    if (view === "year") return String(yearView);
    if (view === "month") return new Date(monthYear.year, monthYear.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (view === "week") {
      const days = getWeekDays(weekAnchor);
      const fm = days[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const lm = days[6].date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${fm} – ${lm}`;
    }
    return new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [view, yearView, monthYear, weekAnchor, selectedDate]);

  const switchToDay = useCallback((date: string) => {
    setSelectedDate(date);
    const d = new Date(date + "T12:00:00");
    setMonthYear({ year: d.getFullYear(), month: d.getMonth() });
    setView("day");
  }, []);

  /* ── Delivery Card ─────────────────────────── */
  const DeliveryCard = ({ d, compact }: { d: Delivery; compact?: boolean }) => {
    const style = getStatusStyle(d.status || "pending");
    const isCompleted = ["delivered", "completed"].includes((d.status || "").toLowerCase());
    const isCancelled = (d.status || "").toLowerCase() === "cancelled";
    const isProgress = ["dispatched", "in-transit", "in_transit", "in_progress"].includes((d.status || "").toLowerCase());
    const timeStr = d.scheduled_start
      ? d.scheduled_end
        ? `${formatTime12(d.scheduled_start)}-${formatTime12(d.scheduled_end)}`
        : formatTime12(d.scheduled_start)
      : d.time_slot || null;

    const itemCount = Array.isArray(d.items) ? d.items.length : 0;
    const addr = d.delivery_address ? (d.delivery_address.length > 35 ? d.delivery_address.slice(0, 35) + "…" : d.delivery_address) : null;

    if (compact) {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeliveryClick?.(d); }}
          className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] transition-colors hover:shadow-sm ${isCompleted ? "opacity-60" : ""} ${isCancelled ? "opacity-40 line-through" : ""}`}
          style={{ borderLeft: `2.5px solid ${style.border}`, background: style.bg }}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isProgress ? "animate-pulse" : ""}`} style={{ backgroundColor: style.border }} />
          <span className="truncate text-[#1A1A1A] dark:text-[var(--tx)]">
            {timeStr && <span className="text-[#666] dark:text-[var(--tx3)] mr-1 font-medium">{timeStr}</span>}
            {d.customer_name || d.delivery_number}
          </span>
          {isCompleted && <span className="text-[#22C55E] ml-auto shrink-0 text-[10px] font-semibold">Done</span>}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onDeliveryClick?.(d)}
        className={`w-full text-left p-3 rounded-xl transition-all hover:shadow-md cursor-pointer ${isCompleted ? "opacity-60" : ""} ${isCancelled ? "opacity-40" : ""}`}
        style={{ borderLeft: `3px solid ${style.border}`, background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isProgress ? "animate-pulse" : ""}`} style={{ backgroundColor: style.border }} />
          {timeStr && <span className="text-[11px] text-[#666] font-medium">{timeStr}</span>}
        </div>
        <div className={`text-[13px] font-semibold text-[#1A1A1A] ${isCancelled ? "line-through" : ""}`}>
          {itemCount > 0 ? `${itemCount}pc ` : ""}{d.customer_name || d.delivery_number}
        </div>
        {addr && <div className="text-[11px] text-[#666] mt-0.5 truncate">→ {addr}</div>}
        <div className="mt-1.5">
          <span
            className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full capitalize"
            style={{ backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}30` }}
          >
            {fmtDeliveryStatus(d.status || "pending")}
          </span>
        </div>
      </button>
    );
  };

  /* ── HEADER ────────────────────────────────── */
  const Header = (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[22px] font-bold text-[#1A1A1A] dark:text-[var(--tx)] font-hero" suppressHydrationWarning>{headerLabel}</h3>
          <div className="flex items-center gap-0.5">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-[#F5F3F0] dark:hover:bg-[var(--card)] transition-colors">
              <CaretLeft size={14} weight="regular" color="#888" />
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-[#F5F3F0] dark:hover:bg-[var(--card)] transition-colors">
              <CaretRight size={14} weight="regular" color="#888" />
            </button>
            <button onClick={goToday} className="ml-2 px-3 py-1 rounded-lg text-[10px] font-semibold border border-[#E8E4DF] dark:border-[var(--brd)] text-[#666] dark:text-[var(--tx3)] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors">
              Today
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F5F3F0] dark:bg-[var(--bg)] border border-[#E8E4DF] dark:border-[var(--brd)] rounded-lg p-0.5">
            {(["day", "week", "month", "year"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize transition-colors ${
                  view === m
                    ? "bg-white dark:bg-[var(--card)] text-[#2C3E2D] dark:text-[var(--gold)] shadow-sm"
                    : "text-[#888] dark:text-[var(--tx3)] hover:text-[#1A1A1A] dark:hover:text-[var(--tx)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => onSelectDate?.(selectedDate || todayKey)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#2C3E2D" }}
          >
            <Calendar size={13} />
            Schedule a delivery
          </button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[10px] bg-[#F5F3F0] dark:bg-[var(--bg)] border border-[#E8E4DF] dark:border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[#666] dark:text-[var(--tx2)] focus:border-[#C9A962] outline-none"
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="dispatched">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-[10px] bg-[#F5F3F0] dark:bg-[var(--bg)] border border-[#E8E4DF] dark:border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[#666] dark:text-[var(--tx2)] focus:border-[#C9A962] outline-none"
        >
          <option value="">All Types</option>
          <option value="per_delivery">Per Delivery</option>
          <option value="day_rate">Day Rate</option>
        </select>
      </div>
    </div>
  );

  /* ── MONTH VIEW ────────────────────────────── */
  const MonthGrid = () => {
    const cells = getMonthCells(monthYear.year, monthYear.month);
    return (
      <div className="grid grid-cols-7 gap-px bg-[#E8E4DF] dark:bg-[var(--brd)] border border-[#E8E4DF] dark:border-[var(--brd)] rounded-xl overflow-hidden">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-[#F9F7F4] dark:bg-[var(--bg)] py-2 text-center text-[9px] font-bold tracking-wider uppercase text-[#999] dark:text-[var(--tx3)]/50">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="bg-white dark:bg-[var(--card)] min-h-[90px]" />;
          const dk = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayDels = deliveriesByDate[dk] || [];
          const dayProjects = projectEventsByDate[dk] || [];
          const isToday = dk === todayKey;

          return (
            <div
              key={dk}
              className={`bg-white dark:bg-[var(--card)] min-h-[90px] p-1.5 transition-colors hover:bg-[#FAF8F5] dark:hover:bg-[var(--bg)]/50 ${isToday ? "ring-2 ring-inset ring-[#C9A962]/50" : ""}`}
            >
              <button
                type="button"
                onClick={() => switchToDay(dk)}
                className={`text-[12px] font-medium mb-1 block hover:text-[#C9A962] transition-colors ${isToday ? "text-[#C9A962] font-bold" : "text-[#1A1A1A] dark:text-[var(--tx)]"}`}
              >
                {day}
              </button>
              <div className="space-y-0.5">
                {dayProjects.slice(0, 2).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => switchToDay(dk)}
                    className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: e.color || JOB_COLORS.project,
                      color: CALENDAR_PILL_TEXT,
                      borderLeft: "3px solid rgba(15,23,42,0.28)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    }}
                  >
                    {e.name}: {e.description}
                  </button>
                ))}
                {dayDels.slice(0, Math.max(0, 3 - dayProjects.length)).map((d) => (
                  <DeliveryCard key={d.id} d={d} compact />
                ))}
                {(dayDels.length + dayProjects.length) > 3 && (
                  <button type="button" onClick={() => switchToDay(dk)} className="text-[8px] text-[#C9A962] font-semibold pl-1 hover:underline">
                    +{dayDels.length + dayProjects.length - 3} more
                  </button>
                )}
                {dayDels.length === 0 && dayProjects.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDate?.(dk)}
                    className="text-[9px] text-[#CCC] dark:text-[var(--tx3)]/30 hover:text-[#2C3E2D] dark:hover:text-[var(--gold)] transition-colors"
                  >
                    + Schedule
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── DAY VIEW (with draggable) ──────────────────────────────── */
  const dayTimelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ delivery: Delivery; startX: number; startY: number; isDragging: boolean } | null>(null);
  const [draggingDelivery, setDraggingDelivery] = useState<Delivery | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const onDeliveryClickRef = useRef(onDeliveryClick);
  onDeliveryClickRef.current = onDeliveryClick;
  const onRescheduledRef = useRef(onRescheduled);
  onRescheduledRef.current = onRescheduled;
  const reschedulingRef = useRef(rescheduling);
  reschedulingRef.current = rescheduling;

  const doReschedule = useCallback(async (d: Delivery, newStart: string) => {
    const dur = d.estimated_duration_hours || 1.5;
    const durMins = Math.round(dur * 60);
    const startMins = timeToMinutes(newStart);
    const endMins = Math.min(startMins + durMins, DAY_END_HOUR * 60);
    const newEnd = minutesToTime(endMins);

    setRescheduling(true);
    try {
      const res = await fetch(`/api/partner/deliveries/${d.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_start: newStart, scheduled_end: newEnd }),
      });
      const data = await res.json();
      if (res.ok) {
        onRescheduledRef.current?.();
      } else {
        alert(data.error || "Failed to reschedule");
      }
    } catch {
      alert("Network error while rescheduling");
    } finally {
      setRescheduling(false);
    }
  }, []);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || reschedulingRef.current) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.isDragging) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        d.isDragging = true;
        setDraggingDelivery(d.delivery);
      }
      setDragPos({ x: e.clientX, y: e.clientY });
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      setDraggingDelivery(null);
      setDragPos(null);
      if (!d.isDragging) {
        onDeliveryClickRef.current?.(d.delivery);
        return;
      }
      if (reschedulingRef.current) return;
      const container = dayTimelineRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop || 0;
      const y = e.clientY - rect.top + scrollTop;
      if (y >= 0) {
        const newStart = yToTime(y);
        doReschedule(d.delivery, newStart);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [doReschedule]);

  const DayTimeline = () => {
    const dayDels = deliveriesByDate[selectedDate] || [];
    const dayProjects = projectEventsByDate[selectedDate] || [];
    const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
    const isToday = selectedDate === todayKey;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const showNow = isToday && nowMins >= DAY_START_HOUR * 60 && nowMins <= DAY_END_HOUR * 60;
    const nowTop = ((nowMins - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;

    return (
      <div className={draggingDelivery ? "select-none" : ""}>
        {dayDels.length === 0 && dayProjects.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[var(--text-base)] text-[#888] dark:text-[var(--tx3)] mb-4">No deliveries or projects scheduled</div>
            <button
              onClick={() => onSelectDate?.(selectedDate)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[12px] font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#2C3E2D" }}
            >
              Schedule a delivery
            </button>
          </div>
        ) : (
          <div ref={dayTimelineRef} className="relative overflow-y-auto max-h-[calc(100vh-320px)]" style={{ minHeight: (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT }}>
            {/* Project blocks (all-day, no time) */}
            {dayProjects.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {dayProjects.map((e) => (
                  <div
                    key={e.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{
                      backgroundColor: e.color || JOB_COLORS.project,
                      color: CALENDAR_PILL_TEXT,
                      borderLeft: "3px solid rgba(15,23,42,0.28)",
                    }}
                  >
                    {e.name}: {e.description}
                  </div>
                ))}
              </div>
            )}
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div key={h} className="absolute w-full flex items-start" style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}>
                <div className="w-16 shrink-0 text-right pr-3 text-[10px] text-[#999] dark:text-[var(--tx3)] font-medium -mt-1.5">
                  {formatTime12(`${String(h).padStart(2, "0")}:00`)}
                </div>
                <div className="flex-1 border-t border-[#EEE] dark:border-[var(--brd)]/30" />
              </div>
            ))}

            {/* Delivery blocks */}
            {dayDels.map((d) => {
              const startTime = d.scheduled_start || d.time_slot || "08:00";
              const hasStructuredTime = !!d.scheduled_start;
              const startMins = hasStructuredTime ? timeToMinutes(startTime) : 8 * 60;
              const dur = d.estimated_duration_hours || 1.5;
              const top = ((startMins - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
              const height = Math.max(dur * HOUR_HEIGHT, 60);
              const style = getStatusStyle(d.status || "pending");
              const isCompleted = ["delivered", "completed"].includes((d.status || "").toLowerCase());
              const isCancelled = (d.status || "").toLowerCase() === "cancelled";
              const canDrag = !rescheduling && !isCompleted && !isCancelled;
              const isBeingDragged = draggingDelivery?.id === d.id;

              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => {
                    if (!canDrag) return;
                    e.preventDefault();
                    e.stopPropagation();
                    dragRef.current = { delivery: d, startX: e.clientX, startY: e.clientY, isDragging: false };
                  }}
                  onClick={() => { if (!canDrag) onDeliveryClick?.(d); }}
                  className={`absolute left-16 right-2 rounded-xl overflow-hidden text-left hover:shadow-lg transition-all ${canDrag ? "cursor-grab" : "cursor-pointer"} ${isBeingDragged ? "opacity-30 pointer-events-none" : ""}`}
                  style={{ top, height, borderLeft: `4px solid ${style.border}`, background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
                >
                  <div className="p-3 h-full flex flex-col">
                    <div className="text-[12px] font-bold text-[#1A1A1A]">
                      {Array.isArray(d.items) && d.items.length > 0
                        ? `${d.items.length}pc ${typeof d.items[0] === "string" ? d.items[0] : (d.items[0] as { name?: string })?.name || ""}`
                        : d.customer_name || d.delivery_number}
                    </div>
                    {d.delivery_address && (
                      <div className="text-[11px] text-[#666] mt-0.5 truncate">→ {d.delivery_address}</div>
                    )}
                    <div className="flex items-center gap-2 mt-auto text-[10px] text-[#888]">
                      {d.vehicle_type && <span className="inline-flex items-center gap-0.5">{d.vehicle_type}</span>}
                      {d.estimated_duration_hours && <span className="inline-flex items-center gap-0.5"><Clock size={12} /> {d.estimated_duration_hours}h</span>}
                      <span className="font-semibold" style={{ color: style.text }}>
                        {fmtDeliveryStatus(d.status || "pending")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* NOW line */}
            {showNow && (
              <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center" style={{ top: nowTop }}>
                <div className="w-16 text-right pr-1"><span className="text-[7px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-1 py-0.5 rounded">NOW</span></div>
                <div className="flex-1 h-[2px] bg-red-400/60" />
              </div>
            )}
          </div>
        )}

        {/* Floating drag preview */}
        {draggingDelivery && dragPos && (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: dragPos.x + 14, top: dragPos.y - 16 }}
          >
            <div
              className="px-2.5 py-1.5 rounded-md shadow-2xl text-[11px] font-bold max-w-[180px] truncate border"
              style={{
                borderLeft: "4px solid #2C3E2D",
                background: "#2C3E2Dcc",
                color: "#fff",
                borderColor: "#2C3E2D",
              }}
            >
              {draggingDelivery.customer_name || draggingDelivery.delivery_number}
              {(draggingDelivery.scheduled_start || draggingDelivery.time_slot) && (
                <span className="ml-1 opacity-70 font-normal">
                  {formatTime12(draggingDelivery.scheduled_start || draggingDelivery.time_slot || "08:00")}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[9px] font-semibold text-green-400 pl-1">
              Drag to reschedule
            </div>
          </div>
        )}

        {/* Saving overlay */}
        {rescheduling && (
          <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
            <div className="bg-white dark:bg-[var(--card)] border border-[#E8E4DF] dark:border-[var(--brd)] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-[13px] font-semibold text-[#1A1A1A] dark:text-[var(--tx)]">
              <div className="w-4 h-4 border-2 border-[#2C3E2D] border-t-transparent rounded-full animate-spin" />
              Saving…
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── WEEK VIEW ─────────────────────────────── */
  const WeekGrid = () => {
    const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);
    const HOUR_HEIGHT = 35;
    const START_HOUR = 6;
    const END_HOUR = 20;
    const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

    return (
      <div>
        <div className="flex border-b border-[#E8E4DF] dark:border-[var(--brd)]">
          <div className="w-12 shrink-0" />
          {weekDays.map(({ date, key }, i) => {
            const isToday = key === todayKey;
            const delCount = (deliveriesByDate[key] || []).length;
            const projCount = (projectEventsByDate[key] || []).length;
            const count = delCount + projCount;
            return (
              <button key={key} type="button" onClick={() => switchToDay(key)} className={`flex-1 py-2 text-center border-l border-[#E8E4DF] dark:border-[var(--brd)] hover:bg-[#FAF8F5] dark:hover:bg-[var(--bg)]/50 transition-colors ${isToday ? "bg-[#C9A962]/5" : ""}`}>
                <div className={`text-[9px] font-bold uppercase ${isToday ? "text-[#C9A962]" : "text-[#999] dark:text-[var(--tx3)]/50"}`}>{DAY_NAMES[i]} {date.getDate()}</div>
                {count > 0 && <div className="text-[7px] text-[#2C3E2D] dark:text-[var(--gold)] font-semibold">{delCount > 0 && `${delCount} del${delCount > 1 ? "s" : ""}`}{delCount > 0 && projCount > 0 ? " · " : ""}{projCount > 0 && `${projCount} proj`}</div>}
              </button>
            );
          })}
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-340px)]">
          <div className="flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
            <div className="w-12 shrink-0 relative">
              {HOURS.map((h) => (
                <div key={h} className="absolute w-full text-right pr-1 text-[8px] text-[#999] dark:text-[var(--tx3)] font-medium" style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 4 }}>
                  {h <= 12 ? `${h}AM` : `${h - 12}PM`}
                </div>
              ))}
            </div>
            {weekDays.map(({ key }) => {
              const dayDels = deliveriesByDate[key] || [];
              const dayProjects = projectEventsByDate[key] || [];
              const isToday = key === todayKey;
              return (
                <div key={key} className={`flex-1 relative border-l border-[#E8E4DF] dark:border-[var(--brd)] ${isToday ? "bg-[#C9A962]/3" : ""}`} onClick={() => switchToDay(key)}>
                  {HOURS.map((h) => (
                    <div key={h} className="absolute w-full border-t border-[#F0EDE8] dark:border-[var(--brd)]/15" style={{ top: (h - START_HOUR) * HOUR_HEIGHT }} />
                  ))}
                  {dayProjects.slice(0, 2).map((e, idx) => (
                    <div
                      key={e.id}
                      className="absolute left-0.5 right-0.5 rounded-md text-[7px] font-semibold truncate px-1 flex items-center shadow-sm"
                      style={{
                        top: 2 + idx * 18,
                        height: 16,
                        backgroundColor: e.color || JOB_COLORS.project,
                        color: CALENDAR_PILL_TEXT,
                        borderLeft: "2px solid rgba(15,23,42,0.28)",
                      }}
                    >
                      {e.name}
                    </div>
                  ))}
                  {dayDels.map((d) => {
                    const startTime = d.scheduled_start || "08:00";
                    const startMins = timeToMinutes(startTime);
                    const dur = d.estimated_duration_hours || 1.5;
                    const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(dur * HOUR_HEIGHT, 22);
                    const style = getStatusStyle(d.status || "pending");
                    return (
                      <button key={d.id} type="button" onClick={(e) => { e.stopPropagation(); onDeliveryClick?.(d); }} className="absolute left-0.5 right-0.5 rounded-md overflow-hidden text-left hover:brightness-95 cursor-pointer shadow-sm" style={{ top, height: Math.max(height, 22), borderLeft: `4px solid ${style.border}`, background: `${style.border}25` }}>
                        <div className="p-1 flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${["dispatched", "in-transit", "in_transit"].includes((d.status || "").toLowerCase()) ? "animate-pulse" : ""}`} style={{ backgroundColor: style.border }} />
                          <span className="text-[8px] font-bold text-[#1A1A1A] dark:text-[var(--tx)] truncate">{d.customer_name || d.delivery_number}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {/* Summary bars */}
        <div className="flex border-t border-[#E8E4DF] dark:border-[var(--brd)]">
          <div className="w-12 shrink-0" />
          {weekDays.map(({ key }) => {
            const count = (deliveriesByDate[key] || []).length;
            const hrs = (deliveriesByDate[key] || []).reduce((sum, d) => sum + (d.estimated_duration_hours || 1.5), 0);
            return (
              <div key={key} className="flex-1 border-l border-[#E8E4DF] dark:border-[var(--brd)] px-1 py-1 text-center">
                <div className="text-[7px] text-[#888] dark:text-[var(--tx3)]">{count > 0 ? `${count} · ${Math.round(hrs * 10) / 10}h` : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── YEAR VIEW ─────────────────────────────── */
  const YearHeatMap = () => {
    const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
    const getColor = (count: number): string => {
      if (count === 0) return "transparent";
      if (count === 1) return "rgba(44,62,45,0.35)";
      if (count <= 3) return "rgba(44,62,45,0.6)";
      return "rgba(44,62,45,0.9)";
    };
    const emptyCellBg = "bg-[#F0EDE8] dark:bg-[var(--card)]";

    const totalDeliveries = Object.values(yearHeat).reduce((s, c) => s + c, 0);

    return (
      <div>
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-5">
          {MONTH_NAMES.map((name, mIdx) => {
            const firstDay = new Date(yearView, mIdx, 1).getDay();
            const adjusted = firstDay === 0 ? 6 : firstDay - 1;
            const daysInMonth = new Date(yearView, mIdx + 1, 0).getDate();
            const cells: (number | null)[] = [];
            for (let i = 0; i < adjusted; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            while (cells.length % 7 !== 0) cells.push(null);

            return (
              <div key={mIdx}>
                <button type="button" onClick={() => { setMonthYear({ year: yearView, month: mIdx }); setView("month"); }} className="text-[11px] font-bold text-[#1A1A1A] dark:text-[var(--tx)] mb-1.5 hover:text-[#2C3E2D] dark:hover:text-[var(--gold)] transition-colors">
                  {name}
                </button>
                <div className="grid grid-cols-7 gap-[2px] min-w-0">
                  {DAY_LABELS.map((d, i) => (
                    <div key={`h-${i}`} className="text-[6px] font-semibold text-[#888] dark:text-[var(--tx3)]/60 text-center">{d}</div>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) return <div key={`e-${i}`} className={`w-full min-h-[10px] aspect-square max-w-[20px] mx-auto rounded-[3px] ${emptyCellBg}`} />;
                    const dk = `${yearView}-${String(mIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const count = yearHeat[dk] || 0;
                    const isToday = dk === todayKey;
                    return (
                      <button
                        key={dk}
                        type="button"
                        onClick={() => switchToDay(dk)}
                        className={`w-full min-h-[10px] aspect-square max-w-[20px] mx-auto rounded-[3px] transition-colors hover:ring-2 hover:ring-[#2C3E2D]/50 dark:hover:ring-[var(--gold)]/50 ${count === 0 ? emptyCellBg : ""} ${isToday ? "ring-2 ring-[#C9A962] dark:ring-[var(--gold)]" : ""}`}
                        style={count > 0 ? { backgroundColor: getColor(count) } : undefined}
                        title={count > 0 ? `${dk}: ${count} deliver${count > 1 ? "ies" : "y"}` : dk}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 text-center">
          <div className="flex items-center gap-2 justify-center mb-2 flex-wrap">
            <span className="text-[9px] text-[#666] dark:text-[var(--tx3)]">Less</span>
            {[0, 1, 2, 4].map((n) => (
              <div key={n} className={`w-4 h-4 rounded-[3px] ${n === 0 ? emptyCellBg : ""}`} style={n > 0 ? { backgroundColor: getColor(n) } : undefined} />
            ))}
            <span className="text-[9px] text-[#666] dark:text-[var(--tx3)]">More</span>
          </div>
          <div className="text-[12px] text-[#666] dark:text-[var(--tx3)] font-medium">
            {yearView} Total: <span className="text-[#2C3E2D] dark:text-[var(--gold)] font-bold">{totalDeliveries} deliveries</span>
          </div>
        </div>
      </div>
    );
  };

  /* ── RENDER ────────────────────────────────── */
  return (
    <div className="space-y-8">
      <div>
        {Header}
        {view === "month" && <MonthGrid />}
        {view === "day" && <DayTimeline />}
        {view === "week" && <WeekGrid />}
        {view === "year" && <YearHeatMap />}
      </div>
      {onShare && onDetailClick && onEditClick && orgType && (
        <div className="border-t border-[var(--brd)]/30 pt-6">
          <h3 className="text-[17px] font-bold font-hero text-[var(--tx)] mb-4">Upcoming Deliveries</h3>
          <PartnerDeliveriesTab
            deliveries={upcomingDeliveries}
            label="upcoming"
            onShare={onShare}
            onDetailClick={onDetailClick}
            onEditClick={onEditClick}
            orgType={orgType}
          />
        </div>
      )}
    </div>
  );
}
