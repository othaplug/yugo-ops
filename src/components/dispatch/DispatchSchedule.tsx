"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
}

export default function DispatchSchedule({
  jobs,
  onReassign,
  onContact,
  onAddNote,
}: DispatchScheduleProps) {
  const [completedOpen, setCompletedOpen] = useState(false);
  const sorted = sortJobs(jobs);
  const activeAndUpcoming = sorted.filter(
    (j) => !COMPLETED_STATUSES.includes((j.status || "").toLowerCase())
  );
  const completed = sorted.filter((j) =>
    COMPLETED_STATUSES.includes((j.status || "").toLowerCase())
  );

  return (
    <div className="flex flex-col h-full min-h-0 -mx-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 px-1 pr-2">
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
          <div className="border-t border-[var(--brd)] pt-3">
            <button
              type="button"
              onClick={() => setCompletedOpen(!completedOpen)}
              className="flex items-center gap-2 w-full text-left py-2 px-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
            >
              {completedOpen ? (
                <ChevronDown className="w-4 h-4 text-[var(--tx3)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--tx3)]" />
              )}
              <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                Completed ({completed.length})
              </span>
            </button>
            {completedOpen && (
              <div className="space-y-2 mt-2">
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

        {jobs.length === 0 && (
          <div className="py-12 px-4 text-center">
            <p className="text-[13px] text-[var(--tx2)] font-medium">No jobs scheduled for this date</p>
            <p className="text-[11px] text-[var(--tx3)] mt-1">Use the date arrows above to view other days</p>
          </div>
        )}
      </div>
    </div>
  );
}
