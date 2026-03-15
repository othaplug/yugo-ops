"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Truck,
  MapPin,
  User,
  Phone,
  ExternalLink,
  Users,
} from "lucide-react";

export interface DispatchJob {
  id: string;
  type: "move" | "delivery";
  label: string;
  client: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  tier?: string;
  partnerName?: string;
  fromAddress: string;
  toAddress: string;
  scheduledTime: string | null;
  status: string;
  stage: string | null;
  crewId: string | null;
  crewName: string | null;
  crewSize: number;
  truckSize?: string;
  etaMinutes: number | null;
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
  href: string;
  progress: number;
  currentStageLabel: string;
}

const STATUS_DOT: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  confirmed: { icon: Circle, color: "text-[#3B82F6]", label: "CONFIRMED" },
  scheduled: { icon: Circle, color: "text-[#3B82F6]", label: "CONFIRMED" },
  en_route: { icon: Circle, color: "text-[var(--grn)]", label: "EN ROUTE" },
  en_route_to_pickup: { icon: Circle, color: "text-[var(--grn)]", label: "EN ROUTE" },
  arrived_at_pickup: { icon: Circle, color: "text-[var(--grn)]", label: "LOADING" },
  loading: { icon: Circle, color: "text-[var(--grn)]", label: "LOADING" },
  en_route_to_destination: { icon: Circle, color: "text-[var(--grn)]", label: "IN TRANSIT" },
  in_transit: { icon: Circle, color: "text-[var(--grn)]", label: "IN TRANSIT" },
  arrived_at_destination: { icon: Circle, color: "text-[var(--grn)]", label: "UNLOADING" },
  unloading: { icon: Circle, color: "text-[var(--grn)]", label: "UNLOADING" },
  in_progress: { icon: Circle, color: "text-[var(--grn)]", label: "IN PROGRESS" },
  dispatched: { icon: Circle, color: "text-[var(--org)]", label: "IN PROGRESS" },
  completed: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "COMPLETED" },
  delivered: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "COMPLETED" },
  job_complete: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "COMPLETED" },
  problem: { icon: AlertCircle, color: "text-[var(--red)]", label: "PROBLEM" },
  delayed: { icon: AlertCircle, color: "text-[var(--red)]", label: "DELAYED" },
};

const IN_PROGRESS_STATUSES = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "dispatched",
  "in_transit",
];

function isJobInProgress(status: string, stage: string | null): boolean {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  const st = (stage || "").toLowerCase().replace(/-/g, "_");
  return IN_PROGRESS_STATUSES.includes(s) || IN_PROGRESS_STATUSES.includes(st);
}

function getStatusInfo(status: string) {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  return STATUS_DOT[s] || { icon: Circle, color: "text-[var(--tx3)]", label: (status || "—").replace(/_/g, " ").toUpperCase() };
}

function truncate(str: string, len: number) {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

interface JobCardProps {
  job: DispatchJob;
  onReassign?: (job: DispatchJob) => void;
  onContact?: (job: DispatchJob) => void;
  onAddNote?: (job: DispatchJob) => void;
  compact?: boolean;
}

export default function JobCard({ job, onReassign, onContact, onAddNote, compact = false }: JobCardProps) {
  const statusInfo = getStatusInfo(job.status);
  const StatusIcon = statusInfo.icon;
  const canReassign = !isJobInProgress(job.status, job.stage);

  const routeText =
    job.fromAddress && job.toAddress
      ? `${truncate(job.fromAddress, 20)} → ${truncate(job.toAddress, 20)}`
      : job.toAddress
        ? truncate(job.toAddress, 45)
        : "—";

  return (
    <div
      className={`rounded-xl border border-[var(--brd)] bg-[var(--card)] ${compact ? "p-3" : "p-4"} space-y-2.5`}
    >
      {/* Header: status + label + time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={`w-4 h-4 shrink-0 ${statusInfo.color}`} />
          <span className={`text-[9px] font-bold tracking-wider uppercase ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <span className="text-[11px] font-mono text-[var(--tx2)]">{job.label}</span>
          {job.scheduledTime && (
            <span className="text-[10px] text-[var(--tx3)]">{job.scheduledTime}</span>
          )}
        </div>
      </div>

      {/* Client + tier/partner */}
      <div className="flex items-center gap-2 flex-wrap">
        <User className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0" />
        <span className="text-[12px] font-semibold text-[var(--tx)]">{job.client}</span>
        {job.tier && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gdim)] text-[var(--tx3)] uppercase">
            {job.tier}
          </span>
        )}
        {job.partnerName && job.type === "delivery" && (
          <span className="text-[10px] text-[var(--tx3)]">{job.partnerName}</span>
        )}
      </div>

      {/* Route */}
      <div className="flex items-start gap-2">
        <MapPin className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0 mt-0.5" />
        <span className="text-[11px] text-[var(--tx2)]">{routeText}</span>
      </div>

      {/* Crew + truck + ETA */}
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        {job.crewId ? (
          <>
            <Users className="w-3.5 h-3.5 text-[var(--tx3)]" />
            <span className="font-semibold text-[var(--tx)]">{job.crewName || "Crew"}</span>
            <span className="text-[var(--tx3)]">· {job.crewSize} movers</span>
          </>
        ) : (
          <span className="font-semibold text-[var(--red)]">UNASSIGNED</span>
        )}
        {job.truckSize && (
          <>
            <Truck className="w-3.5 h-3.5 text-[var(--tx3)]" />
            <span>{job.truckSize}</span>
          </>
        )}
        {job.etaMinutes != null && job.etaMinutes > 0 && (
          <span className="text-[var(--grn)]">ETA: {job.etaMinutes} min to destination</span>
        )}
      </div>

      {/* Stage + progress */}
      {!compact && (
        <>
          <div className="text-[10px] text-[var(--tx3)]">{job.currentStageLabel}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--gdim)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--gold)] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
              />
            </div>
            <span className="text-[9px] text-[var(--tx3)] w-8">{job.progress}%</span>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href={job.href}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--brd)] text-[10px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View
        </Link>
        {onReassign && canReassign && (
          <button
            type="button"
            onClick={() => onReassign(job)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--brd)] text-[10px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
          >
            <Users className="w-3 h-3" />
            Reassign
          </button>
        )}
        {onContact && (
          <button
            type="button"
            onClick={() => onContact(job)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--brd)] text-[10px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
          >
            <Phone className="w-3 h-3" />
            Contact Client
          </button>
        )}
      </div>
    </div>
  );
}
