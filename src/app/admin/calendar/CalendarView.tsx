"use client";

import { useState, useCallback } from "react";
import { useCalendar } from "@/hooks/useCalendar";
import type { CalendarEvent, ViewMode } from "@/lib/calendar/types";

import CalendarHeader from "./components/CalendarHeader";
import MonthView from "./components/MonthView";
import DayView from "./components/DayView";
import WeekView from "./components/WeekView";
import YearView from "./components/YearView";
import ScheduleJobModal from "./components/ScheduleJobModal";
import JobDetailPanel from "./components/JobDetailPanel";

export default function CalendarView() {
  const cal = useCalendar({ role: "admin", initialView: "month" });

  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    date?: string;
    crewId?: string;
    startTime?: string;
  }>({ open: false });

  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  const handleEventClick = useCallback((ev: CalendarEvent) => {
    setDetailEvent(ev);
  }, []);

  const handleDateClick = useCallback((date: string) => {
    cal.selectDateAndView(date, "day");
  }, [cal]);

  const handleNewClick = useCallback((date: string) => {
    setScheduleModal({ open: true, date });
  }, []);

  const handleEmptyClick = useCallback((crewId: string, time: string) => {
    setScheduleModal({ open: true, date: cal.selectedDate, crewId, startTime: time });
  }, [cal.selectedDate]);

  const handleScheduleJob = useCallback(() => {
    setScheduleModal({ open: true });
  }, []);

  const handleScheduled = useCallback(() => {
    cal.refetch();
    setScheduleModal({ open: false });
  }, [cal]);

  const handleDayClick = useCallback((date: string) => {
    cal.selectDateAndView(date, "day");
  }, [cal]);

  const handleMonthClick = useCallback((month: number) => {
    cal.selectDateAndView(`${cal.yearView}-${String(month + 1).padStart(2, "0")}-01`, "month");
  }, [cal]);

  return (
    <div className="min-h-0 flex flex-col">
      <CalendarHeader
        headerLabel={cal.headerLabel}
        view={cal.view}
        onViewChange={cal.setView}
        onNavigate={cal.navigate}
        onToday={cal.goToday}
        onScheduleJob={handleScheduleJob}
        filters={cal.filters}
        onFiltersChange={cal.setFilters}
        crews={cal.crews}
      />

      {cal.loading && (
        <div className="px-6 py-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!cal.loading && cal.fetchError && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
          {cal.fetchError}
        </div>
      )}

      {!cal.loading && !cal.fetchError && (cal.diagnostics?.movesError || cal.diagnostics?.deliveriesError) && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm space-y-1">
          {cal.diagnostics.movesError && <div>Moves: {cal.diagnostics.movesError}</div>}
          {cal.diagnostics.deliveriesError && <div>Deliveries: {cal.diagnostics.deliveriesError}</div>}
        </div>
      )}

      {!cal.loading && !cal.fetchError && cal.counts && cal.view !== "year" && (
        <div className="mx-3 sm:mx-5 mt-1 px-2.5 py-1 rounded-md bg-[var(--card)] border border-[var(--brd)] text-[10px] text-[var(--tx3)] flex items-center gap-2">
          <span className="text-[var(--tx3)]/50">Range:</span>
          <span>{cal.counts.moves} moves</span>
          <span className="text-[var(--tx3)]/30">·</span>
          <span>{cal.counts.deliveries} deliveries</span>
          <span className="text-[var(--tx3)]/30">·</span>
          <span>{cal.counts.phases ?? 0} phases</span>
        </div>
      )}

      {!cal.loading && (
        <div className="flex flex-1 min-h-0">
          {/* Calendar views */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {cal.view === "month" && (
              <MonthView
                year={cal.monthYear.year}
                month={cal.monthYear.month}
                todayKey={cal.todayKey}
                eventsByDate={cal.eventsByDate}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                onNewClick={handleNewClick}
              />
            )}

            {cal.view === "day" && (
              <DayView
                date={cal.selectedDate}
                todayKey={cal.todayKey}
                events={cal.eventsByDate[cal.selectedDate] || []}
                crews={cal.crews}
                onEventClick={handleEventClick}
                onEmptyClick={handleEmptyClick}
                onEventRescheduled={cal.refetch}
              />
            )}

            {cal.view === "week" && (
              <WeekView
                anchor={cal.weekAnchor}
                todayKey={cal.todayKey}
                eventsByDate={cal.eventsByDate}
                onEventClick={handleEventClick}
                onDayClick={handleDayClick}
              />
            )}

            {cal.view === "year" && (
              <YearView
                year={cal.yearView}
                heatData={cal.heatData}
                todayKey={cal.todayKey}
                onDayClick={handleDayClick}
                onMonthClick={handleMonthClick}
              />
            )}
          </div>

          {/* Detail panel — full-screen overlay on mobile, sidebar on sm+ */}
          {detailEvent && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--card)] sm:static sm:inset-auto sm:z-auto sm:w-[380px] sm:shrink-0 sm:border-l sm:border-[var(--brd)] sm:overflow-y-auto sm:bg-transparent">
              <JobDetailPanel
                event={detailEvent}
                crews={cal.crews}
                onClose={() => setDetailEvent(null)}
                onRescheduled={() => { cal.refetch(); setDetailEvent(null); }}
              />
            </div>
          )}
        </div>
      )}

      <ScheduleJobModal
        open={scheduleModal.open}
        onClose={() => setScheduleModal({ open: false })}
        onScheduled={handleScheduled}
        prefillDate={scheduleModal.date}
        prefillCrewId={scheduleModal.crewId}
        prefillStart={scheduleModal.startTime}
        crews={cal.crews}
      />
    </div>
  );
}
