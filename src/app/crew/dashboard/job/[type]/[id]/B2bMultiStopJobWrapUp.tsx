"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretRight, Toolbox } from "@phosphor-icons/react";
import JobPhotos from "./JobPhotos";

type SignoffMeta = {
  equipmentCheckDone?: boolean;
  equipmentTrackingUnavailable?: boolean;
}

interface Props {
  jobUuid: string;
  jobRouteId: string;
  jobType: "delivery";
  sessionId: string | null;
  sessionStatus: string;
}

/**
 * After all delivery_stops are complete, crew still needs photos, optional equipment check, and client sign-off.
 */
export default function B2bMultiStopJobWrapUp({
  jobUuid,
  jobRouteId,
  jobType,
  sessionId,
  sessionStatus,
}: Props) {
  const [meta, setMeta] = useState<SignoffMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/crew/signoff/${encodeURIComponent(jobRouteId)}?jobType=${encodeURIComponent(jobType)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setMeta(d as SignoffMeta);
      })
      .catch(() => {
        if (!cancelled) setMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [jobRouteId, jobType]);

  const equipmentPending =
    meta &&
    !meta.equipmentCheckDone &&
    !meta.equipmentTrackingUnavailable;

  const photoCheckpoint =
    sessionStatus === "completed" || !sessionId
      ? "arrived_at_destination"
      : sessionStatus;

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-[var(--yu3-wine)]/25 bg-[var(--yu3-wine-tint)]/40 p-4 shadow-sm">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
          Finish this job
        </p>
        <h3 className="mt-1 text-[16px] font-bold leading-tight text-[var(--yu3-wine)] [font-family:var(--font-body)]">
          Photos, truck check, sign-off
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
          Stops are complete. Add delivery photos, complete the equipment check if
          your team uses it, then open client sign-off to close the job the usual
          way.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-3">
        <JobPhotos
          jobId={jobUuid}
          jobType={jobType}
          sessionId={sessionId}
          currentStatus={sessionStatus || "completed"}
          uploadOverride={{
            category: "walkthrough_final",
            checkpoint: photoCheckpoint,
          }}
        />
      </div>

      {equipmentPending && (
        <Link
          href={`/crew/dashboard/job/${jobType}/${jobRouteId}/equipment-check`}
          className="flex items-center gap-3 rounded-[var(--yu3-r-xl)] border border-[var(--yu3-wine)]/30 bg-[var(--yu3-bg-surface)] px-4 py-3.5 transition-colors hover:bg-[var(--yu3-wine-tint)]/60"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yu3-r-lg)] bg-[var(--yu3-wine)]/12 text-[var(--yu3-wine)]">
            <Toolbox size={22} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
              Truck equipment check
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
              Required before sign-off when your crew tracks gear on this job.
            </p>
          </div>
          <CaretRight
            size={18}
            className="shrink-0 text-[var(--yu3-wine)]"
            aria-hidden
          />
        </Link>
      )}

      <Link
        href={`/crew/dashboard/job/${jobType}/${jobRouteId}/signoff`}
        className="crew-premium-cta flex w-full min-h-[52px] items-center justify-center gap-2 py-3 text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-[#FFFBF7] [font-family:var(--font-body)]"
      >
        Continue to client sign-off
        <CaretRight size={18} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}
