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
        <h1 className="admin-page-hero text-[var(--tx)] shrink-0 md:whitespace-nowrap">
          {headerLabel}
        </h1>

        {/* Date navigation */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-2 sm:p-1 rounded-md hover:bg-[var(--card)] text-[var(--tx2)] hover:text-[var(--tx)] transition-colors"
            aria-label="Previous period"
          >
            <CaretLeft size={20} weight="regular" className="text-current" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-2 sm:p-1 rounded-md hover:bg-[var(--card)] text-[var(--tx2)] hover:text-[var(--tx)] transition-colors"
            aria-label="Next period"
          >
            <CaretRight size={20} weight="regular" className="text-current" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="ml-0.5 min-h-[36px] sm:min-h-0 px-3 py-2 sm:px-2 sm:py-0.5 rounded-md text-xs sm:text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
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
                { value: "bin_rental", label: "Bin rentals" },
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
        <div className="flex bg-[var(--bg)] border border-[var(--brd)] rounded-lg sm:rounded-md p-1 sm:p-0.5 shrink-0 w-full sm:w-auto min-w-0">
          {VIEWS.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewChange(mode)}
              className={`flex-1 sm:flex-none min-h-[40px] sm:min-h-0 px-2 py-2 sm:py-0.5 rounded-md sm:rounded text-xs sm:text-[10px] font-semibold uppercase transition-colors ${
                view === mode
                  ? "bg-[var(--card)] text-[var(--gold)] shadow-sm"
                  : "text-[var(--tx2)] hover:text-[var(--tx)]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onScheduleJob}
          className="inline-flex items-center justify-center gap-1 min-h-[40px] sm:min-h-0 px-4 sm:px-2.5 py-2 sm:py-1 rounded-lg sm:rounded-md text-xs sm:text-[10px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-colors shrink-0 w-full sm:w-auto"
        >
          + Schedule
        </button>
      </div>

      {/* Mobile-only filter row */}
      <div className="flex sm:hidden items-center gap-1.5 flex-wrap">
        <select
          value={filters.crewId}
          onChange={(e) => onFiltersChange({ ...filters, crewId: e.target.value })}
          className="text-xs min-h-[40px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-2 text-[var(--tx2)] outline-none"
        >
          <option value="">All Teams</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })}
          className="text-xs min-h-[40px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-2 text-[var(--tx2)] outline-none"
        >
          <option value="">All Types</option>
          <option value="move">Moves</option>
          <option value="delivery">Deliveries</option>
          <option value="bin_rental">Bin rentals</option>
          <option value="project_phase">Projects</option>
          <option value="blocked">Blocked</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
          className="text-xs min-h-[40px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-2 text-[var(--tx2)] outline-none"
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
