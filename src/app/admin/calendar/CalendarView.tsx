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
    <div className="min-h-0">
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

      {!cal.loading && (
        <>
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
        </>
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

      <JobDetailPanel
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
      />
    </div>
  );
}
