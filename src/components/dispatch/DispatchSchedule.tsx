"use client";

import { useState, useEffect } from "react";
import { CaretDown as ChevronDown, CaretRight as ChevronRight } from "@phosphor-icons/react";
import JobCard, { type DispatchJob } from "./JobCard";

const ACTIVE_STATUSES = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "in_transit",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "dispatched",
];
const COMPLETED_STATUSES = ["completed", "delivered", "job_complete"];

function sortJobs(jobs: DispatchJob[]): DispatchJob[] {
  const unassigned = jobs.filter((j) => !j.crewId);
  const active = jobs.filter(
    (j) =>
      j.crewId &&
      ACTIVE_STATUSES.includes((j.status || "").toLowerCase()) &&
      !COMPLETED_STATUSES.includes((j.status || "").toLowerCase())
  );
  const upcoming = jobs.filter(
    (j) =>
      !ACTIVE_STATUSES.includes((j.status || "").toLowerCase()) &&
      !COMPLETED_STATUSES.includes((j.status || "").toLowerCase())
  );
  const completed = jobs.filter((j) => COMPLETED_STATUSES.includes((j.status || "").toLowerCase()));

  const byEta = (a: DispatchJob, b: DispatchJob) => (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999);
  const byTime = (a: DispatchJob, b: DispatchJob) =>
    (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99");

  return [
    ...unassigned.sort(byTime),
    ...active.sort(byEta),
    ...upcoming.sort(byTime),
    ...completed.sort(byTime),
  ];
}

interface DispatchScheduleProps {
  jobs: DispatchJob[];
  onReassign?: (job: DispatchJob) => void;
  onContact?: (job: DispatchJob) => void;
  onAddNote?: (job: DispatchJob) => void;
  defaultCompletedOpen?: boolean;
}

export default function DispatchSchedule({
  jobs,
  onReassign,
  onContact,
  onAddNote,
  defaultCompletedOpen = false,
}: DispatchScheduleProps) {
  const [completedOpen, setCompletedOpen] = useState(defaultCompletedOpen);

  useEffect(() => {
    setCompletedOpen(defaultCompletedOpen);
  }, [defaultCompletedOpen]);

  const sorted = sortJobs(jobs);
  const activeAndUpcoming = sorted.filter(
    (j) => !COMPLETED_STATUSES.includes((j.status || "").toLowerCase())
  );
  const completed = sorted.filter((j) =>
    COMPLETED_STATUSES.includes((j.status || "").toLowerCase())
  );

  const showEmpty = jobs.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0 -mx-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 px-1 pr-2">

        {showEmpty && (
          <div className="py-16 sm:py-20 px-4 flex flex-col items-center text-center">
            <p className="text-[13px] font-semibold text-[var(--tx2)]">No jobs scheduled</p>
            <p className="text-[10px] text-[var(--tx3)] mt-1">
              Use the date arrows above to check other days
            </p>
          </div>
        )}

        {activeAndUpcoming.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onReassign={onReassign}
            onContact={onContact}
            onAddNote={onAddNote}
          />
        ))}

        {completed.length > 0 && (
          <div className="border-t border-[var(--brd)] pt-2">
            <button
              type="button"
              onClick={() => setCompletedOpen(!completedOpen)}
              className="flex items-center justify-between w-full text-left py-2.5 px-3 rounded-xl hover:bg-[var(--brd)]/25 transition-colors touch-manipulation group"
            >
              <div className="flex items-center gap-2">
                {completedOpen ? (
                  <ChevronDown className="w-4 h-4 text-[var(--tx3)] group-hover:text-[var(--tx2)] transition-colors" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--tx3)] group-hover:text-[var(--tx2)] transition-colors" />
                )}
                <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--tx3)] group-hover:text-[var(--tx2)] transition-colors">
                  Completed
                </span>
              </div>
              <span className="text-[10px] font-semibold text-[var(--tx3)] bg-[var(--gdim)] px-2 py-0.5 rounded-full tabular-nums">
                {completed.length}
              </span>
            </button>
            {completedOpen && (
              <div className="space-y-2 mt-1">
                {completed.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    compact
                    onReassign={onReassign}
                    onContact={onContact}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
