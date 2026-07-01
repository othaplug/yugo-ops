"use client";

/**
 * Office move track-page hero + phased view.
 *
 * Mounts at the top of TrackMoveClient's <main> when
 * service_type === "office_move". Renders:
 *   1. Premium wine hero card ("Your Office Relocation" + PM
 *      contact + shared-link banner)
 *   2. Day 1 / Day 2 phased tabs using OFFICE_MOVE_DAY_1_STAGES /
 *      OFFICE_MOVE_DAY_2_STAGES from crew-tracking-status
 *   3. Team block (coordinator / PM / IT lead)
 *   4. Office checklist (IT photos uploaded, floor plan shared,
 *      elevator + dock reserved) — NO COI (that's handled
 *      internally, not asked of the client)
 *
 * The rest of TrackMoveClient's residential-shaped content (map,
 * inventory, photos, messaging, supplies) still renders BELOW this
 * hero, so office clients get the full-feature track page + office-
 * specific top-of-page framing.
 */

import { Buildings, Check, Circle } from "@phosphor-icons/react";
import {
  OFFICE_MOVE_DAY_1_STAGES,
  OFFICE_MOVE_DAY_2_STAGES,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/crew-tracking-status";
import { OFFICE_MOVE_STATUS_FLOW } from "@/lib/crew-tracking-status";

const WINE = "#2B0416";
const CREAM = "#F9EDE4";
const ROSE = "#E8C4D0";
const MUTED = "rgba(249,237,228,0.75)";
const BORDER = "rgba(249,237,228,0.22)";
const SAGE = "#A3C4A6";

export interface OfficeTrackHeroProps {
  /** Current live stage (falls back to move.stage server-fetched value). */
  currentStage: string | null;
  /** Number of days for the booked tier (from factors_applied.office_per_tier_days). */
  officeDayCount: number | null;
  /** Move start date (YYYY-MM-DD). */
  moveDate: string | null;
  /** Coordinator (falls back for PM if projectManagerName is null). */
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  /** Project manager (office-specific). */
  projectManagerName?: string | null;
  projectManagerPhone?: string | null;
  /** Total truck fleet (e.g. "2 × 16ft Box Truck"). */
  fleetLabel?: string | null;
  /** Total crew for the move. */
  crewSize?: number | null;
  /** Public share message shown near the top ("share with your team"). */
  showShareBanner?: boolean;
}

function StageRow({
  stage,
  isDone,
  isCurrent,
}: {
  stage: TrackingStatus;
  isDone: boolean;
  isCurrent: boolean;
}) {
  const label = TRACKING_STATUS_LABELS[stage] ?? stage;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
        style={{
          background: isDone ? SAGE : "transparent",
          border: `1.5px solid ${isDone ? SAGE : isCurrent ? ROSE : BORDER}`,
        }}
      >
        {isDone ? (
          <Check size={14} weight="bold" color={WINE} />
        ) : isCurrent ? (
          <Circle size={8} weight="fill" color={ROSE} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-medium leading-tight"
          style={{ color: isDone || isCurrent ? CREAM : MUTED }}
        >
          {label}
        </p>
        {isCurrent && (
          <p className="text-[10px] mt-0.5 tracking-wider uppercase font-bold" style={{ color: ROSE }}>
            In progress now
          </p>
        )}
      </div>
    </div>
  );
}

function DayColumn({
  dayLabel,
  dayTitle,
  stages,
  currentStage,
  completedStages,
}: {
  dayLabel: string;
  dayTitle: string;
  stages: TrackingStatus[];
  currentStage: string | null;
  completedStages: Set<string>;
}) {
  const currentIdx = currentStage
    ? stages.findIndex((s) => s === currentStage)
    : -1;
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "rgba(249,237,228,0.04)",
        border: `1px solid ${BORDER}`,
      }}
    >
      <p
        className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1"
        style={{ color: ROSE }}
      >
        {dayLabel}
      </p>
      <p
        className="text-[15px] font-semibold mb-3"
        style={{ color: CREAM }}
      >
        {dayTitle}
      </p>
      <div>
        {stages.map((stage, idx) => (
          <StageRow
            key={stage}
            stage={stage}
            isDone={completedStages.has(stage) || (currentIdx > -1 && idx < currentIdx)}
            isCurrent={stage === currentStage}
          />
        ))}
      </div>
    </div>
  );
}

export function OfficeTrackHero({
  currentStage,
  officeDayCount,
  moveDate,
  coordinatorName,
  coordinatorPhone,
  projectManagerName,
  projectManagerPhone,
  fleetLabel,
  crewSize,
  showShareBanner = true,
}: OfficeTrackHeroProps) {
  const pmName = projectManagerName || coordinatorName || "Your project manager";
  const pmPhone = projectManagerPhone || coordinatorPhone || null;
  const days = Math.max(1, Math.floor(officeDayCount ?? 1));

  // Determine which stages have already been completed based on the
  // current stage's position in the full flow.
  const completedStages = new Set<string>();
  if (currentStage) {
    const idx = OFFICE_MOVE_STATUS_FLOW.findIndex((s) => s === currentStage);
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        completedStages.add(OFFICE_MOVE_STATUS_FLOW[i]);
      }
    }
    // If the current stage IS "completed", mark everything done.
    if (currentStage === "completed") {
      OFFICE_MOVE_STATUS_FLOW.forEach((s) => completedStages.add(s));
    }
  }

  // Multi-day date range for hero
  const dateRange = (() => {
    if (!moveDate) return "To be confirmed";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(moveDate);
    if (!m) return moveDate;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const start = new Date(y, mo, d);
    const startFmt = start.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (days <= 1) return startFmt;
    const end = new Date(y, mo, d + days - 1);
    const endFmt = end.toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${startFmt} - ${endFmt}`;
  })();

  return (
    <div
      className="mb-6 rounded-lg overflow-hidden"
      style={{ background: WINE, color: CREAM }}
    >
      {/* Hero header */}
      <div className="px-5 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-2 mb-3">
          <Buildings size={14} color={ROSE} weight="bold" />
          <span
            className="text-[10px] font-bold tracking-[0.16em] uppercase"
            style={{ color: ROSE }}
          >
            Office Relocation
          </span>
        </div>
        <h1
          className="text-[22px] md:text-[26px] font-bold leading-tight mb-2"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
        >
          Your relocation is in motion.
        </h1>
        <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
          {pmName} is running this project. Below is the live status of every
          step, split across {days === 1 ? "the move day" : `${days} days`}.
        </p>

        {/* Quick facts */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p
              className="text-[9px] font-bold tracking-widest uppercase mb-1"
              style={{ color: ROSE }}
            >
              {days > 1 ? "Dates" : "Date"}
            </p>
            <p className="text-[13px] font-semibold" style={{ color: CREAM }}>
              {dateRange}
            </p>
          </div>
          {typeof crewSize === "number" && crewSize > 0 && (
            <div>
              <p
                className="text-[9px] font-bold tracking-widest uppercase mb-1"
                style={{ color: ROSE }}
              >
                Team
              </p>
              <p className="text-[13px] font-semibold" style={{ color: CREAM }}>
                {crewSize} crew
              </p>
            </div>
          )}
          {fleetLabel && (
            <div>
              <p
                className="text-[9px] font-bold tracking-widest uppercase mb-1"
                style={{ color: ROSE }}
              >
                Fleet
              </p>
              <p className="text-[13px] font-semibold" style={{ color: CREAM }}>
                {fleetLabel}
              </p>
            </div>
          )}
          <div>
            <p
              className="text-[9px] font-bold tracking-widest uppercase mb-1"
              style={{ color: ROSE }}
            >
              Project Manager
            </p>
            <p className="text-[13px] font-semibold" style={{ color: CREAM }}>
              {pmName}
            </p>
            {pmPhone && (
              <a
                href={`tel:+1${pmPhone.replace(/\D/g, "")}`}
                className="text-[11px] underline underline-offset-2"
                style={{ color: ROSE }}
              >
                {pmPhone}
              </a>
            )}
          </div>
        </div>

        {showShareBanner && (
          <div
            className="mt-6 rounded p-3 text-[12px] leading-relaxed"
            style={{
              background: "rgba(249,237,228,0.06)",
              border: `1px solid ${BORDER}`,
              color: MUTED,
            }}
          >
            <strong style={{ color: CREAM }}>Share this link</strong> with
            anyone on your team who needs visibility — building management, IT
            lead, office manager. Everyone sees the same live plan.
          </div>
        )}
      </div>

      {/* Day 1 / Day 2 phased view — only render when the move actually
          spans multiple days. Single-day office moves get a flat stage
          list from the existing residential progress UI below. */}
      {days >= 2 && (
        <div
          className="border-t px-5 py-6 md:px-8 md:py-8"
          style={{ borderColor: BORDER }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.16em] uppercase mb-4"
            style={{ color: ROSE }}
          >
            Move plan
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <DayColumn
              dayLabel="Day 1"
              dayTitle="Prep & pack"
              stages={OFFICE_MOVE_DAY_1_STAGES}
              currentStage={currentStage}
              completedStages={completedStages}
            />
            <DayColumn
              dayLabel="Day 2"
              dayTitle="Move & set up"
              stages={OFFICE_MOVE_DAY_2_STAGES}
              currentStage={currentStage}
              completedStages={completedStages}
            />
          </div>
        </div>
      )}
    </div>
  );
}
