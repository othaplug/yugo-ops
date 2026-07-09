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
  OFFICE_MOVE_DAY_1_STAGES_ESSENTIAL,
  OFFICE_MOVE_DAY_2_STAGES_ESSENTIAL,
  OFFICE_MOVE_DAY_1_STAGES_SIGNATURE,
  OFFICE_MOVE_DAY_2_STAGES_SIGNATURE,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/crew-tracking-status";
import { OFFICE_MOVE_STATUS_FLOW } from "@/lib/crew-tracking-status";

/**
 * Priority — wine premium shell.
 * Signature — deep green shell (parallels residential Signature quote page).
 * Essential — cream shell that matches the rest of the track page.
 * Tokens live inline so the whole hero renders from one palette.
 */
const WINE = "#2B0416";
const CREAM = "#F9EDE4";
const ROSE = "#E8C4D0";
const MUTED = "rgba(249,237,228,0.75)";
const BORDER = "rgba(249,237,228,0.22)";
const SAGE = "#A3C4A6";

// Signature green (from src/app/quote/[quoteId]/signature-quote-ui.ts)
const SIG_BG = "#15261A";
const SIG_CREAM = "#F4FAF5";
const SIG_KICKER = "#D2EBD8";
const SIG_MUTED = "rgba(244, 250, 245, 0.9)";
const SIG_BORDER = "rgba(184, 212, 190, 0.34)";

// Essential cream (matches OfficeCard tokens elsewhere on the page)
const ESS_BG = "#FFFDF8";
const ESS_INK = "#2C3E2D";
const ESS_KICKER = "rgba(44, 62, 45, 0.55)";
const ESS_MUTED = "rgba(44, 62, 45, 0.65)";
const ESS_BORDER = "rgba(44, 62, 45, 0.10)";

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
  /**
   * Booked office tier. Priority renders the wine premium shell + PM
   * language; Essential and Signature render a cream shell with
   * coordinator-first copy (they don't include an on-site PM per
   * office-tier-definitions.ts).
   */
  officeTierKey?: "essential" | "signature" | "priority" | null;
}

/** Palette shape shared by all sub-components. Priority = wine tokens,
 *  Signature = green tokens, Essential = cream tokens (see OfficeTrackHero). */
interface HeroPalette {
  bg: string;
  ink: string;
  kicker: string;
  muted: string;
  border: string;
  checkFill: string;
  checkInkOnFill: string;
  shadow?: string;
}

function StageRow({
  stage,
  isDone,
  isCurrent,
  palette,
}: {
  stage: TrackingStatus;
  isDone: boolean;
  isCurrent: boolean;
  palette: HeroPalette;
}) {
  const label = TRACKING_STATUS_LABELS[stage] ?? stage;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
        style={{
          background: isDone ? palette.checkFill : "transparent",
          border: `1.5px solid ${isDone ? palette.checkFill : isCurrent ? palette.kicker : palette.border}`,
        }}
      >
        {isDone ? (
          <Check size={14} weight="bold" color={palette.checkInkOnFill} />
        ) : isCurrent ? (
          <Circle size={8} weight="fill" color={palette.kicker} />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-medium leading-tight"
          style={{ color: isDone || isCurrent ? palette.ink : palette.muted }}
        >
          {label}
        </p>
        {isCurrent && (
          <p className="text-[10px] mt-0.5 tracking-wider uppercase font-bold" style={{ color: palette.kicker }}>
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
  palette,
  columnBg,
}: {
  dayLabel: string;
  dayTitle: string;
  stages: TrackingStatus[];
  currentStage: string | null;
  completedStages: Set<string>;
  palette: HeroPalette;
  /** Inner column tint; slightly lifted from the hero background. */
  columnBg: string;
}) {
  const currentIdx = currentStage
    ? stages.findIndex((s) => s === currentStage)
    : -1;
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: columnBg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <p
        className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1"
        style={{ color: palette.kicker }}
      >
        {dayLabel}
      </p>
      <p
        className="text-[15px] font-semibold mb-3"
        style={{ color: palette.ink }}
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
            palette={palette}
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
  officeTierKey = null,
}: OfficeTrackHeroProps) {
  const isPriority = officeTierKey === "priority";
  const isSignature = officeTierKey === "signature";
  const isEssential = officeTierKey === "essential";
  // Essential + Signature don't include an on-site PM (per
  // office-tier-definitions.ts). The client sees a coordinator, not a
  // project manager, on the hero + labels + KV rows.
  // Priority: on-site Project Manager runs the show; NEVER fall back
  // to the coordinator (they're distinct people with distinct roles
  // — one books, one runs the day). Show a placeholder if PM isn't
  // set yet rather than pretending Jon is both.
  const leadName = isPriority
    ? projectManagerName || "Your project manager"
    : coordinatorName || "Your coordinator";
  const leadPhone = isPriority
    ? projectManagerPhone || null
    : coordinatorPhone || null;
  const leadRoleLabel = isPriority ? "Project Manager" : "Coordinator";
  const heroHeadline = isPriority
    ? "Your relocation is in motion."
    : isSignature
      ? "Your relocation is booked."
      : "Your relocation is confirmed.";
  const heroLeadVerb = isPriority ? "is running this project" : "is coordinating this move";
  // Retained for downstream template calls (day-plan body text).
  const pmName = leadName;
  const pmPhone = leadPhone;
  const days = Math.max(1, Math.floor(officeDayCount ?? 1));

  // Per-tier Day 1 / Day 2 stages + labels. Essential = walkthrough +
  // IT documentation only (no Yugo-side packing). Signature = walkthrough
  // + IT documentation + IT packing (Yugo packs IT hardware only).
  // Priority = full pack (default constants). Day 2 for Essential and
  // Signature drops the "setup" stage — the client owns setup / unpack.
  const day1Stages = isEssential
    ? OFFICE_MOVE_DAY_1_STAGES_ESSENTIAL
    : isSignature
      ? OFFICE_MOVE_DAY_1_STAGES_SIGNATURE
      : OFFICE_MOVE_DAY_1_STAGES;
  const day2Stages = isEssential
    ? OFFICE_MOVE_DAY_2_STAGES_ESSENTIAL
    : isSignature
      ? OFFICE_MOVE_DAY_2_STAGES_SIGNATURE
      : OFFICE_MOVE_DAY_2_STAGES;
  const day1Label = isEssential
    ? "Site prep"
    : isSignature
      ? "IT prep & pack"
      : "Prep & pack";
  const day2Label = isPriority ? "Move & set up" : "Move day";

  // Per-tier palette. Priority → wine premium; Signature → deep green
  // (mirrors residential Signature quote page); Essential → cream that
  // sits inside the same rhythm as the OfficeCard tokens below the hero.
  const palette = isSignature
    ? {
        bg: SIG_BG,
        ink: SIG_CREAM,
        kicker: SIG_KICKER,
        muted: SIG_MUTED,
        border: SIG_BORDER,
        checkFill: "#3A5C40",
        checkInkOnFill: SIG_CREAM,
      }
    : isEssential
      ? {
          bg: ESS_BG,
          ink: ESS_INK,
          kicker: ESS_KICKER,
          muted: ESS_MUTED,
          border: ESS_BORDER,
          checkFill: ESS_INK,
          checkInkOnFill: ESS_BG,
          shadow:
            "0 1px 2px rgba(44, 62, 45, 0.04), 0 12px 32px rgba(44, 62, 45, 0.05)",
        }
      : {
          bg: WINE,
          ink: CREAM,
          kicker: ROSE,
          muted: MUTED,
          border: BORDER,
          checkFill: SAGE,
          checkInkOnFill: WINE,
        };

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

  // Inner column tint (Day 1 / Day 2 blocks + Share banner). Slightly
  // lifted vs the hero background. On light shells we go slightly darker
  // than the shell; on dark shells we go slightly lighter.
  const columnBg = isEssential
    ? "rgba(44, 62, 45, 0.03)"
    : isSignature
      ? "rgba(244, 250, 245, 0.04)"
      : "rgba(249, 237, 228, 0.04)";
  const shareBannerBg = isEssential
    ? "rgba(44, 62, 45, 0.04)"
    : isSignature
      ? "rgba(244, 250, 245, 0.06)"
      : "rgba(249, 237, 228, 0.06)";

  return (
    <div
      className="mb-6 rounded-lg overflow-hidden"
      style={{
        background: palette.bg,
        color: palette.ink,
        border: isEssential ? `1px solid ${palette.border}` : undefined,
        boxShadow: palette.shadow,
      }}
    >
      {/* Hero header */}
      <div className="px-5 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-2 mb-3">
          <Buildings size={14} color={palette.kicker} weight="bold" />
          <span
            className="text-[10px] font-bold tracking-[0.16em] uppercase"
            style={{ color: palette.kicker }}
          >
            Office Relocation
          </span>
        </div>
        <h1
          className="text-[22px] md:text-[26px] font-bold leading-tight mb-2"
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            color: palette.ink,
          }}
        >
          {heroHeadline}
        </h1>
        <p className="text-[13px] leading-relaxed" style={{ color: palette.muted }}>
          {leadName} {heroLeadVerb}. Below is the live status of every
          step, split across {days === 1 ? "the move day" : `${days} days`}.
        </p>

        {/* Quick facts */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p
              className="text-[9px] font-bold tracking-widest uppercase mb-1"
              style={{ color: palette.kicker }}
            >
              {days > 1 ? "Dates" : "Date"}
            </p>
            <p className="text-[13px] font-semibold" style={{ color: palette.ink }}>
              {dateRange}
            </p>
          </div>
          {typeof crewSize === "number" && crewSize > 0 && (
            <div>
              <p
                className="text-[9px] font-bold tracking-widest uppercase mb-1"
                style={{ color: palette.kicker }}
              >
                Team
              </p>
              <p className="text-[13px] font-semibold" style={{ color: palette.ink }}>
                {crewSize} crew
              </p>
            </div>
          )}
          {fleetLabel && (
            <div>
              <p
                className="text-[9px] font-bold tracking-widest uppercase mb-1"
                style={{ color: palette.kicker }}
              >
                Fleet
              </p>
              <p className="text-[13px] font-semibold" style={{ color: palette.ink }}>
                {fleetLabel}
              </p>
            </div>
          )}
          <div>
            <p
              className="text-[9px] font-bold tracking-widest uppercase mb-1"
              style={{ color: palette.kicker }}
            >
              {leadRoleLabel}
            </p>
            <p className="text-[13px] font-semibold" style={{ color: palette.ink }}>
              {leadName}
            </p>
            {leadPhone && (
              <a
                href={`tel:+1${leadPhone.replace(/\D/g, "")}`}
                className="text-[11px] underline underline-offset-2"
                style={{ color: palette.kicker }}
              >
                {leadPhone}
              </a>
            )}
          </div>
          {/* Priority: also surface the Coordinator as a distinct
              secondary contact. Coordinator books and orchestrates,
              PM runs the crew on site — two roles, two people. Only
              shown when the coordinator is a different person than
              the PM (so we don't render "Jon / Jon"). */}
          {isPriority &&
          coordinatorName?.trim() &&
          coordinatorName.trim().toLowerCase() !==
            (projectManagerName?.trim() || "").toLowerCase() ? (
            <div>
              <p
                className="text-[9px] font-bold tracking-widest uppercase mb-1"
                style={{ color: palette.kicker }}
              >
                Coordinator
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ color: palette.ink }}
              >
                {coordinatorName.trim()}
              </p>
              {coordinatorPhone ? (
                <a
                  href={`tel:+1${coordinatorPhone.replace(/\D/g, "")}`}
                  className="text-[11px] underline underline-offset-2"
                  style={{ color: palette.kicker }}
                >
                  {coordinatorPhone}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {showShareBanner && (
          <div
            className="mt-6 rounded p-3 text-[12px] leading-relaxed"
            style={{
              background: shareBannerBg,
              border: `1px solid ${palette.border}`,
              color: palette.muted,
            }}
          >
            <strong style={{ color: palette.ink }}>Share this link</strong> with
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
          style={{ borderColor: palette.border }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.16em] uppercase mb-4"
            style={{ color: palette.kicker }}
          >
            Move plan
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <DayColumn
              dayLabel="Day 1"
              dayTitle={day1Label}
              stages={day1Stages}
              currentStage={currentStage}
              completedStages={completedStages}
              palette={palette}
              columnBg={columnBg}
            />
            <DayColumn
              dayLabel="Day 2"
              dayTitle={day2Label}
              stages={day2Stages}
              currentStage={currentStage}
              completedStages={completedStages}
              palette={palette}
              columnBg={columnBg}
            />
          </div>
        </div>
      )}
    </div>
  );
}
