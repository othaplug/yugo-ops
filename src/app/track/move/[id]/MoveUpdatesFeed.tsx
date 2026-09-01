"use client";

import { useCallback, useEffect, useState } from "react";

type FeedItem = {
  id: string;
  category: "booking" | "addon" | "crew" | "progress" | "change" | "payment";
  title: string;
  detail?: string;
  icon: string;
  at: string | null;
};

const FOREST = "#2B3927";
const WINE = "#66143D";

function Icon({ name }: { name: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: FOREST,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "Truck":
      return (
        <svg {...common}>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-2" />
          <circle cx="7.5" cy="18.5" r="1.5" />
          <circle cx="17.5" cy="18.5" r="1.5" />
        </svg>
      );
    case "MapPin":
      return (
        <svg {...common}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "Package":
      return (
        <svg {...common}>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "Users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "PencilSimple":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "CreditCard":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "stack":
      return (
        <svg {...common}>
          <path d="m12 2 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        </svg>
      );
    case "CheckCircle":
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

function formatWhen(at: string | null): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Toronto",
  });
}

export default function MoveUpdatesFeed({
  moveId,
  token,
}: {
  moveId: string;
  token: string;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [latestAt, setLatestAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);

  const storageKey = `yugo:move-updates-seen:${moveId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/track/moves/${moveId}/activity?token=${encodeURIComponent(token)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: FeedItem[]; latestAt: string | null };
        if (cancelled) return;
        setItems(data.items || []);
        setLatestAt(data.latestAt ?? null);
        let seen: string | null = null;
        try {
          seen = localStorage.getItem(storageKey);
        } catch {
          seen = null;
        }
        if (data.latestAt && (!seen || new Date(data.latestAt) > new Date(seen))) {
          setHasUnseen(true);
        }
      } catch {
        /* feed is best-effort */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moveId, token, storageKey]);

  const markSeen = useCallback(() => {
    setHasUnseen(false);
    if (latestAt) {
      try {
        localStorage.setItem(storageKey, latestAt);
      } catch {
        /* private mode */
      }
    }
  }, [latestAt, storageKey]);

  if (!loaded || items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 3);

  return (
    <div
      className="mb-4 rounded-2xl border overflow-hidden"
      style={{ borderColor: `${FOREST}22` }}
    >
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
          markSeen();
        }}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left"
        style={{ backgroundColor: `${FOREST}0D` }}
      >
        <span className="flex items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: FOREST }}
          >
            Updates
          </span>
          {hasUnseen && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: WINE }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: WINE }}
              >
                New
              </span>
            </span>
          )}
        </span>
        <span className="text-[11px] font-medium" style={{ color: FOREST, opacity: 0.6 }}>
          {expanded ? "Show less" : `${items.length} update${items.length > 1 ? "s" : ""}`}
        </span>
      </button>

      <ol className="px-4 py-3">
        {visible.map((it, i) => (
          <li key={it.id} className="flex gap-3 pb-3 last:pb-0 relative">
            {/* connector line */}
            {i < visible.length - 1 && (
              <span
                className="absolute left-[7px] top-6 bottom-0 w-px"
                style={{ backgroundColor: `${FOREST}1A` }}
              />
            )}
            <span className="shrink-0 mt-0.5 relative z-10">
              <Icon name={it.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className="text-[13px] font-semibold leading-snug"
                  style={{ color: FOREST }}
                >
                  {it.title}
                </p>
                {formatWhen(it.at) && (
                  <span
                    className="text-[11px] shrink-0 tabular-nums"
                    style={{ color: FOREST, opacity: 0.55 }}
                  >
                    {formatWhen(it.at)}
                  </span>
                )}
              </div>
              {it.detail && (
                <p
                  className="text-[11px] mt-0.5 leading-snug"
                  style={{ color: FOREST, opacity: 0.65 }}
                >
                  {it.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
