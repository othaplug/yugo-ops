"use client";

import type { ViewMode, CalendarFilters } from "@/lib/calendar/types";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

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
    <div className="px-3 sm:px-5 pt-4 pb-3 space-y-2 border-b border-[var(--brd)]/50">
      {/* Single row: title · nav · spacer · filters · view toggle · CTA */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Title */}
        <h1 className="font-hero text-[15px] sm:text-[17px] font-bold text-[var(--tx)] leading-none whitespace-nowrap shrink-0">
          {headerLabel}
        </h1>

        {/* Date navigation */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onNavigate(-1)}
            className="p-1 rounded-md hover:bg-[var(--card)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
          >
            <CaretLeft size={13} weight="regular" className="text-current" aria-hidden />
          </button>
          <button
            onClick={() => onNavigate(1)}
            className="p-1 rounded-md hover:bg-[var(--card)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
          >
            <CaretRight size={13} weight="regular" className="text-current" aria-hidden />
          </button>
          <button
            onClick={onToday}
            className="ml-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
          >
            Today
          </button>
        </div>

        <div className="hidden sm:block flex-1" />

        {/* Filters, inline on sm+ */}
        <div className="hidden sm:flex items-center gap-1">
          {[
            {
              value: filters.crewId,
              onChange: (v: string) => onFiltersChange({ ...filters, crewId: v }),
              options: [
                { value: "", label: "All Teams" },
                ...crews.map((c) => ({ value: c.id, label: c.name })),
              ],
            },
            {
              value: filters.type,
              onChange: (v: string) => onFiltersChange({ ...filters, type: v }),
              options: [
                { value: "", label: "All Types" },
                { value: "move", label: "Moves" },
                { value: "delivery", label: "Deliveries" },
                { value: "project_phase", label: "Projects" },
                { value: "blocked", label: "Blocked" },
              ],
            },
            {
              value: filters.status,
              onChange: (v: string) => onFiltersChange({ ...filters, status: v }),
              options: [
                { value: "", label: "All Statuses" },
                { value: "scheduled", label: "Scheduled" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ],
            },
          ].map((sel, idx) => (
            <select
              key={idx}
              value={sel.value}
              onChange={(e) => sel.onChange(e.target.value)}
              className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-0.5 text-[var(--tx2)] outline-none"
            >
              {sel.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
        </div>

        {/* View mode segmented control */}
        <div className="flex bg-[var(--bg)] border border-[var(--brd)] rounded-md p-0.5 shrink-0">
          {VIEWS.map((mode) => (
            <button
              key={mode}
              onClick={() => onViewChange(mode)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${
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
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors shrink-0"
        >
          + Schedule
        </button>
      </div>

      {/* Mobile-only filter row */}
      <div className="flex sm:hidden items-center gap-1 flex-wrap">
        <select
          value={filters.crewId}
          onChange={(e) => onFiltersChange({ ...filters, crewId: e.target.value })}
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-0.5 text-[var(--tx2)] outline-none"
        >
          <option value="">All Teams</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })}
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-0.5 text-[var(--tx2)] outline-none"
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
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-0.5 text-[var(--tx2)] outline-none"
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
