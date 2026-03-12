"use client";

import type { ViewMode, CalendarFilters } from "@/lib/calendar/types";

interface Props {
  headerLabel: string;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onNavigate: (dir: number) => void;
  onToday: () => void;
  onScheduleJob: () => void;
  filters: CalendarFilters;
  onFiltersChange: (f: CalendarFilters) => void;
  crews: { id: string; name: string }[];
}

const VIEWS: ViewMode[] = ["day", "week", "month", "year"];

export default function CalendarHeader({
  headerLabel, view, onViewChange, onNavigate, onToday, onScheduleJob,
  filters, onFiltersChange, crews,
}: Props) {
  return (
    <div className="px-6 pt-5 pb-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">{headerLabel}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => onNavigate(-1)} className="p-1.5 rounded-lg hover:bg-[var(--card)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button onClick={() => onNavigate(1)} className="p-1.5 rounded-lg hover:bg-[var(--card)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button onClick={onToday} className="ml-2 px-3 py-1 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
              Today
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-0.5">
            {VIEWS.map((mode) => (
              <button
                key={mode}
                onClick={() => onViewChange(mode)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                  view === mode
                    ? "bg-[var(--card)] text-[var(--gold)] shadow-sm"
                    : "text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={onScheduleJob}
            className="ml-3 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
          >
            + Schedule Job
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filters.crewId}
          onChange={(e) => onFiltersChange({ ...filters, crewId: e.target.value })}
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx2)] focus:border-[var(--brd)] outline-none"
        >
          <option value="">All Teams</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })}
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx2)] focus:border-[var(--brd)] outline-none"
        >
          <option value="">All Types</option>
          <option value="move">Moves</option>
          <option value="delivery">Deliveries</option>
          <option value="project_phase">Projects</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx2)] focus:border-[var(--brd)] outline-none"
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  );
}
