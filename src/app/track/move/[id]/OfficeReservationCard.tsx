/**
 * OfficeReservationCard — the premium "at a glance" summary that replaces
 * the residential DATE / FROM / TO strip on office relocation tracking.
 *
 * Structure:
 *   YOUR RELOCATION                                 CONFIRMED
 *   ─────────────────────────────────────────
 *   Day 1  ·  Saturday, July 11, 2026     Pack & IT prep
 *          Crew arrives 8:00 AM
 *   Day 2  ·  Sunday, July 12, 2026       Move & set up
 *          Crew arrives 8:00 AM
 *   ─────────────────────────────────────────
 *   CURRENT OFFICE          NEW OFFICE
 *   155 University Ave      200 Wellington St W
 *   Toronto, ON             Toronto, ON
 *   Building coord.: handled by your PM
 *   ─────────────────────────────────────────
 *                                    Managed by Jon
 *                                    Project Manager
 *
 * Data-driven — day labels sourced from move_project_days (already loaded
 * client-side via moveProjectForTrack), so this stays in lockstep with
 * the timeline and the confirmation email.
 */

import { formatMoveDate } from "@/lib/date-format";
import {
  OFFICE_TOKENS,
  OfficeCard,
  OfficeCardDivider,
  OfficeCardHeader,
  OfficeStatusPill,
} from "./office-card-primitives";

const FOREST = OFFICE_TOKENS.forest;
const WINE = OFFICE_TOKENS.wine;
const CREAM_LINE = OFFICE_TOKENS.creamLine;
const CREAM_SUBTLE = OFFICE_TOKENS.creamSubtle;

export interface OfficeReservationCardDay {
  date: string; // YYYY-MM-DD
  label: string; // "Pack & IT prep" from move_project_days.label
}

export interface OfficeReservationCardProps {
  status: "confirmed" | "in_progress" | "completed" | string;
  days: OfficeReservationCardDay[];
  arrivalWindow: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  projectManagerName: string | null;
  projectManagerRole?: string;
  companyName?: string | null;
  /**
   * Suppress the "Managed by" footer. Essential is the most basic tier —
   * no dedicated lead-person surface, so the reservation card ends at
   * building coordination.
   */
  hideManagedBy?: boolean;
}

/** Format "Saturday, July 11, 2026" from YYYY-MM-DD. */
function longDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });
}

/** Extract "8:00 AM" from "Morning (8:00 AM - 10:00 AM)" for a certain
 *  crew-arrival time. Falls back to the whole string. */
function crewStartFromWindow(window: string | null): string | null {
  if (!window) return null;
  const m = window.match(/(\d{1,2}:\d{2}\s?[AP]M)/i);
  return m ? m[1] : window;
}

/** Split an address into { streetLine, cityLine } for stacked display. */
function splitAddress(
  raw: string | null,
): { streetLine: string; cityLine: string } {
  if (!raw) return { streetLine: "", cityLine: "" };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { streetLine: parts[0] ?? raw, cityLine: "" };
  const cityLine = parts.slice(1).join(", ");
  return { streetLine: parts[0], cityLine };
}

/* StatusPill + Divider now come from office-card-primitives.tsx so
   every office card shares one shell. Local aliases kept for clarity. */
const StatusPill = OfficeStatusPill;
const Divider = OfficeCardDivider;

function DayRow({
  index,
  day,
  crewStart,
}: {
  index: number;
  day: OfficeReservationCardDay;
  crewStart: string | null;
}) {
  const dayNumber = index + 1;
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <div className="min-w-0">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: CREAM_SUBTLE }}
        >
          Day {dayNumber}
        </p>
        <p
          className="font-hero text-[18px] leading-tight mt-0.5"
          style={{ color: FOREST }}
        >
          {longDate(day.date)}
        </p>
        {crewStart ? (
          <p
            className="text-[12px] mt-1"
            style={{ color: CREAM_SUBTLE }}
          >
            Crew arrives {crewStart}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right pt-0.5">
        <p
          className="text-[13px] font-semibold"
          style={{ color: WINE }}
        >
          {day.label}
        </p>
      </div>
    </div>
  );
}

function OfficeBlock({
  eyebrow,
  address,
}: {
  eyebrow: string;
  address: string | null;
}) {
  const { streetLine, cityLine } = splitAddress(address);
  return (
    <div className="min-w-0">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: CREAM_SUBTLE }}
      >
        {eyebrow}
      </p>
      <p
        className="text-[15px] font-semibold leading-snug mt-1"
        style={{ color: FOREST }}
      >
        {streetLine || "Address on file"}
      </p>
      {cityLine ? (
        <p
          className="text-[12px] mt-0.5"
          style={{ color: CREAM_SUBTLE }}
        >
          {cityLine}
        </p>
      ) : null}
    </div>
  );
}

export default function OfficeReservationCard({
  status,
  days,
  arrivalWindow,
  fromAddress,
  toAddress,
  projectManagerName,
  projectManagerRole = "Project Manager",
  companyName,
  hideManagedBy = false,
}: OfficeReservationCardProps) {
  const crewStart = crewStartFromWindow(arrivalWindow);

  return (
    <OfficeCard ariaLabelledBy="office-reservation-heading">
      <OfficeCardHeader
        titleId="office-reservation-heading"
        eyebrow="Your relocation"
        title={companyName ? `${companyName}, at a glance` : "At a glance"}
        right={<StatusPill status={status} />}
      />

      <Divider />

      {/* Day rhythm */}
      {days.length > 0 ? (
        <div className="divide-y" style={{ borderColor: CREAM_LINE }}>
          {days.map((d, i) => (
            <div
              key={`${d.date}-${i}`}
              className={i > 0 ? "border-t" : ""}
              style={{ borderColor: CREAM_LINE }}
            >
              <DayRow index={i} day={d} crewStart={crewStart} />
            </div>
          ))}
        </div>
      ) : (
        <p
          className="text-[13px]"
          style={{ color: CREAM_SUBTLE }}
        >
          Your project manager will confirm the schedule shortly.
        </p>
      )}

      <Divider />

      {/* Locations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
        <OfficeBlock eyebrow="Current office" address={fromAddress} />
        <OfficeBlock eyebrow="New office" address={toAddress} />
      </div>

      {/* Building coordination — placeholder until building_profiles data
          is threaded through. Presented as coordinator-managed or PM-managed
          depending on tier so the client sees it's handled without
          over-promising specifics. Essential (hideManagedBy) doesn't
          surface this line — the client owns building coordination there. */}
      {!hideManagedBy && (
        <p
          className="text-[12px] mt-4 leading-relaxed"
          style={{ color: CREAM_SUBTLE }}
        >
          Building coordination · Freight elevator, dock, and certificate of
          insurance managed by your{" "}
          {projectManagerRole.toLowerCase()}.
        </p>
      )}

      {/* PM signature — suppressed for Essential (most basic tier, no
          dedicated lead-person surface). */}
      {!hideManagedBy && (
        <>
          <Divider />
          <footer className="flex items-center justify-end gap-2">
            <div className="text-right">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: CREAM_SUBTLE }}
              >
                Managed by
              </p>
              <p
                className="text-[14px] font-semibold mt-0.5"
                style={{ color: FOREST }}
              >
                {projectManagerName?.trim() || "Your Yugo project team"}
              </p>
              <p
                className="text-[11px]"
                style={{ color: CREAM_SUBTLE }}
              >
                {projectManagerRole}
              </p>
            </div>
          </footer>
        </>
      )}
    </OfficeCard>
  );
}
