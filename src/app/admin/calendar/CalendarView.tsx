"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import { toTitleCase } from "@/lib/format-text";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ──────────────────────────────────────

interface CalEvent {
  id: string;
  type: "delivery" | "move";
  name: string;
  dateKey: string;
  time: string | null;
  category: string;
  status: string;
  color: string;
  href: string;
  crew: string | null;
  moveType?: string;
}

type ViewMode = "day" | "week" | "month";

// ─── Constants ──────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  retail: "#C9A962",
  designer: "#C9A962",
  hospitality: "#D48A29",
  gallery: "#4A7CE5",
  b2c: "#2D9F5A",
  residential: "#2D9F5A",
  office: "#4A7CE5",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#2D9F5A",
  completed: "#2D9F5A",
  delivered: "#2D9F5A",
  scheduled: "#3B82F6",
  in_progress: "#3B82F6",
  dispatched: "#D48A29",
  "in-transit": "#D48A29",
  in_transit: "#D48A29",
  pending: "#C9A962",
  pending_approval: "#F59E0B",
  quoted: "#C9A962",
  cancelled: "#D14343",
};

const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ─── Helpers ────────────────────────────────────

function toDateKey(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${day}`;
}

function parseDateKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/(\w+)\s+(\d+)/);
  if (m) {
    const months: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const mo = months[m[1]];
    if (mo) return `2026-${mo}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function normalizeEvents(deliveries: any[], moves: any[]): CalEvent[] {
  const events: CalEvent[] = [];

  for (const d of deliveries) {
    const dk = parseDateKey(d.scheduled_date);
    if (!dk) continue;
    const cat = (d.category || "retail").toLowerCase();
    events.push({
      id: d.id,
      type: "delivery",
      name: d.customer_name || d.delivery_number || "Delivery",
      dateKey: dk,
      time: d.time_slot || d.delivery_window || null,
      category: cat,
      status: (d.status || "pending").toLowerCase(),
      color: CATEGORY_COLORS[cat] || "#C9A962",
      href: getDeliveryDetailPath(d),
      crew: d.crew_name || null,
    });
  }

  for (const m of moves) {
    const dk = parseDateKey(m.scheduled_date);
    if (!dk) continue;
    const mt = (m.move_type || "residential").toLowerCase();
    events.push({
      id: m.id,
      type: "move",
      name: m.client_name || "Move",
      dateKey: dk,
      time: m.scheduled_time || m.time || null,
      category: mt,
      status: (m.status || "scheduled").toLowerCase(),
      color: CATEGORY_COLORS[mt] || "#2D9F5A",
      href: getMoveDetailPath(m),
      crew: m.crew_name || null,
      moveType: mt,
    });
  }

  return events;
}

function getWeekDays(anchorDate: Date, tz: string): { date: Date; key: string }[] {
  const d = new Date(anchorDate);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return { date: day, key: toDateKey(day, tz) };
  });
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

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtWeekRange(days: { date: Date }[]) {
  const first = days[0].date;
  const last = days[6].date;
  const fm = first.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lm = last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fm} – ${lm}`;
}

function fmtDayFull(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function fmtDayOfWeek(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ─── Main Component ────────────────────────────

interface CalendarViewProps {
  deliveries: any[];
  moves: any[];
  today?: string;
  appTimezone?: string;
}

export default function CalendarView({ deliveries, moves, today: todayStr, appTimezone = "America/Toronto" }: CalendarViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const todayKey = todayStr || toDateKey(new Date(), appTimezone);
  const todayDate = new Date(todayKey + "T12:00:00");

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekAnchor, setWeekAnchor] = useState(todayDate);
  const [monthYear, setMonthYear] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Drag state (desktop only)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"delivery" | "move" | null>(null);

  const allEvents = useMemo(() => normalizeEvents(deliveries, moves), [deliveries, moves]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of allEvents) {
      if (!map[ev.dateKey]) map[ev.dateKey] = [];
      map[ev.dateKey].push(ev);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.time || "zzz").localeCompare(b.time || "zzz"));
    }
    return map;
  }, [allEvents]);

  const selectedEvents = eventsByDate[selectedDate] || [];

  const weekDays = useMemo(() => getWeekDays(weekAnchor, appTimezone), [weekAnchor, appTimezone]);
  const monthCells = useMemo(() => getMonthCells(monthYear.year, monthYear.month), [monthYear]);

  const selDate = new Date(selectedDate + "T12:00:00");

  // ── Navigation ──
  const goToday = useCallback(() => {
    setSelectedDate(todayKey);
    setWeekAnchor(todayDate);
    setMonthYear({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  }, [todayKey, todayDate]);

  const navWeek = useCallback((dir: number) => {
    setWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  }, []);

  const navMonth = useCallback((dir: number) => {
    setMonthYear((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  }, []);

  // Mobile touch swipe
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) navWeek(diff > 0 ? 1 : -1);
    setTouchStartX(null);
  };

  // Desktop drag-and-drop
  const handleDrop = async (dateKey: string) => {
    if (!dragId || !dragType) return;
    if (dragType === "delivery") {
      await supabase.from("deliveries").update({ scheduled_date: dateKey }).eq("id", dragId);
    } else {
      await supabase.from("moves").update({ scheduled_date: dateKey }).eq("id", dragId);
    }
    setDragId(null);
    setDragType(null);
    router.refresh();
  };

  // ═══════════════════════════════════════════
  // MOBILE VIEW
  // ═══════════════════════════════════════════

  const mobileWeekDays = useMemo(() => getWeekDays(selDate, appTimezone), [selectedDate, appTimezone]);

  const MobileView = (
    <div className="md:hidden flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button onClick={() => navWeek(-1)} className="p-2 -ml-2 text-[var(--tx3)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="text-[16px] font-bold text-[var(--tx)] font-heading">{fmtMonthYear(selDate)}</h1>
        <button onClick={goToday} className="px-3 py-1 rounded-full text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
          Today
        </button>
      </div>

      {/* Week strip */}
      <div
        className="flex px-2 pb-3 gap-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {mobileWeekDays.map(({ date, key }) => {
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const hasEvents = !!eventsByDate[key]?.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDate(key)}
              className="flex-1 flex flex-col items-center py-2 rounded-xl transition-colors"
            >
              <span className={`text-[10px] font-medium mb-1 ${isSelected ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>
                {fmtDayOfWeek(date)}
              </span>
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-full text-[14px] font-bold transition-all ${
                  isSelected
                    ? "bg-[var(--gold)] text-[#0D0D0D]"
                    : isToday
                      ? "ring-2 ring-[var(--gold)] text-[var(--gold)]"
                      : "text-[var(--tx)]"
                }`}
              >
                {date.getDate()}
              </span>
              {hasEvents && !isSelected && (
                <span className="w-1 h-1 rounded-full bg-[var(--gold)] mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Day label */}
      <div className="px-4 pb-3 border-b border-[var(--brd)]">
        <span className="text-[13px] font-semibold text-[var(--tx2)]">
          {selectedDate === todayKey ? "Today, " : ""}{fmtDayFull(selDate)}
        </span>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {selectedEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[var(--tx3)] text-[13px] mb-4">No events scheduled</div>
            <Link
              href={`/admin/deliveries/new?date=${selectedDate}`}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
            >
              + Schedule Job
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {selectedEvents.map((ev) => (
              <Link
                key={ev.id}
                href={ev.href}
                className="flex gap-3 py-3 px-1 hover:bg-[var(--bg)]/50 transition-colors group"
              >
                {/* Time column */}
                <div className="w-14 shrink-0 flex flex-col items-end pt-0.5">
                  <span className="text-[11px] text-[var(--tx3)] leading-tight">
                    {ev.time || "Anytime"}
                  </span>
                </div>

                {/* Color bar */}
                <div className="w-[3px] rounded-full shrink-0 self-stretch" style={{ backgroundColor: ev.color }} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">
                    {ev.type === "delivery" ? "Delivery" : ev.moveType === "office" ? "Office Move" : "Move"}
                  </div>
                  <div className="text-[15px] font-bold text-[var(--tx)] leading-snug group-hover:text-[var(--gold)] transition-colors truncate">
                    {ev.name}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] flex-wrap">
                    <span style={{ color: ev.color }} className="font-medium capitalize">{ev.category}</span>
                    {ev.crew && (
                      <>
                        <span className="text-[var(--tx3)]">·</span>
                        <span className="text-[var(--tx3)]">{ev.crew}</span>
                      </>
                    )}
                    <span className="text-[var(--tx3)]">·</span>
                    <span className="text-[var(--tx3)] capitalize">{toTitleCase(ev.status)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // DESKTOP VIEW
  // ═══════════════════════════════════════════

  const DesktopHeader = (
    <div className="flex items-center justify-between mb-5 px-6 pt-5">
      <div className="flex items-center gap-4">
        <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">
          {viewMode === "month"
            ? fmtMonthYear(new Date(monthYear.year, monthYear.month, 1))
            : viewMode === "week"
              ? fmtWeekRange(weekDays)
              : fmtDayFull(selDate)}
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => viewMode === "month" ? navMonth(-1) : viewMode === "week" ? navWeek(-1) : setSelectedDate((() => { const d = new Date(selDate); d.setDate(d.getDate() - 1); return toDateKey(d, appTimezone); })())}
            className="p-1.5 rounded-lg hover:bg-[var(--card)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => viewMode === "month" ? navMonth(1) : viewMode === "week" ? navWeek(1) : setSelectedDate((() => { const d = new Date(selDate); d.setDate(d.getDate() + 1); return toDateKey(d, appTimezone); })())}
            className="p-1.5 rounded-lg hover:bg-[var(--card)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button onClick={goToday} className="ml-2 px-3 py-1 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
            Today
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* View switcher */}
        <div className="flex bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-0.5">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                viewMode === mode
                  ? "bg-[var(--card)] text-[var(--gold)] shadow-sm"
                  : "text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <Link
          href="/admin/deliveries/new"
          className="ml-3 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
        >
          + Schedule Job
        </Link>
      </div>
    </div>
  );

  // ── Month Grid (desktop) ──
  const MonthGrid = (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-7 gap-px bg-[var(--brd)] overflow-hidden">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="bg-[var(--bg)] py-2.5 text-center text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
            {d}
          </div>
        ))}
        {monthCells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="bg-[var(--card)] min-h-[100px]" />;
          const dk = `${monthYear.year}-${String(monthYear.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsByDate[dk] || [];
          const isToday = dk === todayKey;
          const isSelected = dk === selectedDate;

          return (
            <div
              key={dk}
              className={`bg-[var(--card)] min-h-[100px] p-1.5 cursor-pointer transition-colors hover:bg-[var(--bg)] ${isToday ? "ring-2 ring-inset ring-[var(--gold)]/50" : ""} ${isSelected ? "bg-[var(--gdim)]/30" : ""}`}
              onClick={() => { setSelectedDate(dk); setViewMode("day"); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(dk)}
            >
              <div className={`text-[12px] font-semibold mb-1 ${isToday ? "text-[var(--gold)] font-bold" : "text-[var(--tx)]"}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={() => { setDragId(ev.id); setDragType(ev.type); }}
                    onClick={(e) => { e.stopPropagation(); router.push(ev.href); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] truncate bg-[var(--bg)] hover:bg-[var(--gdim)] transition-colors cursor-pointer"
                    style={{ borderLeft: `2px solid ${ev.color}` }}
                  >
                    <span className="truncate text-[var(--tx)]">{ev.name}</span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[8px] text-[var(--tx3)] pl-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Week Grid (desktop) ──
  const WeekGrid = (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-7 gap-px bg-[var(--brd)] overflow-hidden">
        {weekDays.map(({ date, key }) => {
          const isToday = key === todayKey;
          return (
            <div key={key} className={`bg-[var(--bg)] py-2 text-center text-[9px] font-bold tracking-[0.14em] uppercase ${isToday ? "text-[var(--gold)]" : "text-[var(--tx3)]/50"}`}>
              {fmtDayOfWeek(date)} {date.getDate()}
              {isToday && <span className="ml-1 text-[8px] bg-[var(--gold)]/20 text-[var(--gold)] px-1 py-px rounded">Today</span>}
            </div>
          );
        })}
        {weekDays.map(({ date, key }) => {
          const dayEvents = eventsByDate[key] || [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;

          return (
            <div
              key={`c-${key}`}
              className={`bg-[var(--card)] min-h-[340px] p-2 cursor-pointer transition-colors hover:bg-[var(--bg)] ${isToday ? "ring-2 ring-inset ring-[var(--gold)]/40" : ""} ${isSelected ? "bg-[var(--gdim)]/20" : ""}`}
              onClick={() => { setSelectedDate(key); setViewMode("day"); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(key)}
            >
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  draggable
                  onDragStart={() => { setDragId(ev.id); setDragType(ev.type); }}
                  onClick={(e) => { e.stopPropagation(); router.push(ev.href); }}
                  className="mb-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
                  style={{ borderLeft: `3px solid ${ev.color}`, background: `${ev.color}11` }}
                >
                  <div className="text-[9px] font-bold truncate" style={{ color: ev.color }}>{ev.name}</div>
                  <div className="text-[8px] text-[var(--tx3)] mt-0.5">{ev.time || "Anytime"}</div>
                </div>
              ))}
              {dayEvents.length === 0 && (
                <div className="text-[9px] text-[var(--tx3)] opacity-40 text-center pt-8">+ Schedule</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Day Detail View (desktop) ──
  const DayDetail = (
    <div className="px-6 pb-6 max-w-[800px]">
      {selectedEvents.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-[var(--tx3)] text-[13px] mb-4">No events on this day</div>
          <Link
            href={`/admin/deliveries/new?date=${selectedDate}`}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
          >
            + Schedule Job
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[var(--brd)]">
          {selectedEvents.map((ev) => (
            <Link
              key={ev.id}
              href={ev.href}
              className="flex gap-4 px-5 py-4 hover:bg-[var(--bg)]/50 transition-colors group"
            >
              <div className="w-16 shrink-0 pt-0.5 text-right">
                <div className="text-[12px] font-semibold text-[var(--tx)]">{ev.time || "Anytime"}</div>
              </div>
              <div className="w-[3px] rounded-full shrink-0 self-stretch" style={{ backgroundColor: ev.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">
                  {ev.type === "delivery" ? "Delivery" : ev.moveType === "office" ? "Office Move" : "Move"}
                </div>
                <div className="text-[15px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors truncate">{ev.name}</div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <span style={{ color: ev.color }} className="font-medium capitalize">{ev.category}</span>
                  {ev.crew && (
                    <>
                      <span className="text-[var(--tx3)]">·</span>
                      <span className="text-[var(--tx3)]">{ev.crew}</span>
                    </>
                  )}
                  <span className="text-[var(--tx3)]">·</span>
                  <span className="capitalize" style={{ color: STATUS_COLORS[ev.status] || "var(--tx3)" }}>{toTitleCase(ev.status)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  // ── Legend ──
  const Legend = (
    <div className="hidden md:flex gap-4 px-6 pb-5 flex-wrap">
      {[
        { label: "Retail / Designer", color: "#C9A962" },
        { label: "Hospitality", color: "#D48A29" },
        { label: "Gallery", color: "#4A7CE5" },
        { label: "Residential Move", color: "#2D9F5A" },
        { label: "Office Move", color: "#4A7CE5" },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
          <div className="w-2.5 h-[3px] rounded" style={{ background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {MobileView}
      <div className="hidden md:block">
        {DesktopHeader}
        {viewMode === "month" && MonthGrid}
        {viewMode === "week" && WeekGrid}
        {viewMode === "day" && DayDetail}
        {Legend}
      </div>
    </>
  );
}
