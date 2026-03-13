"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import { formatMoveDate } from "@/lib/date-format";

interface CrewRow {
  id: string;
  name: string;
  members: string[];
  status: string;
  current_lat?: number | null;
  current_lng?: number | null;
  delay_minutes?: number | null;
}

interface JobRow {
  id: string;
  type: "move" | "delivery";
  label: string;
  client: string;
  address: string;
  time_slot?: string | null;
  status: string;
  crew_id?: string | null;
  href: string;
}

interface Props {
  today: string;
  initialCrews: CrewRow[];
  initialMoves: {
    id: string;
    move_code?: string | null;
    crew_id?: string | null;
    client_name?: string | null;
    from_address?: string | null;
    to_address?: string | null;
    scheduled_date?: string | null;
    preferred_time?: string | null;
    status: string;
  }[];
  initialDeliveries: {
    id: string;
    delivery_number?: string | null;
    crew_id?: string | null;
    client_name?: string | null;
    customer_name?: string | null;
    delivery_address?: string | null;
    scheduled_date?: string | null;
    time_slot?: string | null;
    status: string;
  }[];
}

const MOVE_STATUS_STYLE: Record<string, string> = {
  scheduled: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
  confirmed: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
  dispatched: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  in_progress: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  in_transit: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  completed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
  pending: "text-[var(--gold)] bg-[var(--gdim)]",
  pending_approval: "text-amber-400 bg-amber-500/10",
};

function statusStyle(status: string) {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  return MOVE_STATUS_STYLE[s] || "text-[var(--tx3)] bg-[var(--gdim)]";
}

function statusLabel(status: string) {
  return (status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DispatchBoardClient({ today, initialCrews, initialMoves, initialDeliveries }: Props) {
  const [crews, setCrews] = useState<CrewRow[]>(initialCrews);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const buildJobs = useCallback((moves: Props["initialMoves"], deliveries: Props["initialDeliveries"]) => {
    const moveJobs: JobRow[] = moves
      .filter((m) => m.scheduled_date === today)
      .map((m) => ({
        id: m.id,
        type: "move" as const,
        label: m.move_code || m.id.slice(0, 8).toUpperCase(),
        client: m.client_name || "—",
        address: [m.from_address, m.to_address].filter(Boolean).join(" → ") || "—",
        time_slot: m.preferred_time,
        status: m.status,
        crew_id: m.crew_id,
        href: getMoveDetailPath(m),
      }));

    const deliveryJobs: JobRow[] = deliveries
      .filter((d) => d.scheduled_date === today)
      .map((d) => ({
        id: d.id,
        type: "delivery" as const,
        label: d.delivery_number || d.id.slice(0, 8).toUpperCase(),
        client: d.client_name || d.customer_name || "—",
        address: d.delivery_address || "—",
        time_slot: d.time_slot,
        status: d.status,
        crew_id: d.crew_id,
        href: getDeliveryDetailPath(d),
      }));

    return [...moveJobs, ...deliveryJobs].sort((a, b) => (a.time_slot || "").localeCompare(b.time_slot || ""));
  }, [today]);

  useEffect(() => {
    setJobs(buildJobs(initialMoves, initialDeliveries));
  }, [initialMoves, initialDeliveries, buildJobs]);

  const refresh = useCallback(async () => {
    try {
      const [movesRes, deliveriesRes, crewsRes] = await Promise.all([
        fetch("/api/admin/calendar?type=moves"),
        fetch("/api/admin/calendar?type=deliveries"),
        fetch("/api/tracking/crews-map"),
      ]);
      if (movesRes.ok && deliveriesRes.ok) {
        const [movesData, deliveriesData] = await Promise.all([movesRes.json(), deliveriesRes.json()]);
        setJobs(buildJobs(movesData.moves ?? movesData ?? [], deliveriesData.deliveries ?? deliveriesData ?? []));
      }
      if (crewsRes.ok) {
        const crewData = await crewsRes.json();
        if (Array.isArray(crewData)) setCrews(crewData);
      }
    } catch {
      // silent refresh — no toast needed
    }
  }, [buildJobs]);

  const assignedJobs = jobs.filter((j) => j.crew_id);
  const unassignedJobs = jobs.filter((j) => !j.crew_id);

  const crewJobs = (crewId: string) => assignedJobs.filter((j) => j.crew_id === crewId);

  const activeCrews = crews.filter((c) => crewJobs(c.id).length > 0);
  const idleCrews = crews.filter((c) => crewJobs(c.id).length === 0);

  const handleSendTrackingLink = async (jobId: string) => {
    try {
      const res = await fetch(`/api/moves/${jobId}/send-tracking-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast("Tracking link sent", "check");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send tracking link", "x");
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-5 md:py-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">Dispatch</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">{formatMoveDate(today)} · {jobs.length} job{jobs.length !== 1 ? "s" : ""} scheduled</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
          <Link
            href="/admin/crew"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[11px] font-semibold hover:bg-[var(--gold2)] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Live Map
          </Link>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Jobs", value: jobs.length, color: "var(--gold)" },
          { label: "Assigned", value: assignedJobs.length, color: "var(--grn)" },
          { label: "Unassigned", value: unassignedJobs.length, color: unassignedJobs.length > 0 ? "var(--red)" : "var(--tx3)" },
          { label: "Active Crews", value: activeCrews.length, color: "var(--org)" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-1">{s.label}</p>
            <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Unassigned jobs */}
      {unassignedJobs.length > 0 && (
        <section>
          <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--red)] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--red)] inline-block" />
            Unassigned ({unassignedJobs.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassignedJobs.map((job) => (
              <JobCard key={job.id} job={job} onSendTrackingLink={handleSendTrackingLink} />
            ))}
          </div>
        </section>
      )}

      {/* Crew columns */}
      <section>
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/70 mb-3">Crews</h2>
        {crews.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)]">No crews configured. Set up crews in Platform settings.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {crews.map((crew) => {
              const cJobs = crewJobs(crew.id);
              const isActive = cJobs.length > 0;
              return (
                <div key={crew.id} className={`rounded-xl border ${isActive ? "border-[var(--gold)]/30 bg-[var(--card)]" : "border-[var(--brd)] bg-[var(--bg2)]"} p-4 space-y-3`}>
                  {/* Crew header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? "bg-[var(--grn)]" : "bg-[var(--tx3)]/30"}`} />
                      <span className="text-[13px] font-bold text-[var(--tx)] truncate">{crew.name}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-[rgba(45,159,90,0.15)] text-[var(--grn)]" : "bg-[var(--gdim)] text-[var(--tx3)]"}`}>
                      {isActive ? "On Job" : "Standby"}
                    </span>
                  </div>

                  {/* Members */}
                  {crew.members.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {crew.members.slice(0, 4).map((m, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gdim)] text-[var(--tx3)]">{m}</span>
                      ))}
                      {crew.members.length > 4 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gdim)] text-[var(--tx3)]">+{crew.members.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Jobs */}
                  {cJobs.length > 0 ? (
                    <div className="space-y-2">
                      {cJobs.map((job) => (
                        <JobCard key={job.id} job={job} compact onSendTrackingLink={handleSendTrackingLink} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--tx3)]">No jobs today</p>
                  )}

                  {crew.delay_minutes && crew.delay_minutes > 0 ? (
                    <p className="text-[10px] text-[var(--red)] font-semibold">⚠ {crew.delay_minutes}m delay reported</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Idle crews */}
      {idleCrews.length > 0 && (
        <section>
          <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Idle ({idleCrews.length})</h2>
          <div className="flex flex-wrap gap-2">
            {idleCrews.map((c) => (
              <span key={c.id} className="text-[11px] px-3 py-1 rounded-full border border-[var(--brd)] text-[var(--tx3)]">{c.name}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function JobCard({
  job,
  compact = false,
  onSendTrackingLink,
}: {
  job: JobRow;
  compact?: boolean;
  onSendTrackingLink: (id: string) => void;
}) {
  return (
    <div className={`rounded-lg border border-[var(--brd)] bg-[var(--card)] ${compact ? "p-3" : "p-4"} space-y-1.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${job.type === "move" ? "bg-[rgba(59,130,246,0.1)] text-[#3B82F6]" : "bg-[rgba(45,159,90,0.1)] text-[var(--grn)]"}`}>
              {job.type}
            </span>
            <Link href={job.href} className="text-[12px] font-bold text-[var(--gold)] hover:underline">
              {job.label}
            </Link>
          </div>
          <p className="text-[12px] text-[var(--tx)] mt-0.5 truncate">{job.client}</p>
          {!compact && <p className="text-[10px] text-[var(--tx3)] truncate">{job.address}</p>}
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusStyle(job.status)}`}>
          {statusLabel(job.status)}
        </span>
      </div>

      {job.time_slot && (
        <p className="text-[10px] text-[var(--tx3)]">
          <svg className="inline w-3 h-3 mr-1 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          {job.time_slot}
        </p>
      )}

      {!compact && job.type === "move" && (
        <button
          onClick={() => onSendTrackingLink(job.id)}
          className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
        >
          Send tracking link →
        </button>
      )}
    </div>
  );
}
