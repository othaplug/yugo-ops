"use client";

const CREW_ROLES_DEFAULT = ["Lead", "Specialist", "Specialist", "Driver"];

type Props = {
  crewAssigned: boolean;
  revealNames: boolean;
  memberNames: string[];
  /** Optional role labels per member (same length as names when listing). */
  roles?: string[];
  forest: string;
  /** Extra classes on outer wrapper (e.g. border-t spacing). */
  className?: string;
  /** Bin rental and similar: delivery-focused copy instead of full move crew. */
  mode?: "move" | "bins";
};

/**
 * Client track / dashboard: "Your Crew" with names only when allowed; otherwise placeholders.
 */
export default function TrackYourCrewSection({
  crewAssigned,
  revealNames,
  memberNames,
  roles = CREW_ROLES_DEFAULT,
  forest,
  className = "",
  mode = "move",
}: Props) {
  const names = memberNames.filter(Boolean);
  const showNameList = crewAssigned && revealNames && names.length > 0;
  const showFinalizingList =
    crewAssigned && revealNames && names.length === 0;

  const isBins = mode === "bins";

  const placeholderTitle = !crewAssigned
    ? isBins
      ? "Team not assigned yet"
      : "Crew not assigned yet"
    : isBins
      ? "Team assigned — names soon"
      : "Crew assigned — names soon";

  const placeholderBody = !crewAssigned
    ? isBins
      ? "Your coordinator will confirm bin drop-off and pickup and share details here."
      : "Your coordinator will confirm your team and share details here."
    : isBins
      ? "We share names within a few days of service so you can focus on your schedule until then."
      : "We share your crew’s names within three days of move day so you can focus on prep until then.";

  return (
    <div className={className}>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-50 mb-3"
        style={{ color: forest }}
      >
        {isBins ? "Your team" : "Your Crew"}
      </div>

      {showNameList ? (
        <div className="flex flex-wrap gap-3">
          {names.map((name: string, i: number) => (
            <div key={`${name}-${i}`} className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                style={{
                  background: "linear-gradient(135deg, #2C3E2D, #1C3A2B)",
                }}
              >
                {(name || "?")
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: forest }}
                >
                  {name}
                </span>
                <span
                  className="text-[11px] opacity-50 ml-1.5"
                  style={{ color: forest }}
                >
                  {roles[i] || "Team member"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : showFinalizingList ? (
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 border-2 border-dashed"
            style={{
              borderColor: `${forest}35`,
              color: forest,
              opacity: 0.65,
            }}
            aria-hidden
          >
            …
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-semibold leading-snug"
              style={{ color: forest }}
            >
              {isBins ? "Team details coming soon" : "Crew details coming soon"}
            </p>
            <p
              className="text-[12px] mt-1 leading-relaxed opacity-75"
              style={{ color: forest }}
            >
              {isBins
                ? "Your coordinator is finalizing who will run drop-off and pickup. Check back shortly."
                : "Your coordinator is finalizing who's on your team. Check back shortly."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 border-2 border-dashed"
            style={{
              borderColor: `${forest}35`,
              color: forest,
              opacity: 0.65,
            }}
            aria-hidden
          >
            …
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-semibold leading-snug"
              style={{ color: forest }}
            >
              {placeholderTitle}
            </p>
            <p
              className="text-[12px] mt-1 leading-relaxed opacity-75"
              style={{ color: forest }}
            >
              {placeholderBody}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
