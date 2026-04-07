"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { formatDateYmd } from "@/lib/client-timezone";
import type { PmTabId } from "@/components/partner/pm/PartnerPmPortalViews";

/** Reference screenshot tokens (PM calendar toolbar) */
const ACCENT = "#2D3A26";
const FOREST_CTA = ACCENT;
const HAIRLINE_BG = "bg-[#E8E6E1]";
const TOOLBAR_BG = "bg-[#F9F7F2]";
const TRACK_GREY = "bg-[#E8E6E1]";
const PAD_BG = "bg-[#EDE9E3]";
const CELL_BG = "bg-white";

type CalendarMove = {
  id: string;
  move_code: string | null;
  scheduled_time: string | null;
  unit_number: string | null;
  tenant_name: string | null;
  building_name: string | null;
  status: string | null;
  move_type_label: string | null;
  tracking_url: string | null;
};

type CalendarPayload = {
  year: number;
  month: number;
  movesByDate: Record<string, CalendarMove[]>;
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending review",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  paid: "Paid",
  delivered: "Delivered",
  draft: "Draft",
  cancelled: "Cancelled",
};

const TERMINAL = new Set(["completed", "paid", "delivered", "cancelled"]);

function labelStatus(key: string) {
  const k = (key || "").toLowerCase();
  return STATUS_LABELS[k] ?? key.replace(/_/g, " ");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

type PreviewMove = {
  id: string;
  move_code: string | null;
  scheduled_date: string | null;
  scheduled_time?: string | null;
  unit_number: string | null;
  tenant_name: string | null;
  status: string | null;
  building_name: string | null;
  move_type_label: string | null;
  tracking_url?: string | null;
};

function groupPreviewMovesForMonth(
  rows: PreviewMove[] | undefined,
  year: number,
  month: number,
): Record<string, CalendarMove[]> {
  const start = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return groupPreviewMovesForRange(rows, start, end);
}

function groupPreviewMovesForRange(
  rows: PreviewMove[] | undefined,
  start: string,
  end: string,
): Record<string, CalendarMove[]> {
  const by: Record<string, CalendarMove[]> = {};
  for (const m of rows ?? []) {
    const d = String(m.scheduled_date || "").slice(0, 10);
    if (!d || d < start || d > end) continue;
    if (!by[d]) by[d] = [];
    by[d].push({
      id: m.id,
      move_code: m.move_code,
      scheduled_time: m.scheduled_time ?? null,
      unit_number: m.unit_number,
      tenant_name: m.tenant_name,
      building_name: m.building_name,
      status: m.status,
      move_type_label: m.move_type_label,
      tracking_url: m.tracking_url ?? null,
    });
  }
  return by;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysYmd(ymd: string, delta: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + delta);
  return formatYmd(d);
}

function mondayOfWeekYmd(ymd: string): string {
  const d = parseYmd(ymd);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return formatYmd(d);
}

function sundayOfWeekYmd(ymd: string): string {
  return addDaysYmd(mondayOfWeekYmd(ymd), 6);
}

type CalendarViewMode = "day" | "week" | "month" | "year";

/** Week time grid — reference: 6 AM through 6 PM */
const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 18;
const WEEK_HOUR_COUNT = WEEK_END_HOUR - WEEK_START_HOUR + 1;

function hourLabel12(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

/** First clock hour from strings like "8 AM – 10 AM" */
function parseWindowStartHour(raw: string | null | undefined): number {
  if (!raw?.trim()) return 9;
  const first = raw.split(/[–—\-]/)[0]?.trim() ?? raw.trim();
  const up = first.toUpperCase().replace(/\s+/g, " ");
  const m12 = up.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const ap = m12[3];
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return Math.min(WEEK_END_HOUR, Math.max(WEEK_START_HOUR, h));
  }
  const m24 = first.match(/^(\d{1,2}):/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    return Math.min(WEEK_END_HOUR, Math.max(WEEK_START_HOUR, h));
  }
  return 9;
}

const WEEKDAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const MINI_WEEK = ["M", "T", "W", "T", "F", "S", "S"] as const;

type GridCell = {
  kind: "in" | "out";
  dateStr: string;
  dayNum: number;
};

function buildMondayFirstGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const cells: GridCell[] = [];

  for (let i = 0; i < lead; i++) {
    const dayNum = daysInPrev - lead + i + 1;
    cells.push({
      kind: "out",
      dateStr: `${prevYear}-${pad2(prevMonth)}-${pad2(dayNum)}`,
      dayNum,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      kind: "in",
      dateStr: `${year}-${pad2(month)}-${pad2(d)}`,
      dayNum: d,
    });
  }
  let nextM = month === 12 ? 1 : month + 1;
  let nextY = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      kind: "out",
      dateStr: `${nextY}-${pad2(nextM)}-${pad2(nextDay)}`,
      dayNum: nextDay,
    });
    nextDay += 1;
  }
  return cells;
}

/** PM calendar — layout aligned with partner calendar reference (month grid, filters, upcoming list). */
export function PartnerPmCalendarTab({
  setTab,
  previewUpcomingMoves,
  onPickDateForSchedule,
}: {
  setTab: (t: PmTabId) => void;
  previewUpcomingMoves?: PreviewMove[];
  /** Empty month cell → open Schedule move with this YYYY-MM-DD. */
  onPickDateForSchedule?: (ymd: string) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const todayYmd = useMemo(
    () => `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    [now],
  );
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [focusDate, setFocusDate] = useState(todayYmd);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(!previewUpcomingMoves);
  const [err, setErr] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const t = new Date();
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      let url: string;
      if (viewMode === "month") {
        url = `/api/partner/pm/calendar?year=${year}&month=${month}`;
      } else if (viewMode === "day") {
        url = `/api/partner/pm/calendar?from=${focusDate}&to=${focusDate}`;
      } else if (viewMode === "week") {
        const from = mondayOfWeekYmd(focusDate);
        const to = sundayOfWeekYmd(focusDate);
        url = `/api/partner/pm/calendar?from=${from}&to=${to}`;
      } else {
        url = `/api/partner/pm/calendar?from=${year}-01-01&to=${year}-12-31`;
      }
      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load calendar");
      setData(d as CalendarPayload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, focusDate, viewMode]);

  useEffect(() => {
    if (previewUpcomingMoves) {
      let movesByDate: Record<string, CalendarMove[]>;
      if (viewMode === "month") {
        movesByDate = groupPreviewMovesForMonth(previewUpcomingMoves, year, month);
      } else if (viewMode === "day") {
        movesByDate = groupPreviewMovesForRange(previewUpcomingMoves, focusDate, focusDate);
      } else if (viewMode === "week") {
        const from = mondayOfWeekYmd(focusDate);
        const to = sundayOfWeekYmd(focusDate);
        movesByDate = groupPreviewMovesForRange(previewUpcomingMoves, from, to);
      } else {
        movesByDate = groupPreviewMovesForRange(previewUpcomingMoves, `${year}-01-01`, `${year}-12-31`);
      }
      setData({ year, month, movesByDate });
      setErr(null);
      setLoading(false);
      return;
    }
    load();
  }, [load, previewUpcomingMoves, year, month, focusDate, viewMode]);

  const movesByDate = data?.movesByDate ?? {};
  const gridCells = useMemo(() => buildMondayFirstGrid(year, month), [year, month]);

  const allMovesFlat = useMemo(() => {
    const list: (CalendarMove & { dateStr: string })[] = [];
    for (const [d, arr] of Object.entries(movesByDate)) {
      for (const m of arr) list.push({ ...m, dateStr: d });
    }
    return list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [movesByDate]);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of allMovesFlat) {
      if (m.status) s.add(m.status.toLowerCase());
    }
    return ["all", ...Array.from(s).sort()];
  }, [allMovesFlat]);

  const typeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of allMovesFlat) {
      if (m.move_type_label?.trim()) s.add(m.move_type_label.trim());
    }
    return ["all", ...Array.from(s).sort()];
  }, [allMovesFlat]);

  const filteredByDate = useMemo(() => {
    const out: Record<string, CalendarMove[]> = {};
    for (const [d, arr] of Object.entries(movesByDate)) {
      const f = arr.filter((m) => {
        if (statusFilter !== "all") {
          if ((m.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
        }
        if (typeFilter !== "all") {
          if ((m.move_type_label || "").trim() !== typeFilter) return false;
        }
        return true;
      });
      if (f.length) out[d] = f;
    }
    return out;
  }, [movesByDate, statusFilter, typeFilter]);

  const upcomingList = useMemo(() => {
    const rows: (CalendarMove & { dateStr: string })[] = [];
    for (const [d, arr] of Object.entries(filteredByDate)) {
      if (d < todayYmd.slice(0, 10)) continue;
      for (const m of arr) {
        const st = (m.status || "").toLowerCase();
        if (TERMINAL.has(st)) continue;
        rows.push({ ...m, dateStr: d });
      }
    }
    return rows.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredByDate, todayYmd]);

  const heroTitle = useMemo(() => {
    if (viewMode === "day") {
      return formatDateYmd(focusDate, { month: "short", day: "numeric" });
    }
    if (viewMode === "week") {
      const from = mondayOfWeekYmd(focusDate);
      const to = sundayOfWeekYmd(focusDate);
      if (from.slice(0, 7) === to.slice(0, 7)) {
        const a = formatDateYmd(from, { month: "short", day: "numeric" });
        return `${a} – ${parseYmd(to).getDate()}`;
      }
      return `${formatDateYmd(from, { month: "short", day: "numeric", year: "numeric" })} – ${formatDateYmd(to, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (viewMode === "year") {
      return String(year);
    }
    return formatDateYmd(`${year}-${pad2(month)}-01`, { month: "short", day: "numeric" });
  }, [viewMode, focusDate, year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function prevPeriod() {
    if (viewMode === "day") {
      const n = addDaysYmd(focusDate, -1);
      setFocusDate(n);
      setYear(Number(n.slice(0, 4)));
      setMonth(Number(n.slice(5, 7)));
      return;
    }
    if (viewMode === "week") {
      const n = addDaysYmd(focusDate, -7);
      setFocusDate(n);
      setYear(Number(n.slice(0, 4)));
      setMonth(Number(n.slice(5, 7)));
      return;
    }
    if (viewMode === "month") {
      shiftMonth(-1);
      return;
    }
    setYear((y) => y - 1);
  }

  function nextPeriod() {
    if (viewMode === "day") {
      const n = addDaysYmd(focusDate, 1);
      setFocusDate(n);
      setYear(Number(n.slice(0, 4)));
      setMonth(Number(n.slice(5, 7)));
      return;
    }
    if (viewMode === "week") {
      const n = addDaysYmd(focusDate, 7);
      setFocusDate(n);
      setYear(Number(n.slice(0, 4)));
      setMonth(Number(n.slice(5, 7)));
      return;
    }
    if (viewMode === "month") {
      shiftMonth(1);
      return;
    }
    setYear((y) => y + 1);
  }

  function goToday() {
    const t = new Date();
    const ymd = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
    setFocusDate(ymd);
    setSelectedDate(ymd);
  }

  const viewTabs: { id: CalendarViewMode; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "year", label: "Year" },
  ];

  const weekDayCells = useMemo(() => {
    const mon = mondayOfWeekYmd(focusDate);
    return Array.from({ length: 7 }, (_, i) => ({ ymd: addDaysYmd(mon, i) }));
  }, [focusDate]);

  const selectClass =
    "appearance-none rounded-none border-0 outline-none ring-0 focus:ring-0 bg-white pl-3 pr-9 py-1.5 text-[12px] font-medium text-[#2D3A26] cursor-pointer min-w-[10.5rem] hover:bg-[#FFFCF9] transition-colors shadow-[0_1px_4px_rgba(45,58,38,0.08)]";

  return (
    <div className="text-[#1a1f1b] bg-[#F9F7F2]">
      <div
        className={`mb-6 rounded-none ${TOOLBAR_BG} px-4 py-4 shadow-[0_8px_32px_rgba(45,58,38,0.08)]`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
            <h1
              className="font-hero text-[28px] sm:text-[34px] md:text-[38px] font-normal leading-none tracking-[-0.02em] max-w-[min(100%,36rem)]"
              style={{ color: ACCENT }}
            >
              {heroTitle}
            </h1>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={prevPeriod}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none border-0 bg-white text-[#2D3A26] shadow-[0_1px_3px_rgba(45,58,38,0.1)] hover:bg-white"
                aria-label="Previous period"
              >
                <CaretLeft size={14} weight="regular" />
              </button>
              <button
                type="button"
                onClick={nextPeriod}
                className="inline-flex h-7 w-7 items-center justify-center rounded-none border-0 bg-white text-[#2D3A26] shadow-[0_1px_3px_rgba(45,58,38,0.1)] hover:bg-white"
                aria-label="Next period"
              >
                <CaretRight size={14} weight="regular" />
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="shrink-0 rounded-none border-0 bg-white px-3 py-1.5 text-[12px] font-medium text-[#2D3A26] shadow-[0_1px_3px_rgba(45,58,38,0.1)] hover:bg-white"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:shrink-0 md:justify-end">
            <div className={`inline-flex rounded-none ${TRACK_GREY} p-0.5 gap-0`} role="tablist" aria-label="Calendar view">
              {viewTabs.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={v.id === viewMode}
                  onClick={() => {
                    setViewMode(v.id);
                    if (v.id === "month") {
                      setYear(Number(focusDate.slice(0, 4)));
                      setMonth(Number(focusDate.slice(5, 7)));
                    }
                    if (v.id === "year") {
                      setYear(Number(focusDate.slice(0, 4)));
                    }
                    if (v.id === "day" || v.id === "week") {
                      const base = selectedDate || focusDate || todayYmd;
                      setFocusDate(base);
                      setYear(Number(base.slice(0, 4)));
                      setMonth(Number(base.slice(5, 7)));
                    }
                  }}
                  className={`rounded-none px-2.5 py-1.5 text-[10px] font-bold tracking-[0.16em] uppercase transition-all min-w-13 sm:min-w-15 sm:px-3 ${
                    v.id === viewMode
                      ? "bg-white text-[#2D3A26] shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                      : "text-[#6B6960] hover:text-[#2D3A26] cursor-pointer"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTab("schedule")}
              className="inline-flex items-center justify-center rounded-none border-0 px-3.5 py-2 text-[10px] font-bold tracking-[0.14em] uppercase text-white shadow-[0_2px_8px_rgba(45,58,38,0.25)] hover:brightness-[1.04] transition-[filter]"
              style={{ backgroundColor: FOREST_CTA }}
            >
              Schedule a move
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              {statusOptions.map((k) => (
                <option key={k} value={k}>
                  {k === "all" ? "All Statuses" : labelStatus(k)}
                </option>
              ))}
            </select>
            <CaretDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6960]"
              size={12}
              weight="bold"
              aria-hidden
            />
          </label>
          <label className="relative inline-flex items-center">
            <span className="sr-only">Filter by move type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={selectClass}
            >
              {typeOptions.map((k) => (
                <option key={k} value={k}>
                  {k === "all" ? "All Types" : k}
                </option>
              ))}
            </select>
            <CaretDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6960]"
              size={12}
              weight="bold"
              aria-hidden
            />
          </label>
        </div>
      </div>

      {loading && <p className="text-[13px] text-[#5A6B5E]">Loading…</p>}
      {err && <p className="text-[13px] text-red-800">{err}</p>}

      {!loading && !err && (
        <>
          {viewMode === "month" && (
            <div className="rounded-none bg-[#F9F7F2] overflow-hidden shadow-[0_4px_24px_rgba(45,58,38,0.07)]">
              <div className={`grid grid-cols-7 gap-px ${HAIRLINE_BG}`}>
                {WEEKDAY_HEADERS.map((w) => (
                  <div
                    key={w}
                    className="py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6B5E] bg-[#F5F2EC]"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className={`grid grid-cols-7 gap-px ${HAIRLINE_BG}`}>
                {gridCells.map((c, i) => {
                  const moves = filteredByDate[c.dateStr] ?? [];
                  const n = moves.length;
                  const isOut = c.kind === "out";
                  const isSelected = selectedDate === c.dateStr;
                  const isToday = c.dateStr === todayYmd;
                  return (
                    <div
                      key={`${c.dateStr}-${i}`}
                      role="presentation"
                      className={`relative min-h-[92px] sm:min-h-[104px] ${
                        isOut
                          ? `${PAD_BG} text-[#8A877E]`
                          : isSelected
                            ? "z-[1] bg-[#C8D4C8] text-[#1a1f1b]"
                            : isToday
                              ? "bg-[#EFEEEC]"
                              : `${CELL_BG}`
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={isOut ? -1 : 0}
                        onClick={() => {
                          if (isOut) return;
                          if (n === 0 && onPickDateForSchedule) {
                            onPickDateForSchedule(c.dateStr);
                            return;
                          }
                          setSelectedDate(c.dateStr);
                          setFocusDate(c.dateStr);
                        }}
                        onKeyDown={(e) => {
                          if (isOut) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (n === 0 && onPickDateForSchedule) {
                              onPickDateForSchedule(c.dateStr);
                              return;
                            }
                            setSelectedDate(c.dateStr);
                            setFocusDate(c.dateStr);
                          }
                        }}
                        className={`absolute inset-0 ${isOut ? "cursor-default" : "cursor-pointer"} pb-2 pl-2 pt-2 sm:pl-2.5 sm:pt-2.5 pr-1 text-left`}
                      >
                        <span
                          className={`pointer-events-none block text-[13px] sm:text-[14px] font-semibold ${isOut ? "text-[#8A877E]" : "text-[#1a1f1b]"}`}
                        >
                          {c.dayNum}
                        </span>
                        {n > 0 && !isOut && (
                          <span className="pointer-events-none mt-1 block text-[10px] font-semibold text-[#2D3A26]/80">
                            {n} move{n > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "day" && (
            <div className="rounded-none bg-[#F9F7F2] overflow-hidden shadow-[0_4px_24px_rgba(45,58,38,0.07)]">
              {(filteredByDate[focusDate] ?? []).length === 0 ? (
                <div className="min-h-[280px] sm:min-h-[320px] flex flex-col items-center justify-center px-6 py-16 bg-[#F9F7F2]">
                  <p className="text-[15px] sm:text-[16px] text-[#5A6B5E] text-center font-medium max-w-md leading-snug">
                    No moves or projects scheduled
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("schedule")}
                    className="mt-8 inline-flex items-center justify-center border-0 px-8 py-3 text-[11px] font-bold tracking-[0.14em] uppercase text-white shadow-[0_2px_8px_rgba(45,58,38,0.2)] hover:brightness-[1.05] transition-[filter]"
                    style={{ backgroundColor: FOREST_CTA }}
                  >
                    Schedule a move
                  </button>
                </div>
              ) : (
                <div className="bg-white shadow-[0_1px_0_rgba(45,58,38,0.06)]">
                  <div className="bg-[#F5F2EC] px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6B5E]">
                      Day schedule
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 space-y-2">
                    {(filteredByDate[focusDate] ?? []).map((m) => (
                      <div
                        key={m.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-0 bg-[#F9F7F2] px-3 py-2.5 rounded-none shadow-[0_1px_4px_rgba(45,58,38,0.07)]"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#1a1f1b] truncate">
                            {m.tenant_name || "—"} · Unit {m.unit_number || "—"}
                          </p>
                          <p className="text-[12px] text-[#5A6B5E] truncate">
                            {m.building_name || "—"}
                            {m.move_type_label ? ` · ${m.move_type_label}` : ""}
                          </p>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-[13px] font-medium text-[#1a1f1b]">{m.scheduled_time || "—"}</p>
                          <span className="text-[11px] font-semibold text-[#5A6B5E]">{labelStatus(m.status || "")}</span>
                          {m.tracking_url && (
                            <a
                              href={m.tracking_url}
                              className="block text-[12px] font-semibold text-[#632E32] mt-0.5 hover:underline"
                            >
                              Track
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === "week" && (
            <div className="rounded-none bg-[#F9F7F2] overflow-x-auto overflow-y-hidden shadow-[0_4px_24px_rgba(45,58,38,0.07)]">
              <div className={`flex min-w-[720px] sm:min-w-0 gap-px ${HAIRLINE_BG}`}>
                <div className="flex flex-col gap-px bg-[#E8E6E1] pt-12 shrink-0 w-11 sm:w-12">
                  {Array.from({ length: WEEK_HOUR_COUNT }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                    <div
                      key={h}
                      className="h-12 flex items-start justify-end pr-1.5 sm:pr-2 text-[10px] text-[#8A8780] leading-none pt-0.5 bg-[#F9F7F2]"
                    >
                      {hourLabel12(h).replace(/\s/g, "")}
                    </div>
                  ))}
                </div>
                <div className={`flex-1 grid grid-cols-7 min-w-0 gap-px ${HAIRLINE_BG}`}>
                  {weekDayCells.map(({ ymd }) => {
                    const isToday = ymd === todayYmd;
                    const dayMoves = filteredByDate[ymd] ?? [];
                    const wkShort = formatDateYmd(ymd, { weekday: "short" }).toUpperCase();
                    return (
                      <div key={ymd} className={`min-w-0 flex flex-col gap-px ${HAIRLINE_BG}`}>
                        <div className="h-12 bg-[#F5F2EC] flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5A6B5E]">
                            {wkShort} {parseYmd(ymd).getDate()}
                          </span>
                        </div>
                        <div className="relative flex-1 min-h-[624px]">
                          <div className="flex flex-col">
                            {Array.from({ length: WEEK_HOUR_COUNT }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                              <div key={h} className={`h-12 ${isToday ? "bg-[#EFEEEC]" : "bg-white"}`} />
                            ))}
                          </div>
                          <div className="absolute inset-0 pointer-events-none px-0.5">
                            {dayMoves.slice(0, 6).map((m, idx) => {
                              const hour = parseWindowStartHour(m.scheduled_time);
                              const slot = Math.max(0, Math.min(WEEK_HOUR_COUNT - 1, hour - WEEK_START_HOUR));
                              const rowPx = 48;
                              const topPx = slot * rowPx + 2 + (idx % 3) * 16;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  style={{ top: `${topPx}px`, left: "2px", right: "2px" }}
                                  className="pointer-events-auto absolute rounded-none border-0 bg-white px-1 py-1 text-left text-[9px] leading-tight text-[#1a1f1b] shadow-[0_1px_4px_rgba(45,58,38,0.12)] hover:shadow-[0_2px_8px_rgba(45,58,38,0.18)] transition-shadow max-h-[3rem] overflow-hidden"
                                  onClick={() => {
                                    setFocusDate(ymd);
                                    setSelectedDate(ymd);
                                    setViewMode("day");
                                  }}
                                >
                                  <span className="font-bold text-[#2D3A26] block truncate">
                                    {m.scheduled_time || "—"}
                                  </span>
                                  <span className="text-[#5A6B5E] block truncate">{m.tenant_name || "Move"}</span>
                                </button>
                              );
                            })}
                            {dayMoves.length > 6 && (
                              <p className="absolute bottom-1 left-1 right-1 text-[9px] text-center text-[#5A6B5E] pointer-events-none">
                                +{dayMoves.length - 6} more
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {viewMode === "year" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mNum) => {
                const miniCells = buildMondayFirstGrid(year, mNum);
                const monthTitle = formatDateYmd(`${year}-${pad2(mNum)}-01`, { month: "long" });
                return (
                  <div
                    key={mNum}
                    className="rounded-none bg-white p-3 sm:p-4 shadow-[0_4px_20px_rgba(45,58,38,0.1)]"
                  >
                    <button
                      type="button"
                      className="w-full text-left font-bold text-[13px] sm:text-[14px] text-[#1a1f1b] mb-2.5 hover:text-[#2D3A26] transition-colors"
                      onClick={() => {
                        setViewMode("month");
                        setMonth(mNum);
                        setYear(year);
                        setFocusDate(`${year}-${pad2(mNum)}-01`);
                      }}
                    >
                      {monthTitle}
                    </button>
                    <div className="grid grid-cols-7 gap-y-1 mb-1.5">
                      {MINI_WEEK.map((l, idx) => (
                        <div
                          key={`${mNum}-h-${idx}`}
                          className="text-center text-[8px] font-bold uppercase text-[#8A8780]"
                        >
                          {l}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-x-0 gap-y-1">
                      {miniCells.map((c, i) => {
                        const isSel = selectedDate === c.dateStr;
                        const isOut = c.kind === "out";
                        return (
                          <button
                            key={`${c.dateStr}-${i}`}
                            type="button"
                            disabled={isOut}
                            onClick={() => {
                              if (isOut) return;
                              setSelectedDate(c.dateStr);
                              setFocusDate(c.dateStr);
                              setMonth(mNum);
                              setYear(year);
                              setViewMode("day");
                            }}
                            className={`aspect-square max-h-[22px] w-full flex items-center justify-center text-[9px] font-medium border-0 ${
                              isOut
                                ? "text-transparent cursor-default"
                                : isSel
                                  ? "bg-[#2D3A26] text-white hover:bg-[#243220] z-[1]"
                                  : c.dateStr === todayYmd
                                    ? "bg-[#E6EBE6] text-[#2D3A26] hover:bg-[#DDE4DD]"
                                    : "bg-[#E8E6E3] text-[#3D4540] hover:bg-[#DDDCD8]"
                            }`}
                          >
                            {!isOut ? c.dayNum : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <section className="mt-12 pt-8">
            <h2 className="font-hero text-[18px] sm:text-[20px] font-normal text-[#2D3A26] pb-4">
              Upcoming moves
            </h2>
            {upcomingList.length === 0 ? (
              <div className="py-10 text-center rounded-none bg-white shadow-[0_4px_20px_rgba(45,58,38,0.08)]">
                <p className="text-[15px] font-semibold text-[#1a1f1b]">No upcoming moves</p>
                <p className="text-[13px] text-[#5A6B5E] mt-2">No moves scheduled yet.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {upcomingList.map((m) => (
                  <li
                    key={`${m.id}-${m.dateStr}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-none border-0 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(45,58,38,0.08)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#5A6B5E]">
                        {formatDateYmd(m.dateStr, { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <p className="text-[14px] font-semibold text-[#1a1f1b] truncate">
                        {m.tenant_name || "—"} · Unit {m.unit_number || "—"}
                      </p>
                      <p className="text-[12px] text-[#5A6B5E] truncate">
                        {m.building_name || "—"}
                        {m.move_type_label ? ` · ${m.move_type_label}` : ""}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-[13px] text-[#1a1f1b]">{m.scheduled_time || "—"}</p>
                      <span className="text-[11px] font-semibold text-[#5A6B5E]">{labelStatus(m.status || "")}</span>
                      {m.tracking_url && (
                        <a
                          href={m.tracking_url}
                          className="block text-[12px] font-semibold text-[#632E32] mt-0.5 hover:underline"
                        >
                          Track
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

