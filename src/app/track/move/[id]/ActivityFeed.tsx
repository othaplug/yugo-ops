"use client";

import { useEffect, useState } from "react";

const FOREST = "#2C3E2D";
const WINE = "#5C1A33";
const GOLD = "#B8962E";
const SLATE = "#3B3A36";

type ClientActivityEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string | null;
  kind:
    | "quote_accepted"
    | "deposit_paid"
    | "balance_paid"
    | "refund_issued"
    | "scope_charge"
    | "items_requested"
    | "items_approved"
    | "items_removed"
    | "schedule_changed"
    | "move_confirmed"
    | "move_completed";
  amountCents?: number | null;
};

/** Dot tone per event kind. Keeps the UI scannable at a glance. */
function dotColor(kind: ClientActivityEvent["kind"]): string {
  switch (kind) {
    case "quote_accepted":
    case "move_confirmed":
      return GOLD;
    case "deposit_paid":
    case "balance_paid":
    case "items_approved":
      return FOREST;
    case "refund_issued":
    case "items_removed":
      return SLATE;
    case "scope_charge":
    case "items_requested":
    case "schedule_changed":
      return WINE;
    case "move_completed":
      return FOREST;
    default:
      return SLATE;
  }
}

function fmtWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/**
 * Activity feed shown on the client track page. Pulls events from
 * /api/track/moves/[id]/activity which synthesizes a chronological feed
 * across quote / payments / extra_items / change_requests / move row.
 *
 * Built after the Chidera Allison (MV-30228) call review: the dashboard
 * needs to be authoritative for state changes that previously only existed
 * in the admin coordinator's head. Default collapsed so it doesn't
 * dominate the page; expand to see history.
 */
export default function ActivityFeed({
  moveId,
  token,
  /** Default 5 — recent events only when collapsed. Expand to see all. */
  defaultLimit = 5,
}: {
  moveId: string;
  token: string;
  defaultLimit?: number;
}) {
  const [events, setEvents] = useState<ClientActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/track/moves/${encodeURIComponent(moveId)}/activity?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) {
          setError("Couldn't load activity");
          return;
        }
        const data = (await res.json()) as { events: ClientActivityEvent[] };
        if (cancelled) return;
        setEvents(data.events || []);
      } catch {
        if (!cancelled) setError("Couldn't load activity");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moveId, token]);

  if (error) return null; // Best-effort; don't break the rest of the page.
  if (!events || events.length === 0) return null;

  const visible = showAll ? events : events.slice(0, defaultLimit);
  const hasMore = events.length > defaultLimit;

  return (
    <details
      className="mt-6 rounded-2xl border bg-white [&_summary::-webkit-details-marker]:hidden"
      style={{ borderColor: `${FOREST}1F` }}
      open
    >
      <summary
        className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 select-none border-b"
        style={{ color: FOREST, borderColor: `${FOREST}10` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: GOLD }}>
            Activity
          </span>
          <span className="text-[13px] font-semibold truncate">
            Your move timeline
          </span>
        </div>
        <span
          className="text-[18px] leading-none transition-transform [details[open]_&]:rotate-45"
          aria-hidden
        >
          +
        </span>
      </summary>

      <ol className="m-0 list-none p-4 space-y-0">
        {visible.map((e, i) => {
          const isLast = i === visible.length - 1;
          return (
            <li key={e.id} className="flex gap-3 items-start pb-3 last:pb-0 relative">
              {/* connector */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[7px] top-[14px] bottom-0 w-px"
                  style={{ background: `${FOREST}1A` }}
                />
              )}
              <span
                aria-hidden
                className="w-[14px] h-[14px] rounded-full shrink-0 mt-1 relative z-[1]"
                style={{
                  background: dotColor(e.kind),
                  boxShadow: `0 0 0 3px ${dotColor(e.kind)}1F`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="text-[13px] font-semibold leading-snug"
                  style={{ color: FOREST }}
                >
                  {e.title}
                </div>
                {e.detail && (
                  <div className="text-[12px] mt-0.5 leading-snug" style={{ color: SLATE }}>
                    {e.detail}
                  </div>
                )}
                <div
                  className="text-[10px] mt-1 uppercase tracking-[0.06em] opacity-60"
                  style={{ color: FOREST }}
                >
                  {fmtWhen(e.at)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <div
          className="px-4 pb-3 -mt-1 border-t"
          style={{ borderColor: `${FOREST}08` }}
        >
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: FOREST }}
          >
            {showAll
              ? "Show recent only"
              : `Show all ${events.length} events`}
          </button>
        </div>
      )}
    </details>
  );
}
