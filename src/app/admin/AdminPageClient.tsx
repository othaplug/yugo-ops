"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import Link from "next/link";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import {
  getStatusLabel,
  normalizeStatus,
  MOVE_STATUS_COLORS_ADMIN,
  MOVE_STATUS_LINE_COLOR,
  DELIVERY_STATUS_LINE_COLOR,
} from "@/lib/move-status";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import LiveActivityFeed from "./components/LiveActivityFeed";
import { createButtonBaseClass } from "./components/CreateButton";
import {
  Plus,
  CaretRight,
  ArrowUpRight,
  ArrowsClockwise,
  CloudRain,
  Thermometer,
  Wind,
  Car,
  Drop,
  Warning,
  WarningCircle,
  XCircle,
  UsersThree,
  Funnel,
  CurrencyDollar,
  Star,
  Eye,
  CheckCircle,
  Clock,
  CloudSun,
} from "@phosphor-icons/react";
import { COMPLETENESS_PATH_LABELS } from "@/lib/leads/admin-labels";
import RevenueForecastWidget from "@/components/admin/RevenueForecastWidget";
import { SpeedToLeadHint } from "@/components/admin/AdminContextHints";
import {
  buildPrecipAlertText,
  type MoveWeatherBrief,
} from "@/lib/weather/move-weather-brief";
import { getLocalHourInAppTimezone } from "@/lib/business-timezone";
import { formatDate, formatTime } from "@/lib/client-timezone";
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";
import {
  TierLetterBadge,
  residentialTierFullLabel,
} from "@/design-system/admin/primitives";

/**
 * Legacy mobile-first dashboard. Not mounted from app routes: `/admin` uses
 * `CommandCenterV3Client` (`page.tsx`). Kept for reference or if re-wired later.
 */

/* ── Types ── */

type Job = {
  id: string;
  type: "delivery" | "move";
  name: string;
  subtitle: string;
  time: string;
  status: string;
  date: string;
  tag: string;
  /** Residential tier when present (for compact letter badge). */
  tier_selected?: string | null;
  delivery_number?: string | null;
  move_code?: string | null;
  /** Rain/snow alerts from `moves.weather_alert` (daily cron) */
  weatherAlert?: string | null;
  /** Daytime forecast at pickup (`moves.weather_brief`) */
  weatherBrief?: MoveWeatherBrief | null;
  /** Pickup / drop-off for route conditions */
  fromAddress?: string | null;
  toAddress?: string | null;
};

type ActionTask = {
  id: string;
  taskType: "delivery_request" | "change_request";
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
};

type ActivityEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

interface LiveSession {
  id: string;
  jobId: string;
  jobType: string;
  jobName: string;
  status: string;
  teamName: string;
  crewLeadName: string;
  updatedAt: string;
  toAddress: string | null;
}

type MonthRevenue = {
  m: string;
  moves: number;
  partner: number;
};

type UnassignedJob = {
  id: string;
  name: string;
  date: string;
  type: "move" | "delivery";
  code: string;
  href: string;
};
type CrewCapacityDay = {
  date: string;
  label: string;
  total: number;
  booked: number;
};
type QuotePipeline = {
  openCount: number;
  openValue: number;
  viewedCount: number;
  acceptedThisWeek: number;
  conversionRate: number;
  expiringToday: number;
};
type TodayEarnings = {
  potential: number;
  collected: number;
  pending: number;
  jobCount: number;
};
type SatisfactionData = {
  avgRating: number;
  count: number;
  pendingReviews: number;
};

type LeadAttentionPreviewRow = {
  id: string;
  lead_number: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  completeness_path: string | null;
  status: string;
  service_type: string | null;
  follow_up_sent_at: string | null;
};

type LeadPulse = {
  needsAttention: number;
  avgResponseMin: number | null;
  monthReceived: number;
  attentionPreview?: LeadAttentionPreviewRow[];
};

interface Props {
  todayJobs: Job[];
  upcomingJobs: Job[];
  todayJobCount: number;
  overdueAmount: number;
  overdueCount: number;
  currentMonthRevenue: number;
  revenuePctChange: number;
  revenueBreakdown: { moves: number; partner: number };
  monthlyRevenue: MonthRevenue[];
  activityEvents: ActivityEvent[];
  activeQuotesCount: number;
  actionTasks: ActionTask[];
  unassignedJobs: UnassignedJob[];
  crewCapacity: CrewCapacityDay[];
  quotePipeline: QuotePipeline;
  todayEarnings: TodayEarnings;
  satisfaction: SatisfactionData;
  dailyBrief: string;
  leadPulse: LeadPulse | null;
}

/* ── Helpers ── */

function getJobHref(job: Job): string {
  if (job.type === "delivery") {
    const slug = job.delivery_number || job.id;
    return `/admin/deliveries/${encodeURIComponent(slug)}`;
  }
  const slug = job.move_code?.trim().replace(/^#/, "").toUpperCase() || job.id;
  return `/admin/moves/${slug}`;
}

function getJobLineColor(job: Job): string {
  if (job.type === "delivery")
    return DELIVERY_STATUS_LINE_COLOR[job.status] || "var(--tx3)";
  const n = normalizeStatus(job.status) || "";
  return (
    MOVE_STATUS_LINE_COLOR[job.status] ||
    MOVE_STATUS_LINE_COLOR[n] ||
    "var(--tx3)"
  );
}

function getJobStatusStyle(job: Job): string {
  if (job.type === "delivery") {
    const map: Record<string, string> = {
      pending: "text-[var(--tx2)]",
      scheduled: "text-[#3B82F6]",
      confirmed: "text-[#3B82F6]",
      dispatched: "text-[var(--org)]",
      "in-transit": "text-[var(--org)]",
      delivered: "text-[var(--grn)]",
      cancelled: "text-[var(--red)]",
    };
    return map[job.status] || "text-[var(--tx3)]";
  }
  const n = normalizeStatus(job.status) || "";
  return (
    MOVE_STATUS_COLORS_ADMIN[job.status] ||
    MOVE_STATUS_COLORS_ADMIN[n] ||
    "text-[var(--tx3)]"
  );
}

function getJobStatusLabel(job: Job): string {
  if (job.type === "delivery") {
    return job.status
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return getStatusLabel(job.status);
}

function formatActivityTime(createdAt: string): string {
  const d = new Date(createdAt);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatTime(d, { hour: "numeric", minute: "2-digit" });
}

function getActivityHref(e: ActivityEvent): string {
  if (e.entity_type === "move") return `/admin/moves/${e.entity_id}`;
  if (e.entity_type === "delivery")
    return e.entity_id
      ? `/admin/deliveries/${e.entity_id}`
      : "/admin/deliveries";
  if (e.entity_type === "invoice") return "/admin/invoices";
  return "/admin";
}

function formatActivityDesc(desc: string): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) return `${match[1]} · ${getStatusLabel(match[2] || null)}`;
  if (desc.toLowerCase().includes("payment")) {
    const nameMatch = desc.match(/(.+?)\s*[·]/);
    return nameMatch ? `${nameMatch[1].trim()} · Paid` : desc;
  }
  return desc.length > 60 ? desc.slice(0, 57) + "..." : desc;
}

function formatRelative(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function formatAdminHeaderWeather(brief: MoveWeatherBrief): string {
  const raw = brief.conditionsSummary.trim();
  const cap = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Forecast";
  if (brief.tempLowC === brief.tempHighC) {
    return `${cap} · ${brief.tempHighC}°C`;
  }
  return `${cap} · ${brief.tempLowC}°–${brief.tempHighC}°C`;
}

const TAG_COLORS: Record<string, string> = {
  retail: "text-[var(--org)]/80",
  Retail: "text-[var(--org)]/80",
  move: "text-[#3B82F6]/80",
  Move: "text-[#3B82F6]/80",
  delivery: "text-[var(--org)]/80",
  Delivery: "text-[var(--org)]/80",
  office: "text-violet-400/80",
  Office: "text-violet-400/80",
  single_item: "text-[var(--grn)]/80",
  "Single Item": "text-[var(--grn)]/80",
  gallery: "text-[#3B82F6]/80",
  Gallery: "text-[#3B82F6]/80",
  hospitality: "text-[var(--org)]/80",
  Hospitality: "text-[var(--org)]/80",
  designer: "text-violet-400/80",
  Designer: "text-violet-400/80",
};

/** Empty-state CTAs — intrinsic width, global `.admin-btn` sizing */
const ADMIN_DASH_CTA_ROW =
  "flex flex-row flex-wrap items-center justify-center gap-2 w-full min-w-0";

/* ── Component ── */

export default function AdminPageClient({
  todayJobs,
  upcomingJobs,
  todayJobCount,
  overdueAmount,
  overdueCount,
  currentMonthRevenue,
  revenuePctChange,
  revenueBreakdown,
  monthlyRevenue,
  activityEvents,
  activeQuotesCount,
  actionTasks,
  unassignedJobs,
  crewCapacity,
  quotePipeline,
  todayEarnings,
  satisfaction,
  dailyBrief,
  leadPulse,
}: Props) {
  const router = useRouter();
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [liveSessionsError, setLiveSessionsError] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const [trafficByMoveId, setTrafficByMoveId] = useState<
    Record<string, DrivingTrafficBrief>
  >({});
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [weatherByMoveId, setWeatherByMoveId] = useState<
    Record<string, { brief: MoveWeatherBrief; alert: string | null }>
  >({});
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [hqWeather, setHqWeather] = useState<{
    brief: MoveWeatherBrief;
    alert: string | null;
  } | null>(null);
  const [hqWeatherLoading, setHqWeatherLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(true);

  const refresh = useCallback(async () => {
    router.refresh();
  }, [router]);
  const {
    containerRef: pullRef,
    pullDistance,
    refreshing,
  } = usePullToRefresh({ onRefresh: refresh });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        quickActionsRef.current &&
        !quickActionsRef.current.contains(e.target as Node)
      )
        setQuickActionsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const load = () => {
      fetch("/api/tracking/active")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("tracking"))))
        .then((d) => {
          setLiveSessions(d.sessions || []);
          setLiveSessionsError(false);
        })
        .catch(() => setLiveSessionsError(true));
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHqWeatherLoading(true);
    fetch("/api/admin/hq-weather")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("hq-weather"))))
      .then((d: { brief?: MoveWeatherBrief | null; alert?: string | null }) => {
        if (cancelled) return;
        if (d.brief) setHqWeather({ brief: d.brief, alert: d.alert ?? null });
        else setHqWeather(null);
      })
      .catch(() => {
        if (!cancelled) setHqWeather(null);
      })
      .finally(() => {
        if (!cancelled) setHqWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Client-side weather fetch (moves + deliveries) ──
  const weatherInput = useMemo(() => {
    return [...todayJobs, ...upcomingJobs]
      .filter(
        (j) =>
          !j.weatherBrief &&
          j.fromAddress &&
          j.fromAddress.length >= 4 &&
          j.date,
      )
      .slice(0, 8)
      .map((j) => ({ id: j.id, fromAddress: j.fromAddress!, date: j.date }));
  }, [todayJobs, upcomingJobs]);

  useEffect(() => {
    if (weatherInput.length === 0) {
      setWeatherByMoveId({});
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    fetch("/api/admin/command-center-weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves: weatherInput }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("weather"))))
      .then(
        (d: {
          weather?: Record<
            string,
            { brief: MoveWeatherBrief; alert: string | null }
          >;
        }) => {
          if (!cancelled) setWeatherByMoveId(d.weather || {});
        },
      )
      .catch(() => {
        if (!cancelled) setWeatherByMoveId({});
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(weatherInput)]);

  const moveTrafficKey = useMemo(() => {
    const ids = new Set<string>();
    for (const j of [...todayJobs, ...upcomingJobs]) {
      if (j.type !== "move") continue;
      const f = j.fromAddress?.trim();
      const t = j.toAddress?.trim();
      if (f && t && f.length >= 4 && t.length >= 4) ids.add(j.id);
    }
    return [...ids].sort().slice(0, 12).join("|");
  }, [todayJobs, upcomingJobs]);

  useEffect(() => {
    if (!moveTrafficKey) {
      setTrafficByMoveId({});
      return;
    }
    const moveIds = moveTrafficKey.split("|").filter(Boolean);
    if (moveIds.length === 0) return;
    let cancelled = false;
    setTrafficLoading(true);
    fetch("/api/admin/command-center-traffic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveIds }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("traffic"))))
      .then((d: { traffic?: Record<string, DrivingTrafficBrief> }) => {
        if (!cancelled) setTrafficByMoveId(d.traffic || {});
      })
      .catch(() => {
        if (!cancelled) setTrafficByMoveId({});
      })
      .finally(() => {
        if (!cancelled) setTrafficLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moveTrafficKey]);

  const now = new Date();
  const hour = getLocalHourInAppTimezone(now);
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = formatDate(now, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const summaryParts: string[] = [];
  if (actionTasks.length > 0)
    summaryParts.push(
      `${actionTasks.length} task${actionTasks.length > 1 ? "s" : ""}`,
    );
  if (todayJobCount > 0)
    summaryParts.push(
      `${todayJobCount} job${todayJobCount > 1 ? "s" : ""} today`,
    );
  if (liveSessions.length > 0)
    summaryParts.push(
      `${liveSessions.length} crew${liveSessions.length > 1 ? "s" : ""} active`,
    );
  if (activeQuotesCount > 0)
    summaryParts.push(
      `${activeQuotesCount} open quote${activeQuotesCount > 1 ? "s" : ""}`,
    );

  const hasJobs = todayJobs.length > 0 || upcomingJobs.length > 0;
  const displayJobs = todayJobs.length > 0 ? todayJobs : upcomingJobs;
  const scheduleLabel =
    todayJobs.length > 0 ? "Today\u2019s Schedule" : "Upcoming";

  // Merge SSR weather_brief (from DB cron) + client-fetched weather (all job types)
  const allWeatherRows = useMemo(() => {
    const rows: {
      id: string;
      subtitle: string;
      date: string;
      brief: MoveWeatherBrief;
      alert: string | null;
    }[] = [];
    const seen = new Set<string>();
    for (const j of [...todayJobs, ...upcomingJobs]) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      const brief = j.weatherBrief || weatherByMoveId[j.id]?.brief || null;
      const alert = j.weatherAlert || weatherByMoveId[j.id]?.alert || null;
      if (brief) {
        rows.push({
          id: j.id,
          subtitle: j.subtitle,
          date: j.date,
          brief,
          alert: alert || buildPrecipAlertText(brief),
        });
      }
    }
    return rows
      .sort((a, b) => {
        if (a.date !== b.date)
          return (a.date || "").localeCompare(b.date || "");
        return a.subtitle.localeCompare(b.subtitle);
      })
      .slice(0, 12);
  }, [todayJobs, upcomingJobs, weatherByMoveId]);

  const trafficRows = useMemo(() => {
    const out: {
      id: string;
      subtitle: string;
      date: string;
      brief: DrivingTrafficBrief;
    }[] = [];
    for (const j of [...todayJobs, ...upcomingJobs]) {
      if (j.type !== "move") continue;
      const brief = trafficByMoveId[j.id];
      if (brief)
        out.push({ id: j.id, subtitle: j.subtitle, date: j.date, brief });
    }
    return out
      .sort((a, b) => {
        if (a.date !== b.date)
          return (a.date || "").localeCompare(b.date || "");
        return a.subtitle.localeCompare(b.subtitle);
      })
      .slice(0, 12);
  }, [todayJobs, upcomingJobs, trafficByMoveId]);

  return (
    <div
      ref={pullRef as React.RefObject<HTMLDivElement>}
      className="min-h-full w-full min-w-0 max-w-full"
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed left-1/2 z-[100] flex items-center justify-center w-9 h-9 rounded-sm border border-[var(--brd)] shadow-md"
          style={{
            top: "calc(var(--app-chrome-h) + env(safe-area-inset-top, 0px) + 8px)",
            transform: `translate(-50%, ${pullDistance}px)`,
            backgroundColor: "var(--card)",
            border: "1px solid var(--brd)",
          }}
          aria-live="polite"
        >
          {refreshing ? (
            <span className="spinner w-4 h-4" />
          ) : (
            <ArrowsClockwise
              size={15}
              color="var(--tx3)"
              style={{
                transform: `rotate(${(pullDistance / 72) * 180}deg)`,
                transition: "transform 0.1s",
              }}
              aria-hidden
            />
          )}
        </div>
      )}

      <div className="w-full min-w-0 py-5 sm:py-6 md:py-8 animate-fade-up">
        {/* ── Header ── */}
        <div className="mb-8 min-w-0">
          <div className="flex items-start justify-between gap-3 sm:gap-4 min-w-0 w-full">
            <div className="min-w-0 flex-1">
              <p className="t-label text-[var(--tx3)] mb-1.5">
                Command Center
              </p>
              <h1 className="admin-page-hero">{greeting}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--tx2)] [font-family:var(--font-body)] leading-snug">
                <span>{dateStr}</span>
                {hqWeatherLoading && (
                  <span
                    className="inline-block h-3 w-[9.5rem] max-w-[55vw] rounded bg-[var(--brd)]/45 animate-pulse"
                    aria-hidden
                  />
                )}
                {!hqWeatherLoading && hqWeather?.brief && (
                  <>
                    <span className="text-[var(--brd)] select-none" aria-hidden>
                      ·
                    </span>
                    <span
                      className="inline-flex items-center gap-1 min-w-0"
                      title={hqWeather.alert ?? undefined}
                    >
                      <CloudSun
                        size={14}
                        className="text-[var(--tx2)] shrink-0"
                        weight="duotone"
                        aria-hidden
                      />
                      <span className="truncate normal-case font-medium tracking-normal">
                        {formatAdminHeaderWeather(hqWeather.brief)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Quick Actions button */}
              <div className="relative" ref={quickActionsRef}>
                <button
                  type="button"
                  title="Quick Actions"
                  aria-label="Quick Actions"
                  onClick={() => setQuickActionsOpen((v) => !v)}
                  className={`${createButtonBaseClass} gap-1.5`}
                >
                  <Plus size={15} weight="regular" className="text-current" />
                </button>
                {quickActionsOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-[var(--card)] border border-[var(--brd)] rounded-sm shadow-2xl py-1.5 overflow-hidden">
                    <p className="admin-eyebrow px-4 pt-2 pb-1.5 opacity-90">
                      Create
                    </p>
                    {[
                      { href: "/admin/quotes/new", label: "New Quote" },
                      { href: "/admin/moves/new", label: "New Move" },
                      { href: "/admin/deliveries/new", label: "New Delivery" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setQuickActionsOpen(false)}
                        className="flex items-center px-4 py-2.5 text-[13px] font-semibold text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-[var(--brd)]/50 my-1" />
                    <p className="admin-eyebrow px-4 pt-1.5 pb-1.5 opacity-90">
                      Navigate
                    </p>
                    {[
                      { href: "/admin/deliveries", label: "Deliveries" },
                      { href: "/admin/reports", label: "Reports" },
                      { href: "/admin/calendar", label: "Calendar" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setQuickActionsOpen(false)}
                        className="flex items-center px-4 py-2.5 text-[13px] font-semibold text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Summary pills */}
          {summaryParts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {summaryParts.map((part) => (
                <span
                  key={part}
                  className="inline-flex items-center px-2.5 py-1 rounded-sm text-[11px] font-bold uppercase tracking-[0.06em] bg-[var(--card)] border border-[var(--brd)] text-[var(--tx2)]"
                >
                  {part}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Daily Brief ── */}
        {dailyBrief && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setBriefOpen((v) => !v)}
              className="flex items-center gap-2 group w-full text-left"
            >
              <span className="admin-eyebrow text-[var(--tx2)]">
                Daily Brief
              </span>
              <CaretRight
                weight="regular"
                className={`w-2.5 h-2.5 text-[var(--tx3)] transition-transform duration-200 ${briefOpen ? "rotate-90" : ""}`}
              />
            </button>
            {briefOpen && (
              <p className="text-[12px] text-[var(--tx2)] leading-relaxed mt-2 pl-[22px]">
                {dailyBrief}
              </p>
            )}
          </div>
        )}

        {/* ── Live Crew Banner (only when active) ── */}
        {liveSessionsError && (
          <div className="mb-3 text-[11px] text-[var(--tx3)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
            Live crew tracking unavailable — retrying
          </div>
        )}
        {liveSessions.length > 0 && (
          <div className="mb-6 flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-bold tracking-wide text-emerald-400">
                Live
              </span>
            </div>
            {liveSessions.map((s) => (
              <Link
                key={s.id}
                href={
                  s.jobType === "move"
                    ? `/admin/moves/${s.jobId}`
                    : `/admin/deliveries/${s.jobId}`
                }
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-sm border border-[var(--brd)] bg-[var(--hover)] hover:bg-[var(--card)] transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold text-[var(--tx)] whitespace-nowrap">
                  {s.teamName}
                </span>
                <span className="text-[10px] text-[var(--tx3)] whitespace-nowrap">
                  {CREW_STATUS_TO_LABEL[s.status] ||
                    s.status
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
                  · {formatRelative(s.updatedAt)}
                </span>
              </Link>
            ))}
            <Link
              href="/admin/crew"
              className="shrink-0 text-[10px] font-bold text-[var(--tx2)] hover:underline whitespace-nowrap"
            >
              View map &rarr;
            </Link>
          </div>
        )}

        {/* ── Two Column Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 min-w-0 w-full">
          {/* ── LEFT: Schedule ── */}
          <div className="min-w-0">
            {/* ── Unassigned Jobs Alert ── */}
            {unassignedJobs.length > 0 && (
              <div className="mb-6 rounded-sm border border-[var(--org)]/35 bg-[var(--org)]/[0.06] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--org)]/20">
                  <Warning
                    size={14}
                    className="text-[var(--org)]"
                    weight="duotone"
                    aria-hidden
                  />
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--org)]">
                    {unassignedJobs.length} unassigned job
                    {unassignedJobs.length > 1 ? "s" : ""} in the next 72h
                  </span>
                </div>
                <div className="divide-y divide-[var(--org)]/15">
                  {unassignedJobs.slice(0, 5).map((job) => (
                    <Link
                      key={`unassigned-${job.id}`}
                      href={job.href}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--org)]/[0.06] transition-colors"
                    >
                      <span className="text-[10px] font-medium text-[var(--tx3)] tabular-nums w-[52px] text-right shrink-0">
                        {formatMoveDate(job.date)}
                      </span>
                      <span
                        className={`text-[9px] font-bold capitalize ${job.type === "move" ? "text-[#3B82F6]/80" : "text-[var(--org)]/80"}`}
                      >
                        {job.type}
                      </span>
                      <span className="text-[12px] font-medium text-[var(--tx)] truncate flex-1">
                        {job.name}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--tx3)]">
                        {job.code}
                      </span>
                    </Link>
                  ))}
                </div>
                {unassignedJobs.length > 5 && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center py-2 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors border-t border-amber-500/10"
                  >
                    View all {unassignedJobs.length} unassigned &rarr;
                  </Link>
                )}
              </div>
            )}

            {/* ── Action Tasks (collapsible) ── */}
            {actionTasks.length > 0 && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setTasksOpen((v) => !v)}
                  className="flex items-center justify-between w-full min-w-0 mb-3 group"
                >
                  <div className="flex items-center gap-2">
                    <CaretRight
                      weight="regular"
                      className={`w-3 h-3 text-[var(--tx3)] transition-transform duration-200 ${tasksOpen ? "rotate-90" : ""}`}
                    />
                    <h2 className="admin-section-h2 text-[var(--tx2)] group-hover:text-[var(--tx)] transition-colors">
                      Tasks
                    </h2>
                    <span className="text-[9px] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded-sm bg-[var(--hover)] text-[var(--tx)] border border-[var(--brd)]/60">
                      {actionTasks.length}
                    </span>
                  </div>
                </button>
                {tasksOpen && (
                  <div className="rounded-sm border border-[var(--brd)] bg-[var(--card)] divide-y divide-[var(--brd)]/30 overflow-hidden">
                    {actionTasks
                      .slice(0, showAllTasks ? undefined : 5)
                      .map((task) => (
                        <Link
                          key={`task-${task.id}`}
                          href={task.href}
                          className="group flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--hover)] active:bg-[var(--card)] transition-colors touch-manipulation"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-[var(--tx)] leading-snug">
                              {task.title}
                            </div>
                            {task.subtitle && (
                              <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                                {task.subtitle}
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] text-[var(--tx3)] shrink-0 mt-1">
                            {formatActivityTime(task.createdAt)}
                          </span>
                        </Link>
                      ))}
                    {actionTasks.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllTasks((v) => !v)}
                        className="admin-view-all-link w-full justify-center py-3 hover:bg-[var(--hover)] rounded-none"
                      >
                        {showAllTasks
                          ? "Show less"
                          : `View all ${actionTasks.length} tasks`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mb-4 min-w-0 w-full">
              <h2 className="admin-section-h2 min-w-0 flex-1 basis-0 pr-1">
                {scheduleLabel}
              </h2>
              <Link
                href="/admin/calendar"
                className="admin-view-all-link shrink-0 gap-1 whitespace-nowrap"
              >
                Calendar
                <CaretRight
                  weight="regular"
                  className="w-3 h-3 -mr-0.5 text-current opacity-80"
                  aria-hidden
                />
              </Link>
            </div>

            {hasJobs ? (
              <div className="divide-y divide-[var(--brd)]/30">
                {displayJobs.map((job) => {
                  const lineColor = getJobLineColor(job);
                  const statusStyle = getJobStatusStyle(job);
                  const statusLabel = getJobStatusLabel(job);
                  const tagColor = TAG_COLORS[job.tag] || "text-[var(--tx3)]";
                  const showDate = todayJobs.length === 0;

                  return (
                    <Link
                      key={`${job.type}-${job.id}`}
                      href={getJobHref(job)}
                      className="group flex items-start gap-3 py-4 px-1 hover:bg-[var(--card)]/40 active:bg-[var(--card)]/60 transition-colors touch-manipulation"
                    >
                      {/* Time / Date column */}
                      <div className="shrink-0 w-[52px] pt-0.5 text-right">
                        {showDate ? (
                          <span className="text-[12px] font-semibold text-[var(--tx2)] tabular-nums">
                            {job.date ? formatMoveDate(job.date) : "TBD"}
                          </span>
                        ) : (
                          <span className="text-[12px] font-semibold text-[var(--tx2)] tabular-nums">
                            {job.time}
                          </span>
                        )}
                      </div>

                      {/* Status line */}
                      <div
                        className="w-[3px] rounded-full shrink-0 self-stretch min-h-[44px]"
                        style={{ backgroundColor: lineColor }}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span
                            className={`dt-badge tracking-[0.04em] ${statusStyle}`}
                          >
                            {statusLabel}
                          </span>
                          {job.type === "move" && job.tier_selected ? (
                            <TierLetterBadge
                              tier={job.tier_selected}
                              label={residentialTierFullLabel(job.tier_selected)}
                            />
                          ) : null}
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide ${tagColor}`}
                          >
                            {job.tag}
                          </span>
                        </div>
                        <div className="text-[var(--text-base)] font-bold text-[var(--tx)] leading-snug">
                          {job.name}
                        </div>
                        {job.subtitle && (
                          <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate font-mono tabular-nums">
                            {job.subtitle}
                          </div>
                        )}
                        {job.weatherAlert && (
                          <div className="flex items-start gap-1.5 mt-1.5 text-[10px] text-sky-400/90 leading-snug">
                            <CloudRain
                              size={14}
                              className="shrink-0 mt-0.5"
                              weight="duotone"
                              aria-hidden
                            />
                            <span>{job.weatherAlert}</span>
                          </div>
                        )}
                      </div>

                      {/* Arrow, always visible on mobile, hover-only on desktop */}
                      <CaretRight
                        weight="regular"
                        className="shrink-0 w-4 h-4 text-[var(--tx3)]/40 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-3"
                      />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center min-w-0 px-0">
                <div className="text-[var(--text-base)] font-semibold text-[var(--tx)] mb-1">
                  No jobs scheduled
                </div>
                <p className="text-[12px] text-[var(--tx3)] mb-4 px-1">
                  Get started by creating a quote or checking the calendar.
                </p>
                <div className={ADMIN_DASH_CTA_ROW}>
                  <Link
                    href="/admin/quotes/new"
                    className="admin-btn admin-btn-primary"
                  >
                    Create a quote
                  </Link>
                  <Link
                    href="/admin/calendar"
                    className="admin-btn admin-btn-ghost text-[var(--tx2)] hover:text-[var(--tx)]"
                  >
                    View calendar
                  </Link>
                </div>
              </div>
            )}

            {/* Upcoming preview (when showing today) */}
            {todayJobs.length > 0 && upcomingJobs.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[var(--brd)]/30">
                <div className="flex items-center justify-between gap-2 mb-3 min-w-0 w-full">
                  <h3 className="text-[10px] font-bold tracking-wide text-[var(--tx3)] min-w-0 flex-1 basis-0 truncate pr-1">
                    Coming up
                  </h3>
                  <Link
                    href="/admin/deliveries"
                    className="admin-view-all-link shrink-0 whitespace-nowrap"
                  >
                    All
                  </Link>
                </div>
                <div className="divide-y divide-[var(--brd)]/30">
                  {upcomingJobs.slice(0, 5).map((job) => {
                    const upTagColor =
                      TAG_COLORS[job.tag] ||
                      TAG_COLORS[job.tag?.toLowerCase()] ||
                      "text-[var(--tx3)]";
                    return (
                      <Link
                        key={`up-${job.type}-${job.id}`}
                        href={getJobHref(job)}
                        className="flex items-center gap-3 py-2.5 px-1 hover:bg-[var(--card)]/30 transition-colors"
                      >
                        <span className="text-[11px] font-medium text-[var(--tx3)] tabular-nums w-[52px] text-right shrink-0">
                          {job.date ? formatMoveDate(job.date) : "TBD"}
                        </span>
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getJobLineColor(job) }}
                        />
                        <span className="text-[12px] font-medium text-[var(--tx)] truncate flex-1">
                          {job.name}
                        </span>
                        {job.type === "move" && job.tier_selected ? (
                          <TierLetterBadge
                            tier={job.tier_selected}
                            label={residentialTierFullLabel(job.tier_selected)}
                            className="shrink-0"
                          />
                        ) : null}
                        <span
                          className={`text-[9px] font-semibold capitalize ${upTagColor}`}
                        >
                          {job.tag}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Weather & Route Conditions ── */}
            {hasJobs && (
              <div className="mt-6 pt-5 border-t border-[var(--brd)]/30">
                <div className="flex items-center gap-2 mb-4 min-w-0 w-full">
                  <CloudRain
                    size={14}
                    className="text-sky-400/80 shrink-0"
                    weight="duotone"
                    aria-hidden
                  />
                  <h2 className="admin-section-h2 min-w-0 flex-1 leading-snug">
                    Weather &amp; Route Conditions
                  </h2>
                </div>

                {(weatherLoading || trafficLoading) &&
                  allWeatherRows.length === 0 &&
                  trafficRows.length === 0 && (
                    <p className="text-[11px] text-[var(--tx3)] mb-3">
                      Loading conditions…
                    </p>
                  )}

                {(allWeatherRows.length > 0 || trafficRows.length > 0) && (
                  <div className="space-y-3">
                    {allWeatherRows.map(
                      ({ id, subtitle, date, brief: b, alert }) => {
                        const popPct =
                          b.precipProbabilityMax != null
                            ? Math.round(b.precipProbabilityMax * 100)
                            : null;
                        const tr = trafficRows.find((r) => r.id === id);
                        return (
                          <div
                            key={`wx-${id}`}
                            className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <span className="text-[11px] font-bold text-[var(--tx)] font-mono tracking-wide">
                                {subtitle}
                              </span>
                              <span className="text-[10px] text-[var(--tx3)]">
                                {date ? formatMoveDate(date) : ""}
                              </span>
                            </div>

                            {alert && (
                              <div className="mb-2 flex gap-1.5 rounded-lg border border-sky-500/15 bg-sky-500/[0.06] px-2.5 py-1.5">
                                <CloudRain
                                  size={12}
                                  className="text-sky-400 shrink-0 mt-0.5"
                                  weight="duotone"
                                  aria-hidden
                                />
                                <p className="text-[10px] text-[var(--tx2)] leading-snug">
                                  {alert}
                                </p>
                              </div>
                            )}

                            <p className="text-[10px] text-[var(--tx2)] capitalize">
                              {b.conditionsSummary}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-[var(--tx2)]">
                              <span className="inline-flex items-center gap-1">
                                <Thermometer
                                  size={12}
                                  className="text-orange-300/90 shrink-0"
                                  aria-hidden
                                />
                                {b.tempLowC}°–{b.tempHighC}°C
                                {b.feelsLikeAvgC != null && (
                                  <span className="text-[var(--tx3)]">
                                    (feels ~{b.feelsLikeAvgC}°)
                                  </span>
                                )}
                              </span>
                              {b.windMaxKmh != null && (
                                <span className="inline-flex items-center gap-1">
                                  <Wind
                                    size={12}
                                    className="text-sky-300/80 shrink-0"
                                    aria-hidden
                                  />
                                  {b.windMaxKmh} km/h
                                  {b.windGustMaxKmh != null &&
                                    b.windGustMaxKmh > b.windMaxKmh && (
                                      <span className="text-[var(--tx3)]">
                                        gusts {b.windGustMaxKmh}
                                      </span>
                                    )}
                                </span>
                              )}
                              {popPct != null && (
                                <span className="inline-flex items-center gap-1">
                                  <Drop
                                    size={12}
                                    className="text-sky-400/70 shrink-0"
                                    aria-hidden
                                  />
                                  {popPct}% rain
                                </span>
                              )}
                              {b.humidityAvg != null && (
                                <span className="text-[var(--tx3)]">
                                  Humidity ~{b.humidityAvg}%
                                </span>
                              )}
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-[var(--brd)]/25 flex gap-1.5">
                              <Car
                                size={12}
                                className="text-[var(--tx2)] shrink-0 mt-0.5"
                                weight="duotone"
                                aria-hidden
                              />
                              <p className="text-[10px] text-[var(--tx2)] leading-snug">
                                {b.roadConditionsNote}
                              </p>
                            </div>

                            {tr && (
                              <div className="mt-2 pt-1.5 border-t border-[var(--brd)]/25">
                                <div className="flex gap-1.5">
                                  <Car
                                    size={12}
                                    className="text-[var(--tx2)] shrink-0 mt-0.5"
                                    weight="duotone"
                                    aria-hidden
                                  />
                                  <div className="text-[10px] text-[var(--tx2)] leading-snug space-y-0.5">
                                    <p>
                                      {tr.brief.distanceKm} km · ~
                                      {tr.brief.durationTrafficMin} min
                                      {tr.brief.trafficDelayMin >= 3 && (
                                        <span className="text-amber-300">
                                          {" "}
                                          (+{tr.brief.trafficDelayMin} min
                                          delay)
                                        </span>
                                      )}
                                      {tr.brief.congestionSummary ===
                                        "heavy" && (
                                        <span className="text-[var(--red)]">
                                          {" "}
                                          · Heavy traffic
                                        </span>
                                      )}
                                      {tr.brief.congestionSummary ===
                                        "mixed" && (
                                        <span className="text-amber-300">
                                          {" "}
                                          · Moderate traffic
                                        </span>
                                      )}
                                      {tr.brief.congestionSummary ===
                                        "light" && (
                                        <span className="text-[var(--grn)]">
                                          {" "}
                                          · Light traffic
                                        </span>
                                      )}
                                    </p>
                                    {tr.brief.closureNotes.length > 0 && (
                                      <ul className="pl-3 list-disc text-[9px] text-[var(--org)] space-y-0.5 opacity-95">
                                        {tr.brief.closureNotes.map(
                                          (note, i) => (
                                            <li key={i}>{note}</li>
                                          ),
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}

                    {/* Traffic-only rows (moves with route data but no weather) */}
                    {trafficRows
                      .filter((r) => !allWeatherRows.some((w) => w.id === r.id))
                      .map((row) => (
                        <div
                          key={`tr-${row.id}`}
                          className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <span className="text-[11px] font-bold text-[var(--tx)] font-mono tracking-wide">
                              {row.subtitle}
                            </span>
                            <span className="text-[10px] text-[var(--tx3)]">
                              {row.date ? formatMoveDate(row.date) : ""}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            <Car
                              size={12}
                              className="text-[var(--tx2)] shrink-0 mt-0.5"
                              weight="duotone"
                              aria-hidden
                            />
                            <div className="text-[10px] text-[var(--tx2)] leading-snug space-y-0.5">
                              <p>
                                {row.brief.distanceKm} km · ~
                                {row.brief.durationTrafficMin} min
                                {row.brief.trafficDelayMin >= 3 && (
                                  <span className="text-amber-300">
                                    {" "}
                                    (+{row.brief.trafficDelayMin} min delay)
                                  </span>
                                )}
                                {row.brief.congestionSummary === "heavy" && (
                                  <span className="text-[var(--red)]">
                                    {" "}
                                    · Heavy traffic
                                  </span>
                                )}
                                {row.brief.congestionSummary === "mixed" && (
                                  <span className="text-amber-300">
                                    {" "}
                                    · Moderate traffic
                                  </span>
                                )}
                                {row.brief.congestionSummary === "light" && (
                                  <span className="text-[var(--grn)]">
                                    {" "}
                                    · Light traffic
                                  </span>
                                )}
                              </p>
                              {row.brief.closureNotes.length > 0 && (
                                <ul className="pl-3 list-disc text-[9px] text-[var(--org)] space-y-0.5 opacity-95">
                                  {row.brief.closureNotes.map((note, i) => (
                                    <li key={i}>{note}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {allWeatherRows.length === 0 &&
                  trafficRows.length === 0 &&
                  !weatherLoading &&
                  !trafficLoading && (
                    <p className="text-[11px] text-[var(--tx2)] leading-relaxed">
                      Forecasts and route conditions appear when jobs have
                      pickup addresses. Ensure moves have a street address for
                      the best intel.
                    </p>
                  )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Intelligence Column ── */}
          <div className="min-w-0 space-y-0">
            {/* Today's Earnings */}
            {todayEarnings.jobCount > 0 && (
              <div className="pb-6">
                <div className="flex items-center gap-2 mb-3 min-w-0 w-full">
                  <CurrencyDollar
                    size={14}
                    className="text-[var(--grn)] shrink-0"
                    weight="duotone"
                    aria-hidden
                  />
                  <h2 className="admin-section-h2 min-w-0 flex-1">
                    Today&apos;s Earnings
                  </h2>
                </div>
                <div className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] p-4">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-[22px] font-bold font-heading text-[var(--tx)] tabular-nums">
                      {formatCurrency(todayEarnings.potential)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--tx2)]">
                      potential
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-sm bg-[var(--brd)]/35 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{
                        width: `${todayEarnings.potential > 0 ? Math.round((todayEarnings.collected / todayEarnings.potential) * 100) : 0}%`,
                        background: "var(--grn)",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5 text-[var(--grn)]">
                      <CheckCircle size={11} weight="duotone" aria-hidden />
                      {formatCurrency(todayEarnings.collected)} collected
                    </span>
                    <span className="flex items-center gap-1.5 text-[var(--tx2)]">
                      <Clock size={11} weight="duotone" aria-hidden />
                      {formatCurrency(todayEarnings.pending)} pending
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Revenue (multi-source) */}
            <div className="pb-6">
              <div className="flex items-center justify-between gap-2 mb-3 min-w-0 w-full">
                <h2 className="admin-section-h2 min-w-0 flex-1 basis-0 pr-1">
                  Revenue
                </h2>
                <Link
                  href="/admin/revenue"
                  className="admin-view-all-link shrink-0 gap-1 whitespace-nowrap"
                >
                  Details
                  <CaretRight
                    weight="regular"
                    className="w-3 h-3 -mr-0.5 text-current opacity-80"
                    aria-hidden
                  />
                </Link>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[24px] font-bold font-heading text-[var(--tx)] tabular-nums">
                  {currentMonthRevenue >= 1000
                    ? `$${(currentMonthRevenue / 1000).toFixed(1)}K`
                    : formatCurrency(currentMonthRevenue)}
                </span>
                {(currentMonthRevenue > 0 || revenuePctChange !== 0) && (
                  <span
                    className={`text-[11px] font-semibold ${revenuePctChange >= 0 ? "text-[var(--grn)]" : "text-[var(--red)]"}`}
                  >
                    {revenuePctChange >= 0 ? "\u2191" : "\u2193"}
                    {Math.abs(revenuePctChange)}%
                  </span>
                )}
              </div>
              {currentMonthRevenue > 0 && (
                <div className="text-[9px] font-medium text-[var(--tx2)] mb-1">
                  Before HST (13%)
                </div>
              )}

              {/* Breakdown pills */}
              {currentMonthRevenue > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                  {revenueBreakdown.moves > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-medium text-[var(--tx2)]">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--org)" }}
                      />
                      Moves {formatCompactCurrency(revenueBreakdown.moves)}
                    </span>
                  )}
                  {revenueBreakdown.partner > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-medium text-[var(--tx2)]">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "#3B82F6" }}
                      />
                      Partner (B2B){" "}
                      {formatCompactCurrency(revenueBreakdown.partner)}
                    </span>
                  )}
                </div>
              )}

              {/* Stacked bar chart */}
              <div className="flex items-end gap-[3px] h-[56px] w-full min-w-0">
                {(monthlyRevenue.length > 0
                  ? monthlyRevenue
                  : ([{ m: "\u2014", moves: 0, partner: 0 }] as MonthRevenue[])
                ).map((d, i) => {
                  const total = d.moves + d.partner;
                  const maxV = Math.max(
                    1,
                    ...monthlyRevenue.map((x) => x.moves + x.partner),
                  );
                  const pct = Math.round((total / maxV) * 100);
                  const isNow =
                    monthlyRevenue.length > 0 &&
                    i === monthlyRevenue.length - 1;
                  const movePct = total > 0 ? (d.moves / total) * 100 : 0;
                  const partnerPct = total > 0 ? (d.partner / total) * 100 : 0;

                  return (
                    <div
                      key={`${d.m}-${i}`}
                      className="flex-1 min-w-0 flex flex-col items-center gap-0.5 h-full group relative"
                    >
                      <div className="flex-1 w-full flex items-end">
                        <div
                          className="w-full rounded-t overflow-hidden min-h-[2px] transition-all duration-300 flex flex-col-reverse"
                          style={{ height: `${Math.max(pct, 6)}%` }}
                        >
                          {partnerPct > 0 && (
                            <div
                              style={{
                                height: `${partnerPct}%`,
                                background: isNow
                                  ? "#3B82F6"
                                  : "rgba(59,130,246,0.25)",
                              }}
                            />
                          )}
                          {movePct > 0 && (
                            <div
                              style={{
                                height: `${movePct}%`,
                                background: isNow
                                  ? "var(--org)"
                                  : "rgba(212, 138, 41, 0.22)",
                              }}
                            />
                          )}
                          {total === 0 && (
                            <div
                              className="w-full h-full"
                              style={{ background: "rgba(255,255,255,0.04)" }}
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-semibold tabular-nums ${isNow ? "text-[var(--tx)]" : "text-[var(--tx2)]"}`}
                      >
                        {d.m}
                      </span>

                      {/* Tooltip */}
                      {total > 0 && (
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                          <p className="text-[9px] font-bold text-[var(--tx)] mb-0.5">
                            {d.m} ${total.toFixed(1)}K
                          </p>
                          {d.moves > 0 && (
                            <p className="text-[8px] text-[var(--org)]">
                              Moves ${d.moves.toFixed(1)}K
                            </p>
                          )}
                          {d.partner > 0 && (
                            <p className="text-[8px] text-[#3B82F6]">
                              Partner (B2B) ${d.partner.toFixed(1)}K
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overdue (conditional), keep as alert banner */}
            {overdueAmount > 0 && (
              <div className="pt-6 border-t border-[var(--brd)]/30">
                <Link
                  href="/admin/invoices"
                  className="group flex items-center justify-between gap-2 py-3 px-4 rounded-sm border border-[var(--red)]/15 bg-[var(--red)]/5 hover:bg-[var(--red)]/10 hover:border-[var(--red)]/30 transition-all cursor-pointer min-w-0 w-full"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-wide text-[var(--red)]/80">
                      Overdue
                    </div>
                    <div className="text-[18px] font-bold text-[var(--red)] tabular-nums group-hover:opacity-80 transition-opacity">
                      {formatCompactCurrency(overdueAmount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[var(--tx3)]">
                      {overdueCount} invoice{overdueCount > 1 ? "s" : ""}
                    </span>
                    <ArrowUpRight
                      weight="regular"
                      className="w-3.5 h-3.5 text-[var(--red)]/30 group-hover:text-[var(--red)]/70 transition-colors"
                    />
                  </div>
                </Link>
              </div>
            )}

            {/* Crew Capacity */}
            {crewCapacity.length > 0 && crewCapacity[0].total > 0 && (
              <div className="pt-6 border-t border-[var(--brd)]/30">
                <div className="flex items-center justify-between gap-2 mb-3 min-w-0 w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <UsersThree
                      size={14}
                      className="text-[var(--tx2)] shrink-0"
                      weight="duotone"
                      aria-hidden
                    />
                    <h2 className="admin-section-h2 min-w-0">Crew Capacity</h2>
                  </div>
                  <Link
                    href="/admin"
                    className="admin-view-all-link shrink-0 gap-1 whitespace-nowrap"
                  >
                    Dispatch
                    <CaretRight
                      weight="regular"
                      className="w-3 h-3 -mr-0.5 text-current opacity-80"
                      aria-hidden
                    />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2 w-full min-w-0">
                  {crewCapacity.map((day) => {
                    const free = day.total - day.booked;
                    const pct = Math.round((day.booked / day.total) * 100);
                    const isFull = free === 0;
                    return (
                      <div
                        key={day.date}
                        className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] px-3 py-3 text-center"
                      >
                        <div className="text-[9px] font-bold tracking-wide text-[var(--tx3)] mb-2">
                          {day.label}
                        </div>
                        <div className="relative w-10 h-10 mx-auto mb-2">
                          <svg
                            viewBox="0 0 36 36"
                            className="w-10 h-10 -rotate-90"
                          >
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="var(--brd)"
                              strokeWidth="3"
                              opacity="0.3"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke={
                                isFull
                                  ? "var(--red)"
                                  : pct >= 60
                                    ? "var(--org)"
                                    : "var(--grn)"
                              }
                              strokeWidth="3"
                              strokeDasharray={`${pct * 0.942} 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[var(--tx)] tabular-nums">
                            {day.booked}/{day.total}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] font-semibold ${isFull ? "text-[var(--red)]" : "text-[var(--grn)]"}`}
                        >
                          {isFull ? "Full" : `${free} available`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leads (speed to lead) */}
            {leadPulse &&
              (leadPulse.needsAttention > 0 ||
                leadPulse.monthReceived > 0 ||
                leadPulse.avgResponseMin != null) && (
                <div className="pt-6 border-t border-[var(--brd)]/30">
                  <div className="flex items-center justify-between gap-2 mb-3 min-w-0 w-full">
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                      <h2 className="admin-section-h2 min-w-0 mb-0">Leads</h2>
                      <SpeedToLeadHint
                        iconSize={15}
                        ariaLabel="Speed to lead"
                      />
                    </div>
                    <Link
                      href="/admin/leads"
                      className="admin-view-all-link shrink-0 gap-1 whitespace-nowrap"
                    >
                      Open
                      <CaretRight
                        weight="regular"
                        className="w-3 h-3 -mr-0.5 text-current opacity-80"
                        aria-hidden
                      />
                    </Link>
                  </div>
                  <div className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--tx3)]">Needs attention</span>
                      <span
                        className={`font-bold tabular-nums ${leadPulse.needsAttention > 0 ? "text-amber-400" : "text-[var(--tx)]"}`}
                      >
                        {leadPulse.needsAttention}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--tx3)]">
                        This month (new)
                      </span>
                      <span className="font-bold text-[var(--tx)] tabular-nums">
                        {leadPulse.monthReceived}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--tx3)]">
                        Avg response (min)
                      </span>
                      <span className="font-bold text-[var(--tx)] tabular-nums">
                        {leadPulse.avgResponseMin != null
                          ? leadPulse.avgResponseMin
                          : "0"}
                      </span>
                    </div>
                    {(leadPulse.attentionPreview?.length ?? 0) > 0 && (
                      <ul className="pt-2 mt-2 border-t border-[var(--brd)]/40 space-y-2">
                        {leadPulse.attentionPreview!.map((row) => {
                          const path = row.completeness_path || "manual_review";
                          const PathIcon =
                            path === "auto_quote"
                              ? CheckCircle
                              : path === "needs_info"
                                ? WarningCircle
                                : XCircle;
                          const pathColor =
                            path === "auto_quote"
                              ? "text-emerald-500"
                              : path === "needs_info"
                                ? "text-amber-400"
                                : "text-red-400";
                          const nm =
                            [row.first_name, row.last_name]
                              .filter(Boolean)
                              .join(" ") || "Unknown";
                          const sec = Math.max(
                            0,
                            Math.floor(
                              (Date.now() -
                                new Date(row.created_at).getTime()) /
                                1000,
                            ),
                          );
                          const m = Math.floor(sec / 60);
                          const timer =
                            m >= 60
                              ? `${Math.floor(m / 60)}h ${m % 60}m`
                              : `${m}m`;
                          return (
                            <li key={row.id}>
                              <Link
                                href={`/admin/leads/${row.id}`}
                                className="flex items-start gap-2 rounded-lg p-2 -mx-2 hover:bg-[var(--gdim)]/50 text-left"
                              >
                                <PathIcon
                                  className={`w-4 h-4 shrink-0 mt-0.5 ${pathColor}`}
                                  weight="fill"
                                  aria-hidden
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                    <Clock
                                      className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0"
                                      aria-hidden
                                    />
                                    <span className="font-mono tabular-nums text-[var(--tx2)]">
                                      {timer}
                                    </span>
                                    <span className="font-semibold text-[var(--tx)] truncate">
                                      {row.lead_number} · {nm}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                                    {COMPLETENESS_PATH_LABELS[path] || path}
                                    {row.service_type
                                      ? ` · ${serviceTypeDisplayLabel(row.service_type)}`
                                      : ""}
                                  </p>
                                  {row.follow_up_sent_at ? (
                                    <p className="text-[10px] text-amber-400/90 mt-0.5">
                                      Follow-up sent{" "}
                                      {formatRelative(row.follow_up_sent_at)}
                                    </p>
                                  ) : null}
                                </div>
                                <CaretRight
                                  className="w-3.5 h-3.5 text-[var(--tx3)] shrink-0 mt-1"
                                  aria-hidden
                                />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

            {/* Quote Pipeline */}
            {(quotePipeline.openCount > 0 ||
              quotePipeline.acceptedThisWeek > 0) && (
              <div className="pt-6 border-t border-[var(--brd)]/30">
                <div className="flex items-center justify-between gap-2 mb-3 min-w-0 w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Funnel
                      size={14}
                      className="text-[var(--tx2)] shrink-0"
                      weight="duotone"
                      aria-hidden
                    />
                    <h2 className="admin-section-h2 min-w-0">Quote Pipeline</h2>
                  </div>
                  <Link
                    href="/admin/quotes"
                    className="admin-view-all-link shrink-0 gap-1 whitespace-nowrap"
                  >
                    Quotes
                    <CaretRight
                      weight="regular"
                      className="w-3 h-3 -mr-0.5 text-current opacity-80"
                      aria-hidden
                    />
                  </Link>
                </div>
                <div className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] p-4 space-y-3">
                  {/* Funnel rows */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--org)]" />
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Open quotes
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums">
                          {quotePipeline.openCount}
                        </span>
                        {quotePipeline.openValue > 0 && (
                          <span className="text-[10px] text-[var(--tx3)] tabular-nums">
                            {formatCompactCurrency(quotePipeline.openValue)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye size={10} className="text-[#3B82F6]" aria-hidden />
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Viewed
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums">
                        {quotePipeline.viewedCount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle
                          size={10}
                          className="text-[var(--grn)]"
                          weight="duotone"
                          aria-hidden
                        />
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Accepted this week
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[var(--grn)] tabular-nums">
                        {quotePipeline.acceptedThisWeek}
                      </span>
                    </div>
                  </div>

                  {/* Divider + stats */}
                  <div className="border-t border-[var(--brd)]/30 pt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-[var(--tx3)]">
                      30-day conversion
                    </span>
                    <span className="text-[12px] font-bold text-[var(--tx)] tabular-nums">
                      {quotePipeline.conversionRate}%
                    </span>
                  </div>

                  {quotePipeline.expiringToday > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-2.5 py-1.5">
                      <Clock
                        size={11}
                        className="text-amber-400 shrink-0"
                        weight="duotone"
                        aria-hidden
                      />
                      <span className="text-[10px] text-amber-300 font-medium">
                        {quotePipeline.expiringToday} quote
                        {quotePipeline.expiringToday > 1 ? "s" : ""} expiring
                        today
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Revenue Forecast */}
            <div className="pt-6 border-t border-[var(--brd)]/30">
              <RevenueForecastWidget />
            </div>

            {/* Customer Satisfaction */}
            {satisfaction.count > 0 && (
              <div className="pt-6 border-t border-[var(--brd)]/30">
                <div className="flex items-center gap-2 mb-3 min-w-0 w-full">
                  <Star
                    size={14}
                    className="text-amber-400/90 shrink-0"
                    weight="duotone"
                    aria-hidden
                  />
                  <h2 className="admin-section-h2 min-w-0 flex-1">
                    Customer Satisfaction
                  </h2>
                </div>
                <div className="rounded-sm border border-[var(--brd)]/40 bg-[var(--card)] p-4 min-w-0">
                  <div className="flex items-center gap-4 mb-3 min-w-0 w-full">
                    <div className="text-center shrink-0">
                      <div className="text-[28px] font-bold font-heading text-[var(--tx)] tabular-nums leading-none">
                        {satisfaction.avgRating.toFixed(1)}
                      </div>
                      <div className="flex items-center gap-0.5 mt-1 justify-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={10}
                            weight={
                              s <= Math.round(satisfaction.avgRating)
                                ? "fill"
                                : "regular"
                            }
                            className={
                              s <= Math.round(satisfaction.avgRating)
                                ? "text-amber-400"
                                : "text-[var(--tx3)]/30"
                            }
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[10px] min-w-0">
                        <span className="text-[var(--tx3)] truncate">
                          Recent reviews
                        </span>
                        <span className="font-bold text-[var(--tx)] tabular-nums">
                          {satisfaction.count}
                        </span>
                      </div>
                      {satisfaction.pendingReviews > 0 && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[var(--tx3)]">
                            Awaiting response
                          </span>
                          <span className="font-bold text-amber-400 tabular-nums">
                            {satisfaction.pendingReviews}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[var(--tx3)]">Rating</span>
                        <span
                          className={`font-bold tabular-nums ${satisfaction.avgRating >= 4.5 ? "text-[var(--grn)]" : satisfaction.avgRating >= 3.5 ? "text-[var(--org)]" : "text-[var(--red)]"}`}
                        >
                          {satisfaction.avgRating >= 4.5
                            ? "Excellent"
                            : satisfaction.avgRating >= 3.5
                              ? "Good"
                              : "Needs attention"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Activity, live feed */}
            <LiveActivityFeed initialEvents={activityEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}
