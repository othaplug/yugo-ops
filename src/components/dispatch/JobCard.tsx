"use client";

import { toTitleCase } from "@/lib/format-text";
import Link from "next/link";
import {
  CheckCircle as CheckCircle2,
  Circle,
  WarningCircle as AlertCircle,
  Truck,
  MapPin,
  User,
  Phone,
  ArrowSquareOut as ExternalLink,
  Users,
} from "@phosphor-icons/react";

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
  confirmed: { icon: Circle, color: "text-[#3B82F6]", label: "Confirmed" },
  scheduled: { icon: Circle, color: "text-[#3B82F6]", label: "Confirmed" },
  en_route: { icon: Circle, color: "text-[var(--grn)]", label: "En Route" },
  en_route_to_pickup: { icon: Circle, color: "text-[var(--grn)]", label: "En Route" },
  arrived_at_pickup: { icon: Circle, color: "text-[var(--grn)]", label: "Loading" },
  loading: { icon: Circle, color: "text-[var(--grn)]", label: "Loading" },
  en_route_to_destination: { icon: Circle, color: "text-[var(--grn)]", label: "In Transit" },
  in_transit: { icon: Circle, color: "text-[var(--grn)]", label: "In Transit" },
  arrived_at_destination: { icon: Circle, color: "text-[var(--grn)]", label: "Unloading" },
  unloading: { icon: Circle, color: "text-[var(--grn)]", label: "Unloading" },
  in_progress: { icon: Circle, color: "text-[var(--grn)]", label: "In Progress" },
  dispatched: { icon: Circle, color: "text-[var(--org)]", label: "In Progress" },
  completed: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "Completed" },
  delivered: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "Completed" },
  job_complete: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "Completed" },
  problem: { icon: AlertCircle, color: "text-[var(--red)]", label: "Problem" },
  delayed: { icon: AlertCircle, color: "text-[var(--red)]", label: "Delayed" },
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
  return STATUS_DOT[s] || { icon: Circle, color: "text-[var(--tx3)]", label: toTitleCase(status || "-") };
}

function firstLine(addr: string) {
  const t = (addr || "").trim();
  return t ? t.split(",")[0].trim() : "";
}

function routeSummary(fromAddr: string, toAddr: string): string {
  const from = firstLine(fromAddr);
  const to = firstLine(toAddr);
  if (from && to) return `${from} → ${to}`;
  if (to) return to;
  if (from) return from;
  return "Route TBD";
}


interface JobCardProps {
  job: DispatchJob;
  onReassign?: (job: DispatchJob) => void;
  onContact?: (job: DispatchJob) => void;
  onAddNote?: (job: DispatchJob) => void;
  compact?: boolean;
}

export default function JobCard({ job, onReassign, onContact, onAddNote: _onAddNote, compact = false }: JobCardProps) {
  const statusInfo = getStatusInfo(job.status);
  const StatusIcon = statusInfo.icon;
  const canReassign = !isJobInProgress(job.status, job.stage);
  const isUnassigned = !job.crewId;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isUnassigned && !compact
          ? "border-amber-500/35 bg-amber-500/[0.03]"
          : "border-[var(--brd)] bg-[var(--card)]"
      } ${compact ? "p-3" : "p-4"} space-y-2.5`}
    >
      {/* Header: status + label + time + type badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <StatusIcon className={`w-4 h-4 shrink-0 ${statusInfo.color}`} />
          <span className={`text-[9px] font-bold tracking-wider capitalize ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <span className="text-[11px] font-mono text-[var(--tx2)]">{job.label}</span>
          {job.scheduledTime && (
            <span className="text-[10px] text-[var(--tx3)]">{job.scheduledTime}</span>
          )}
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded capitalize tracking-wide ${
            job.type === "move"
              ? "bg-[#3B82F6]/15 text-[#3B82F6]"
              : "bg-[#A855F7]/15 text-[#A855F7]"
          }`}
        >
          {job.type}
        </span>
      </div>

      {/* Client + tier/partner */}
      <div className="flex items-center gap-2 flex-wrap">
        <User className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0" />
        <span className="text-[12px] font-semibold text-[var(--tx)]">{job.client}</span>
        {job.tier && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--gdim)] text-[var(--tx3)] capitalize">
            {job.tier}
          </span>
        )}
        {job.partnerName && job.type === "delivery" && (
          <span className="text-[10px] text-[var(--tx3)]">{job.partnerName}</span>
        )}
      </div>

      {/* Route */}
      <div className="flex items-start gap-2 min-w-0">
        <MapPin className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0 mt-0.5" />
        <span className="text-[11px] text-[var(--tx3)] leading-snug break-words">
          {routeSummary(job.fromAddress, job.toAddress)}
        </span>
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
          <span className="font-bold text-amber-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Needs assignment
          </span>
        )}
        {job.truckSize && (
          <>
            <Truck className="w-3.5 h-3.5 text-[var(--tx3)]" />
            <span>{job.truckSize}</span>
          </>
        )}
        {job.etaMinutes != null && job.etaMinutes > 0 && (
          <span className="text-[var(--grn)] font-semibold">ETA {job.etaMinutes}m</span>
        )}
      </div>

      {/* Stage + progress */}
      {!compact && (
        <>
          {job.currentStageLabel && (
            <div className="text-[10px] text-[var(--tx3)]">{job.currentStageLabel}</div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--gdim)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--gold)] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
              />
            </div>
            <span className="text-[9px] text-[var(--tx3)] w-7 text-right">{job.progress}%</span>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
        <Link
          href={job.href}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors touch-manipulation"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View
        </Link>
        {onReassign && canReassign && (
          <button
            type="button"
            onClick={() => onReassign(job)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-colors touch-manipulation ${
              isUnassigned
                ? "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {isUnassigned ? "Assign Crew" : "Reassign"}
          </button>
        )}
        {onContact && (
          <button
            type="button"
            onClick={() => onContact(job)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[11px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors touch-manipulation"
          >
            <Phone className="w-3.5 h-3.5" />
            Contact
          </button>
        )}
      </div>
    </div>
  );
}
