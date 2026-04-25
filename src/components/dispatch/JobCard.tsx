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

/** Yugo+ v3: slate info for in-motion states, not default product blue. */
const ACTIVE_STATUS_INK = "text-[var(--yu3-info)]";

const STATUS_DOT: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  paid: { icon: CheckCircle2, color: "text-[var(--grn)]", label: "Paid" },
  confirmed: {
    icon: CheckCircle2,
    color: "text-[var(--grn)]",
    label: "Confirmed",
  },
  scheduled: { icon: Circle, color: ACTIVE_STATUS_INK, label: "Scheduled" },
  en_route: { icon: Circle, color: ACTIVE_STATUS_INK, label: "En Route" },
  en_route_to_pickup: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "En Route",
  },
  arrived_at_pickup: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "Loading",
  },
  loading: { icon: Circle, color: ACTIVE_STATUS_INK, label: "Loading" },
  en_route_to_destination: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "In Transit",
  },
  in_transit: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "In Transit",
  },
  arrived_at_destination: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "Unloading",
  },
  unloading: { icon: Circle, color: ACTIVE_STATUS_INK, label: "Unloading" },
  in_progress: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "In Progress",
  },
  dispatched: {
    icon: Circle,
    color: ACTIVE_STATUS_INK,
    label: "Dispatched",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-[var(--grn)]",
    label: "Completed",
  },
  delivered: {
    icon: CheckCircle2,
    color: "text-[var(--grn)]",
    label: "Completed",
  },
  job_complete: {
    icon: CheckCircle2,
    color: "text-[var(--grn)]",
    label: "Completed",
  },
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
  return (
    STATUS_DOT[s] || {
      icon: Circle,
      color: "text-[var(--tx3)]",
      label: toTitleCase(status || "-"),
    }
  );
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

export default function JobCard({
  job,
  onReassign,
  onContact,
  onAddNote: _onAddNote,
  compact = false,
}: JobCardProps) {
  const statusInfo = getStatusInfo(job.status);
  const StatusIcon = statusInfo.icon;
  const canReassign = !isJobInProgress(job.status, job.stage);
  const isUnassigned = !job.crewId;

  return (
    <div
      className={`rounded-[var(--yu3-r-lg)] border transition-colors ${
        isUnassigned && !compact
          ? "border-[color-mix(in_srgb,var(--yu3-warning)_40%,var(--yu3-line-subtle))] bg-[var(--yu3-warning-tint)]"
          : "border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]"
      } ${compact ? "p-3" : "p-4"} space-y-2.5 shadow-sm`}
    >
      {/* Header: status + label + time + type badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <StatusIcon className={`w-4 h-4 shrink-0 ${statusInfo.color}`} />
          <span
            className={`text-xs font-bold tracking-wider uppercase ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
          <span className="text-sm font-mono text-[var(--tx2)]">
            {job.label}
          </span>
          {job.scheduledTime && (
            <span className="text-sm text-[var(--tx3)] tabular-nums">
              {job.scheduledTime}
            </span>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-[var(--yu3-r-sm)] uppercase tracking-[0.08em] ${
            job.type === "move"
              ? "bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)]"
              : "bg-[var(--yu3-forest-tint)] text-[var(--yu3-forest)]"
          }`}
        >
          {job.type}
        </span>
      </div>

      {/* Client + tier/partner */}
      <div className="flex items-center gap-2 flex-wrap">
        <User className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0" />
        <span className="text-sm font-semibold text-[var(--tx)]">
          {job.client}
        </span>
        {job.tier && (
          <span className="text-xs px-1.5 py-0.5 rounded-[var(--yu3-r-sm)] bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)] font-bold uppercase tracking-wider">
            {job.tier}
          </span>
        )}
        {job.partnerName && job.type === "delivery" && (
          <span className="text-sm text-[var(--tx3)]">{job.partnerName}</span>
        )}
      </div>

      {/* Route */}
      <div className="flex items-start gap-2 min-w-0">
        <MapPin className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0 mt-0.5" />
        <span className="text-sm text-[var(--tx3)] leading-snug break-words">
          {routeSummary(job.fromAddress, job.toAddress)}
        </span>
      </div>

      {/* Crew + truck + ETA */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        {job.crewId ? (
          <>
            <Users className="w-3.5 h-3.5 text-[var(--tx3)]" />
            <span className="font-semibold text-[var(--tx)]">
              {job.crewName || "Crew"}
            </span>
            <span className="text-[var(--tx3)]">· {job.crewSize} movers</span>
          </>
        ) : (
          <span className="font-bold text-[var(--yu3-warning)] flex items-center gap-1">
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
          <span className="text-[var(--grn)] font-semibold">
            ETA {job.etaMinutes}m
          </span>
        )}
      </div>

      {/* Stage + progress */}
      {!compact && (
        <>
          {job.currentStageLabel && (
            <div className="text-sm text-[var(--tx3)]">
              {job.currentStageLabel}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--yu3-neutral-tint)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--yu3-wine)] transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, job.progress))}%`,
                }}
              />
            </div>
            <span className="text-xs text-[var(--yu3-ink-muted)] w-9 text-right tabular-nums yu3-num">
              {job.progress}%
            </span>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
        <Link
          href={job.href}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] text-sm font-semibold text-[var(--tx2)] hover:border-[var(--yu3-line)] hover:text-[var(--tx)] transition-colors touch-manipulation"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          View
        </Link>
        {onReassign && canReassign && (
          <button
            type="button"
            onClick={() => onReassign(job)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--yu3-r-md)] border text-sm font-semibold transition-colors touch-manipulation ${
              isUnassigned
                ? "border-[color-mix(in_srgb,var(--yu3-warning)_50%,var(--yu3-line-subtle))] text-[var(--yu3-warning)] hover:bg-[var(--yu3-warning-tint)]"
                : "border-[var(--yu3-line-subtle)] text-[var(--tx2)] hover:border-[var(--yu3-line)] hover:text-[var(--tx)]"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            {isUnassigned ? "Assign Crew" : "Reassign"}
          </button>
        )}
        {onContact && (
          <button
            type="button"
            onClick={() => onContact(job)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] text-sm font-semibold text-[var(--tx2)] hover:border-[var(--yu3-line)] hover:text-[var(--tx)] transition-colors touch-manipulation"
          >
            <Phone className="w-4 h-4 shrink-0" />
            Contact
          </button>
        )}
      </div>
    </div>
  );
}
