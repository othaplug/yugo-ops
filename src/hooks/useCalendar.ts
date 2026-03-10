"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ViewMode, CalendarRole, CalendarEvent, CalendarFilters, YearHeatData } from "@/lib/calendar/types";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function getWeekRange(anchor: Date) {
  const d = new Date(anchor);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateKey(monday), end: toDateKey(sunday) };
}

interface UseCalendarOptions {
  role: CalendarRole;
  initialView?: ViewMode;
}

export function useCalendar({ role, initialView = "month" }: UseCalendarOptions) {
  const supabase = createClient();
  const today = new Date();
  const todayKey = toDateKey(today);

  const [view, setView] = useState<ViewMode>(initialView);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [yearView, setYearView] = useState(today.getFullYear());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [crews, setCrews] = useState<{ id: string; name: string; memberCount: number }[]>([]);
  const [heatData, setHeatData] = useState<YearHeatData>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ moves: number; deliveries: number; phases?: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState<{ movesError?: string; deliveriesError?: string } | null>(null);

  const [filters, setFilters] = useState<CalendarFilters>({ crewId: "", type: "", status: "" });

  const dateRange = useMemo(() => {
    if (view === "month") return getMonthRange(monthYear.year, monthYear.month);
    if (view === "week") return getWeekRange(weekAnchor);
    if (view === "day") return { start: selectedDate, end: selectedDate };
    return { start: "", end: "" };
  }, [view, monthYear, weekAnchor, selectedDate]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const baseUrl = role === "admin" ? "/api/admin/calendar" : "/api/partner/calendar";

      if (view === "year") {
        const res = await fetch(`${baseUrl}?view=year&year=${yearView}`);
        const data = await res.json();
        setHeatData(data.heat || {});
        setFetchError(!res.ok || data.error ? (data.error || res.statusText || "Failed to load") : null);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });
      if (role === "admin") {
        if (filters.crewId) params.set("crew_id", filters.crewId);
        if (filters.type) params.set("type", filters.type);
        if (filters.status) params.set("status", filters.status);
      }

      const res = await fetch(`${baseUrl}?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setFetchError(data.error || res.statusText || "Failed to load calendar");
        setEvents([]);
      } else {
        setFetchError(null);
        setEvents(data.events || []);
      }
      if (data.crews) setCrews(data.crews);
    } catch (e) {
      console.error("Calendar fetch error:", e);
      setFetchError("Calendar failed to load");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [role, view, dateRange, yearView, filters]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const channel = supabase
      .channel("calendar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "crew_schedule_blocks" }, () => {
        fetchEvents();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "moves" }, () => {
        fetchEvents();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "deliveries" }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const goToday = useCallback(() => {
    setSelectedDate(todayKey);
    setMonthYear({ year: today.getFullYear(), month: today.getMonth() });
    setWeekAnchor(today);
    setYearView(today.getFullYear());
  }, [todayKey]);

  const navMonth = useCallback((dir: number) => {
    setMonthYear((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  }, []);

  const navWeek = useCallback((dir: number) => {
    setWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  }, []);

  const navDay = useCallback((dir: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + dir);
      return toDateKey(d);
    });
  }, []);

  const navYear = useCallback((dir: number) => {
    setYearView((prev) => prev + dir);
  }, []);

  const navigate = useCallback((dir: number) => {
    if (view === "month") navMonth(dir);
    else if (view === "week") navWeek(dir);
    else if (view === "day") navDay(dir);
    else if (view === "year") navYear(dir);
  }, [view, navMonth, navWeek, navDay, navYear]);

  const selectDateAndView = useCallback((date: string, targetView: ViewMode) => {
    setSelectedDate(date);
    const d = new Date(date + "T12:00:00");
    setMonthYear({ year: d.getFullYear(), month: d.getMonth() });
    setWeekAnchor(d);
    setView(targetView);
  }, []);

  const headerLabel = useMemo(() => {
    if (view === "year") return String(yearView);
    if (view === "month") {
      return new Date(monthYear.year, monthYear.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (view === "week") {
      const d = new Date(weekAnchor);
      const dow = d.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fm = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const lm = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${fm} – ${lm}`;
    }
    if (view === "day") {
      return new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
    return "";
  }, [view, yearView, monthYear, weekAnchor, selectedDate]);

  return {
    view, setView,
    selectedDate, setSelectedDate,
    monthYear, weekAnchor, yearView,
    events, eventsByDate, crews, heatData,
    loading,
    fetchError,
    counts,
    diagnostics,
    filters, setFilters,
    todayKey,
    headerLabel,
    navigate, goToday,
    selectDateAndView,
    refetch: fetchEvents,
  };
}
