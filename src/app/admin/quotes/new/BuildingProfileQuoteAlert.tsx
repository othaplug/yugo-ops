"use client";

import { Warning, Buildings } from "@phosphor-icons/react";
import { estimatedTripsFromInventoryScore } from "@/lib/buildings/complexity-pricing";
import { InfoHint } from "@/components/ui/InfoHint";

type Profile = Record<string, unknown>;

function elevatorCopy(system: string | undefined): string {
  const s = (system || "").toLowerCase();
  if (s === "split_transfer") {
    return "Split elevator system: crew may need to transfer between freight and residential elevators.";
  }
  if (s === "multi_transfer") {
    return "Multiple elevator transfers: allow significant extra time per trip.";
  }
  if (s === "no_freight") {
    return "No freight elevator reported: residential elevator or carry only.";
  }
  if (s === "stairs_only") {
    return "Stairs only access reported for this building.";
  }
  return "";
}

export default function BuildingProfileQuoteAlert({
  profile,
  end,
  inventoryScore,
}: {
  profile: Profile | null;
  end: "origin" | "destination";
  inventoryScore: number;
}) {
  if (!profile) return null;
  const rating = Number(profile.complexity_rating) || 1;
  if (rating < 3) return null;

  const extra = Number(profile.estimated_extra_minutes_per_trip) || 0;
  const trips = estimatedTripsFromInventoryScore(inventoryScore);
  const totalExtraMin = trips * extra;
  const extraHrs = Math.round((totalExtraMin / 60) * 10) / 10;
  const transfers = Number(profile.total_elevator_transfers) || 0;
  const name =
    (typeof profile.building_name === "string" && profile.building_name.trim()) ||
    (typeof profile.address === "string" && profile.address.trim()) ||
    "This building";

  const high = rating >= 4;
  const shell =
    "mt-3 rounded-lg border px-3 py-3 " +
    (high
      ? "border-red-200/90 bg-red-50/90 text-red-950"
      : "border-amber-200/90 bg-amber-50/85 text-amber-950");

  const label = end === "origin" ? "Origin building" : "Destination building";

  return (
    <div className={shell}>
      <div className="flex items-start gap-2.5">
        <div
          className={
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md " +
            (high ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")
          }
        >
          {high ? (
            <Warning size={18} weight="bold" aria-hidden />
          ) : (
            <Buildings size={18} weight="bold" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold leading-snug text-[var(--tx)]">
            {label}: complex access ({rating}/5)
          </p>
          <p className="text-[11px] font-medium leading-snug">{name}</p>
          {elevatorCopy(
            typeof profile.elevator_system === "string"
              ? profile.elevator_system
              : undefined,
          ) ? (
            <p className="text-[10px] leading-relaxed text-[var(--tx2)]">
              {elevatorCopy(
                typeof profile.elevator_system === "string"
                  ? profile.elevator_system
                  : undefined,
              )}
            </p>
          ) : null}
          {transfers > 0 || extra > 0 ? (
            <p className="text-[10px] leading-relaxed text-[var(--tx2)]">
              {transfers > 0 ? (
                <>
                  Elevator transfers: {transfers}
                  {extra > 0 ? " · " : ""}
                </>
              ) : null}
              {extra > 0 ? (
                <>
                  Extra time per trip about {extra} minutes (planning estimate)
                </>
              ) : null}
            </p>
          ) : null}
          {profile.has_commercial_tenants ? (
            <p className="text-[10px] leading-relaxed text-[var(--tx2)]">
              Mixed-use or commercial base reported
              {Array.isArray(profile.commercial_tenants) &&
              (profile.commercial_tenants as string[]).length > 0
                ? `: ${(profile.commercial_tenants as string[]).join(", ")}`
                : ""}
              {profile.elevator_shared ? " · Shared elevator possible" : ""}
            </p>
          ) : null}
          {typeof profile.loading_dock_restrictions === "string" &&
          profile.loading_dock_restrictions.trim() ? (
            <p className="text-[10px] leading-relaxed text-[var(--tx2)]">
              Dock: {profile.loading_dock_restrictions}
            </p>
          ) : null}
          {typeof profile.crew_notes === "string" && profile.crew_notes.trim() ? (
            <div className="rounded-md border border-[var(--brd)]/40 bg-white/60 px-2.5 py-2 text-[10px] leading-relaxed text-[var(--tx2)]">
              <span className="font-semibold text-[var(--tx)]">Crew note: </span>
              {profile.crew_notes}
            </div>
          ) : null}
          {extra > 0 ? (
            <div className="rounded-md border border-[var(--brd)]/40 bg-white/50 px-2.5 py-2 text-[10px] text-[var(--tx2)]">
              <p className="font-medium text-[var(--tx)]">
                Planning impact: about {extraHrs} extra crew hours (model){" "}
                <InfoHint variant="admin" align="start" ariaLabel="How this estimate works">
                  <span>
                    Uses inventory score to estimate truck-to-unit trips, then multiplies by extra
                    minutes per trip from the building profile. Final price includes a building
                    access line in the engine when complexity is 3 or higher.
                  </span>
                </InfoHint>
              </p>
              <p className="mt-1 text-[9px] text-[var(--tx3)]">
                Based on about {extra} minutes × about {trips} trips (estimate)
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {rating >= 4 ? (
              <span className="inline-flex items-center rounded-full border border-red-200/80 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-900">
                Pre-move site check recommended
              </span>
            ) : null}
            {extra >= 10 ? (
              <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-950">
                Consider extra crew
              </span>
            ) : null}
            {typeof profile.elevator_max_hours === "number" &&
            profile.elevator_max_hours > 0 ? (
              <span className="inline-flex items-center rounded-full border border-[var(--brd)]/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--tx2)]">
                Elevator booking max {profile.elevator_max_hours} hours
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
