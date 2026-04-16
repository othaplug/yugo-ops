"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  CaretLeft,
  CaretRight,
  ChartBar,
  Check,
} from "@phosphor-icons/react";
import YugoLogo from "@/components/YugoLogo";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/client-timezone";
import { getPartnerGreeting } from "@/lib/partner-type";
import { WINE } from "@/app/quote/[quoteId]/quote-shared";
import PartnerChangePasswordGate from "./PartnerChangePasswordGate";
import PartnerSettingsPanel from "./PartnerSettingsPanel";
import {
  PartnerNotificationProvider,
  usePartnerNotifications,
} from "./PartnerNotificationContext";
import { useToast } from "@/app/admin/components/Toast";
import {
  PartnerPmOverview,
  PartnerPmBuildingsTab,
  PartnerPmProjectsTab,
  PmPortalKpiStrip,
  type PmTabId,
} from "@/components/partner/pm/PartnerPmPortalViews";
import { COMMERCIAL_ONLY_PM_REASON_CODES, isCommercialPmVertical, PM_PRIMARY_REASON_CODES_ORDERED } from "@/lib/partners/pm-portal-move-types";
import { PartnerPmAnalyticsTab } from "@/components/partner/pm/PartnerPmAnalyticsTab";
import { PartnerPmStatementsTab } from "@/components/partner/pm/PartnerPmStatementsTab";
import { PartnerPmCalendarTab } from "@/components/partner/pm/PartnerPmCalendarTab";
import PartnerLiveMapTab from "@/app/partner/tabs/PartnerLiveMapTab";
import { InfoHint } from "@/components/ui/InfoHint";
import { PartnerPortalWelcomeTour } from "@/components/partner/PartnerPortalWelcomeTour";
import { partnerWineAccountButtonClass } from "@/components/partner/PartnerChrome";
import {
  pmLabelCaps,
  pmPageSubtitle,
  pmPageTitle,
  pmPortalEyebrow,
} from "@/components/partner/pm/pm-typography";

type MoveReason = {
  reason_code: string;
  label: string;
  description?: string | null;
  is_round_trip: boolean;
  default_origin: string;
  default_destination: string;
  requires_return_move: boolean;
  urgency_default: string;
};

type ContractAddon = {
  id: string;
  addon_code: string;
  label: string;
  price: number;
  price_type: string;
};

export type PmProjectRow = {
  id: string;
  project_name: string;
  project_type: string;
  total_units: number | null;
  tracked_units?: number;
  status: string;
};

export type PmPortalSummary = {
  org: { name?: string | null; vertical?: string | null };
  contract: {
    id: string;
    contract_number: string;
    contract_type: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
  properties: {
    id: string;
    building_name: string;
    address: string;
    total_units: number | null;
    service_region?: string | null;
  }[];
  stats: {
    propertiesCount: number;
    totalUnits: number;
    movesThisMonth: number;
    movesCompletedThisMonth: number;
    revenueThisMonth: number;
    upcomingScheduledCount?: number;
  };
  upcomingMoves: {
    id: string;
    move_code: string | null;
    scheduled_date: string | null;
    scheduled_time?: string | null;
    unit_number: string | null;
    tenant_name: string | null;
    status: string | null;
    building_name: string | null;
    move_type_label: string | null;
    tracking_url?: string | null;
  }[];
  todaysMoves?: {
    id: string;
    move_code: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    unit_number: string | null;
    tenant_name: string | null;
    status: string | null;
    building_name: string | null;
    move_type_label: string | null;
    tracking_url: string;
  }[];
  weekMovesByDate?: Record<
    string,
    {
      id: string;
      move_code: string | null;
      unit_number: string | null;
      tenant_name: string | null;
      building_name: string | null;
      scheduled_time: string | null;
      status: string | null;
    }[]
  >;
  activeProjectsCount?: number;
  recentCompleted?: {
    id: string;
    move_code: string | null;
    scheduled_date: string | null;
    unit_number: string | null;
    tenant_name: string | null;
    building_name: string | null;
    move_type_label: string | null;
    amount: number | null;
    estimate: number | null;
  }[];
  projects?: PmProjectRow[];
  dashboard?: {
    showPropertyStrip: boolean;
    showProjects: boolean;
    scheduledByProperty: Record<string, number>;
  };
  /** Overview “needs attention” strip (counts only; UI caps visible items). */
  overviewAttention?: {
    pendingApprovalMoveCount: number;
    overdueInvoiceCount: number;
    buildingsIncompleteAccessCount: number;
  };
};

const ZONE_LABELS: Record<string, string> = {
  same_building: "Same building",
  local: "Local",
  within_region: "Within region",
  to_from_toronto: "Durham ↔ Toronto",
  outside_gta: "Outside GTA",
};

const TIME_WINDOWS = [
  "8 AM – 10 AM",
  "10 AM – 12 PM",
  "12 PM – 2 PM",
  "2 PM – 4 PM",
  "4 PM – 6 PM",
];

/** Align with main partner dashboard (`PartnerPortalClient`): cream cards, forest hairlines, wine focus. */
const PM_HEADER =
  "bg-white border-b border-[#2C3E2D]/12 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between sticky top-0 z-30";
const PM_TABS_INNER =
  "flex items-center justify-start sm:justify-center gap-0 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-[#2C3E2D]/10 px-0 sm:px-2";
const PM_CARD =
  "rounded-xl border border-[#2C3E2D]/10 bg-white shadow-[0_1px_0_rgba(44,62,45,0.05)]";
const PM_MAIN =
  "max-w-[1100px] mx-auto px-4 sm:px-8 py-5 sm:py-8 pb-[calc(var(--admin-mobile-nav-bar)+env(safe-area-inset-bottom,0px))] sm:pb-10 text-[#1a1f1b]";
const PM_INSET =
  "rounded-lg border border-[#2C3E2D]/10 bg-[#FAF7F2]/70 p-3 text-[12px] space-y-1";
const PM_SECTION_EYE = `${pmLabelCaps} mb-2`;

function PmContextTabHeader({ tab }: { tab: PmTabId }) {
  if (tab === "overview" || tab === "calendar" || tab === "live") return null;
  const copy: Record<
    Exclude<PmTabId, "overview" | "calendar" | "live">,
    { title: string; subtitle: string }
  > = {
    buildings: {
      title: "Buildings",
      subtitle: "Access details, unit mix, and recent moves per property.",
    },
    schedule: {
      title: "Schedule a move",
      subtitle:
        "Submit a booking request. Yugo confirms within two hours during business hours.",
    },
    projects: {
      title: "Projects",
      subtitle: "Renovation programs and portfolio moves.",
    },
    analytics: {
      title: "Analytics",
      subtitle: "Volume, cost, and performance on your contract.",
    },
    statements: {
      title: "Statements & reports",
      subtitle: "Billing, statements, and monthly performance.",
    },
  };
  const c = copy[tab as keyof typeof copy];
  if (!c) return null;
  return (
    <div className="mb-6 pt-1">
      <p className={pmPortalEyebrow}>Partner portal</p>
      <h1 className={pmPageTitle}>{c.title}</h1>
      <p className={pmPageSubtitle}>{c.subtitle}</p>
    </div>
  );
}

function unitLine(address: string, unit: string) {
  return `${address} (Unit ${unit.trim() || "—"})`;
}

export default function PartnerPropertyManagementPortal({
  orgId,
  orgName,
  contactName,
  preview,
  initialTab: initialTabProp,
}: {
  orgId: string;
  orgName: string;
  contactName: string;
  /** Deep link from `/partner?pmTab=…` or `/partner/pm-calendar`. */
  initialTab?: PmTabId;
  /** Static sample data — skips API; booking tab shows a placeholder. */
  preview?: {
    initialSummary: PmPortalSummary;
    initialPrograms?: PmProjectRow[];
  };
}) {
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState("");
  const orgType = "property_management";
  const [summary, setSummary] = useState<PmPortalSummary | null>(
    () => preview?.initialSummary ?? null,
  );
  const [loading, setLoading] = useState(() => !preview?.initialSummary);
  const [tab, setTab] = useState<PmTabId>(() => initialTabProp ?? "overview");
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Calendar empty-cell → Schedule move tab with this YYYY-MM-DD. */
  const [schedulePrefillDate, setSchedulePrefillDate] = useState<string | null>(null);

  const today = new Date();
  const dayStr = formatDate(today, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/pm/summary");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setSummary(d);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (preview) return;
    load();
  }, [load, preview]);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    fetch("/api/partner/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.email) setUserEmail(String(d.email));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const headerOrgName = preview?.initialSummary.org?.name || orgName;

  const pmTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "calendar" as const, label: "Calendar" },
    { id: "live" as const, label: "Live" },
    { id: "buildings" as const, label: "Buildings" },
    { id: "schedule" as const, label: "Schedule move" },
    { id: "projects" as const, label: "Projects" },
    { id: "analytics" as const, label: "Analytics" },
    { id: "statements" as const, label: "Statements" },
  ] as const;

  return (
    <PartnerNotificationProvider orgId={orgId}>
      <PartnerChangePasswordGate>
        <div
          className="min-h-dvh w-full max-w-full min-w-0 overflow-x-clip bg-white text-[#1a1f1b]"
          data-theme="light"
        >
          <PartnerPortalWelcomeTour
            contactName={contactName}
            mode="pm"
            disabled={!!preview}
          />
          <header className={PM_HEADER}>
            <div className="flex items-center gap-2 min-w-0">
              <YugoLogo size={19} variant="wine" className="shrink-0" />
              <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] shrink-0">
                BETA
              </span>
              <span
                className="h-3 w-px bg-[#2C3E2D]/12 shrink-0 hidden sm:block"
                aria-hidden
              />
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] truncate max-w-[200px] sm:ml-1">
                {headerOrgName}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <PartnerNotificationBell
                open={notifOpen}
                onToggle={() => setNotifOpen(!notifOpen)}
                onClose={() => setNotifOpen(false)}
              />
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Account settings"
                className={partnerWineAccountButtonClass}
              >
                {contactName.charAt(0).toUpperCase()}
                {(contactName.split(" ")[1] || "").charAt(0).toUpperCase() ||
                  contactName.charAt(1)?.toUpperCase() ||
                  ""}
              </button>
            </div>
          </header>

          <main className={PM_MAIN}>
            {loading && !summary && (
              <div className="animate-pulse space-y-6 pt-2">
                <div className="h-9 w-48 bg-[#2C3E2D]/10 rounded-lg" />
                <div className="h-4 w-64 bg-[#2C3E2D]/10 rounded" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-[80px] bg-[#2C3E2D]/10 rounded-xl"
                    />
                  ))}
                </div>
                <div className="flex gap-2 border-b border-[#2C3E2D]/10 pb-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 w-24 bg-[#2C3E2D]/10 rounded-t-lg"
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-[#2C3E2D]/10 rounded-xl" />
                  ))}
                </div>
              </div>
            )}

            {summary && (
              <>
                {tab === "overview" ? (
                  <>
                    <div className="mb-6 pt-1">
                      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">
                        Partner portal
                      </p>
                      <h1
                        className="font-hero text-[28px] sm:text-[34px] md:text-[36px] font-normal leading-[1.08] tracking-tight break-words"
                        style={{ color: WINE }}
                      >
                        {getPartnerGreeting()}, {contactName}
                      </h1>
                      <p className="text-[14px] text-[#5A6B5E] mt-2 leading-relaxed max-w-xl">
                        {summary.todaysMoves && summary.todaysMoves.length > 0
                          ? `${summary.todaysMoves.length} ${
                              summary.todaysMoves.length === 1 ? "move" : "moves"
                            } scheduled today`
                          : `${dayStr} here are your scheduled moves`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-8">
                      <button
                        type="button"
                        onClick={() => {
                          setSchedulePrefillDate(null);
                          setTab("schedule");
                        }}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-none bg-[#2D3A26] text-white text-[10px] font-bold tracking-[0.12em] uppercase shadow-sm hover:bg-[#243220] transition-colors"
                      >
                        Schedule a move
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("calendar")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#E0E0E0] text-[10px] font-bold tracking-[0.12em] uppercase text-[#2D3A26] bg-white hover:bg-[#F9F7F2] transition-colors rounded-none"
                      >
                        <Calendar size={14} weight="regular" aria-hidden />
                        Calendar
                        <CaretRight
                          size={12}
                          weight="bold"
                          className="opacity-50"
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("statements")}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#E0E0E0] text-[10px] font-bold tracking-[0.12em] uppercase text-[#2D3A26] bg-white hover:bg-[#F9F7F2] transition-colors rounded-none"
                      >
                        <ChartBar size={14} weight="regular" aria-hidden />
                        Monthly report
                        <CaretRight
                          size={12}
                          weight="bold"
                          className="opacity-50"
                          aria-hidden
                        />
                      </button>
                    </div>

                    <PmPortalKpiStrip summary={summary} />
                  </>
                ) : (
                  <PmContextTabHeader tab={tab} />
                )}

                <div className="overflow-hidden mb-2">
                  <div
                    className={PM_TABS_INNER}
                    style={{
                      touchAction: "pan-x",
                      overscrollBehaviorX: "contain",
                      overscrollBehaviorY: "none",
                    }}
                  >
                    {pmTabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`shrink-0 px-3 sm:px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase whitespace-nowrap border-b transition-colors -mb-px min-w-[4.5rem] active:bg-[#5C1A33]/[0.06] ${
                          tab === t.id
                            ? "border-[#5C1A33] text-[#5C1A33]"
                            : "border-transparent text-[#5A6B5E] hover:text-[var(--tx2)]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-6 sm:pt-8 px-0 sm:px-1 tab-content">
                    {tab === "overview" && (
                      <PartnerPmOverview summary={summary} setTab={setTab} />
                    )}

                    {tab === "calendar" && (
                      <PartnerPmCalendarTab
                        setTab={setTab}
                        previewUpcomingMoves={
                          preview ? summary.upcomingMoves : undefined
                        }
                      />
                    )}

                    {tab === "live" && !preview && (
                      <PartnerLiveMapTab orgId={orgId} variant="pm" />
                    )}

                    {tab === "live" && preview && (
                      <p className="text-[13px] text-[var(--tx2)] leading-relaxed">
                        Live tracking is available when connected to your organization data.
                      </p>
                    )}

                    {tab === "buildings" && (
                      <PartnerPmBuildingsTab setTab={setTab} />
                    )}

                    {tab === "schedule" &&
                      (preview ? (
                        <PmBookPreviewPlaceholder />
                      ) : (
                        <PmBookForm
                          summary={summary}
                          initialScheduledDate={schedulePrefillDate}
                          onConsumeSchedulePrefill={() => setSchedulePrefillDate(null)}
                          onCancel={() => setTab("overview")}
                          onBooked={() => {
                            toast(
                              "Booking submitted — our team will confirm within two hours during business hours.",
                              "check",
                            );
                            load();
                            setSchedulePrefillDate(null);
                            setTab("overview");
                          }}
                        />
                      ))}

                    {tab === "projects" && (
                      <PartnerPmProjectsTab setTab={setTab} />
                    )}

                    {tab === "analytics" && (
                      <PartnerPmAnalyticsTab
                        preview={!!preview}
                        buildingOptions={summary.properties.map((p) => ({
                          id: p.id,
                          building_name: p.building_name,
                        }))}
                      />
                    )}

                    {tab === "statements" && (
                      <PartnerPmStatementsTab orgName={headerOrgName} />
                    )}
                  </div>
                </div>
              </>
            )}

            {!loading && !summary && (
              <p className="text-[13px] text-[var(--tx3)]">
                Could not load your portal. Please refresh or sign in again.
              </p>
            )}
          </main>

          <PartnerSettingsPanel
            open={settingsOpen}
            orgName={headerOrgName}
            contactName={contactName}
            userEmail={userEmail}
            orgType={orgType}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      </PartnerChangePasswordGate>
    </PartnerNotificationProvider>
  );
}

function PartnerNotificationBell({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    usePartnerNotifications();
  const ref = { current: null as HTMLDivElement | null };

  return (
    <div
      className="relative"
      ref={(el) => {
        ref.current = el;
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="relative p-2 rounded-sm hover:bg-[#5C1A33]/6 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} color="#5C1A33" weight="regular" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-[#5C1A33] text-white text-[8px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-(--card) border border-(--brd) rounded-xl shadow-xl overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--brd)">
              <h3 className="text-[13px] font-bold text-(--tx)">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[10px] font-semibold text-[var(--tx)] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-(--tx3)">
                  All caught up!
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      markAsRead(notif.id);
                      if (notif.link) window.location.href = notif.link;
                      onClose();
                    }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-(--brd) last:border-0 hover:bg-(--bg) cursor-pointer transition-colors w-full text-left ${
                      notif.read ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-(--tx)">
                        {notif.title}
                      </div>
                      {notif.body && (
                        <div className="text-[11px] text-(--tx3) mt-0.5 leading-snug">
                          {notif.body}
                        </div>
                      )}
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-[#5C1A33] mt-1.5 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PmBookPreviewPlaceholder() {
  return (
    <div className={`${PM_CARD} p-5 space-y-3`}>
      <h2 className="text-[16px] font-bold font-hero text-[#5C1A33]">
        Schedule a tenant move
      </h2>
      <p className="text-[13px] text-[var(--tx2)] leading-relaxed">
        This sample page shows layout and copy only. Sign in as a
        property-management partner to load the live booking form and submit
        requests.
      </p>
      <Link
        href="/partner/login"
        className="inline-flex text-[11px] font-bold tracking-[0.12em] uppercase text-[#5C1A33] border border-[#5C1A33]/35 rounded-lg px-3 py-2.5 hover:bg-[#5C1A33]/6 transition-colors"
      >
        Partner sign in
      </Link>
    </div>
  );
}

const PM_UNIT_TYPE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br_plus": "4+ Bedroom",
};

function todayYmdLocal() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

const PM_SCHEDULE_STEPS = [
  { id: 1, label: "Move", description: "Building, unit & move type" },
  { id: 2, label: "Details", description: "Locations, schedule & options" },
  { id: 3, label: "Review", description: "Confirm & submit" },
] as const;

function PmScheduleSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1.5">
      {children}
    </h3>
  );
}

function PmBookForm({
  summary,
  onBooked,
  initialScheduledDate,
  onConsumeSchedulePrefill,
  onCancel,
}: {
  summary: PmPortalSummary;
  onBooked: () => void;
  /** Pre-fill move date (e.g. from calendar empty cell). */
  initialScheduledDate?: string | null;
  onConsumeSchedulePrefill?: () => void;
  /** Matches schedule modal: Cancel returns to overview. */
  onCancel?: () => void;
}) {
  const { toast } = useToast();
  const contract = summary.contract;
  const [propertyId, setPropertyId] = useState(summary.properties[0]?.id ?? "");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitFloor, setUnitFloor] = useState("");
  const [unitType, setUnitType] = useState("2br");
  const [reasonCode, setReasonCode] = useState("");
  const [reasons, setReasons] = useState<MoveReason[]>([]);
  const [addons, setAddons] = useState<ContractAddon[]>([]);
  const [projects, setProjects] = useState<PmProjectRow[]>([]);
  const [pmProjectId, setPmProjectId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [vacantNoTenant, setVacantNoTenant] = useState(false);
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [suiteFrom, setSuiteFrom] = useState("");
  const [suiteTo, setSuiteTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayYmdLocal);
  const [returnDate, setReturnDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState(TIME_WINDOWS[0]!);
  const [urgency, setUrgency] = useState<"standard" | "priority" | "emergency">(
    "standard",
  );
  const [afterHours, setAfterHours] = useState(false);
  const [holiday, setHoliday] = useState(false);
  const [weekendOverride, setWeekendOverride] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [tenantCommsChoice, setTenantCommsChoice] = useState<
    "use_contract" | "yugo" | "partner"
  >("use_contract");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [pmStep, setPmStep] = useState(1);
  const fieldInput = "field-input-compact w-full min-w-0 bg-transparent";
  const fieldTextareaUnderline =
    "field-input-compact field-input-compact--multiline-underline w-full min-w-0 bg-transparent";
  const [pricing, setPricing] = useState<{
    zone: string;
    subtotal: number;
    base_price: number;
    weekend: boolean;
    error?: string;
  } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReasonRef = useRef<string>("");

  const prop = summary.properties.find((p) => p.id === propertyId);
  const partnerVertical = summary.org?.vertical ?? null;

  const visibleReasons = useMemo(() => {
    return reasons.filter(
      (r) =>
        !COMMERCIAL_ONLY_PM_REASON_CODES.has(r.reason_code) ||
        isCommercialPmVertical(partnerVertical),
    );
  }, [reasons, partnerVertical]);

  const primaryReasons = useMemo(() => {
    const list: MoveReason[] = [];
    for (const code of PM_PRIMARY_REASON_CODES_ORDERED) {
      const hit = visibleReasons.find((r) => r.reason_code === code);
      if (hit) list.push(hit);
    }
    return list;
  }, [visibleReasons]);

  const secondaryReasons = useMemo(() => {
    const primary = new Set<string>([...PM_PRIMARY_REASON_CODES_ORDERED]);
    return visibleReasons.filter((r) => !primary.has(r.reason_code));
  }, [visibleReasons]);

  useEffect(() => {
    if (!initialScheduledDate) return;
    setScheduledDate(initialScheduledDate);
    onConsumeSchedulePrefill?.();
  }, [initialScheduledDate, onConsumeSchedulePrefill]);

  useEffect(() => {
    if (visibleReasons.length === 0) return;
    if (!visibleReasons.some((r) => r.reason_code === reasonCode)) {
      setReasonCode(visibleReasons[0]!.reason_code);
    }
  }, [visibleReasons, reasonCode]);

  const dateIsWeekend = useMemo(() => {
    if (!scheduledDate) return false;
    const parts = scheduledDate.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) return false;
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay();
    return day === 0 || day === 6;
  }, [scheduledDate]);

  const effectiveWeekend = dateIsWeekend || weekendOverride;

  useEffect(() => {
    if (!contract?.id) return;
    let cancelled = false;
    Promise.all([
      fetch(
        `/api/partner/pm/move-reasons?contract_id=${encodeURIComponent(contract.id)}`,
      ).then((r) => r.json()),
      fetch(
        `/api/partner/pm/addons?contract_id=${encodeURIComponent(contract.id)}`,
      ).then((r) => r.json()),
      fetch("/api/partner/pm/projects").then((r) => r.json()),
    ])
      .then(([r1, r2, r3]) => {
        if (cancelled) return;
        setReasons(r1.reasons ?? []);
        setAddons(r2.addons ?? []);
        setProjects(r3.projects ?? []);
      })
      .catch(() => {
        if (!cancelled) toast("Could not load booking options", "x");
      });
    return () => {
      cancelled = true;
    };
  }, [contract?.id, toast]);

  const selectedReason =
    reasons.find((r) => r.reason_code === reasonCode) ?? null;

  useEffect(() => {
    if (!selectedReason || !prop) return;
    const reasonJustChanged =
      prevReasonRef.current !== selectedReason.reason_code;
    if (reasonJustChanged) prevReasonRef.current = selectedReason.reason_code;

    const ua = unitLine(prop.address, unitNumber);
    const storageHint =
      "Storage location (Yugo warehouse, building storage, or full address)";
    if (selectedReason.reason_code === "suite_transfer") {
      setFromAddress(unitLine(prop.address, suiteFrom));
      setToAddress(unitLine(prop.address, suiteTo));
      return;
    }
    const o = selectedReason.default_origin;
    const d = selectedReason.default_destination;
    if (o === "unit") setFromAddress(ua);
    else if (o === "external") {
      if (reasonJustChanged) setFromAddress("");
      else setFromAddress((prev) => (prev.trim() ? prev : ""));
    } else if (o === "storage")
      setFromAddress((prev) => (prev.includes("Storage") ? prev : storageHint));
    else if (o === "custom" && reasonJustChanged) setFromAddress("");

    if (d === "unit") setToAddress(ua);
    else if (d === "external") {
      if (reasonJustChanged) setToAddress("");
      else setToAddress((prev) => (prev.trim() ? prev : ""));
    } else if (d === "storage")
      setToAddress((prev) =>
        prev.includes("Storage") || prev.length > 12 ? prev : storageHint,
      );
    else if (d === "custom" && reasonJustChanged) setToAddress("");

    if (selectedReason.urgency_default === "emergency") setUrgency("emergency");
    else if (selectedReason.urgency_default === "priority")
      setUrgency("priority");
    else setUrgency("standard");
  }, [selectedReason, prop, unitNumber, suiteFrom, suiteTo]);

  const runPreview = useCallback(() => {
    if (!contract?.id || !reasonCode || !propertyId) {
      setPricing(null);
      return;
    }
    if (reasonCode === "suite_transfer") {
      if (!suiteFrom.trim() || !suiteTo.trim()) {
        setPricing(null);
        return;
      }
    } else if (!fromAddress.trim() && !toAddress.trim() && !unitNumber.trim()) {
      setPricing(null);
      return;
    }
    setPricingLoading(true);
    fetch("/api/partner/pm/preview-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: contract.id,
        partner_property_id: propertyId,
        reason_code: reasonCode,
        unit_type: unitType,
        unit_number: unitNumber,
        from_address: fromAddress,
        to_address: toAddress,
        scheduled_date: scheduledDate,
        urgency,
        after_hours: afterHours,
        holiday,
        weekend: effectiveWeekend,
      }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setPricing({
            zone: "",
            subtotal: 0,
            base_price: 0,
            weekend: false,
            error: d.error || "Could not price",
          });
          return;
        }
        setPricing({
          zone: d.zone,
          subtotal: d.subtotal,
          base_price: d.base_price,
          weekend: d.weekend,
        });
      })
      .catch(() =>
        setPricing({
          zone: "",
          subtotal: 0,
          base_price: 0,
          weekend: false,
          error: "Network error",
        }),
      )
      .finally(() => setPricingLoading(false));
  }, [
    contract?.id,
    reasonCode,
    fromAddress,
    toAddress,
    propertyId,
    unitType,
    unitNumber,
    suiteFrom,
    suiteTo,
    scheduledDate,
    urgency,
    afterHours,
    holiday,
    weekendOverride,
    effectiveWeekend,
  ]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runPreview, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runPreview]);

  const needsReturn = !!(
    selectedReason?.requires_return_move || selectedReason?.is_round_trip
  );
  const suiteMode = reasonCode === "suite_transfer";

  const goNext = () => {
    if (pmStep === 1) {
      if (!propertyId || !unitNumber.trim() || !reasonCode) {
        toast("Choose a building, unit number, and move type.", "x");
        return;
      }
      setPmStep(2);
      return;
    }
    if (pmStep === 2) {
      if (suiteMode && (!suiteFrom.trim() || !suiteTo.trim())) {
        toast("Enter both suite units for a suite transfer.", "x");
        return;
      }
      if (!fromAddress.trim() || !toAddress.trim()) {
        toast("Add origin and destination.", "x");
        return;
      }
      if (!vacantNoTenant && !tenantName.trim()) {
        toast("Enter the tenant name or mark the unit as vacant.", "x");
        return;
      }
      if (needsReturn && !returnDate) {
        toast("Return service date is required for this job type.", "x");
        return;
      }
      setPmStep(3);
    }
  };

  const submitBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!contract?.id) {
      toast("No active contract — contact Yugo.", "x");
      return;
    }
    if (suiteMode && (!suiteFrom.trim() || !suiteTo.trim())) {
      toast("Enter both suite units for a suite transfer.", "x");
      return;
    }
    if (needsReturn && !returnDate) {
      toast("Return service date is required for this job type.", "x");
      return;
    }
    setSaving(true);
    try {
      const addon_selections = addons
        .filter((a) => selectedAddons[a.addon_code])
        .map((a) => ({
          addon_code: a.addon_code,
          label: a.label,
          price: a.price,
        }));
      const res = await fetch("/api/partner/pm/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contract.id,
          partner_property_id: propertyId,
          unit_number: unitNumber,
          unit_floor: unitFloor,
          unit_type: unitType,
          reason_code: reasonCode,
          tenant_name: vacantNoTenant ? "" : tenantName,
          vacant_no_tenant: vacantNoTenant,
          tenant_phone: tenantPhone,
          tenant_email: tenantEmail,
          from_address: fromAddress,
          to_address: toAddress,
          scheduled_date: scheduledDate,
          return_scheduled_date: needsReturn ? returnDate : "",
          scheduled_time: scheduledTime,
          urgency,
          after_hours: afterHours,
          holiday,
          weekend: effectiveWeekend,
          special_instructions: instructions,
          addon_selections,
          pm_project_id: pmProjectId || null,
          tenant_comms_mode:
            tenantCommsChoice === "use_contract"
              ? ""
              : tenantCommsChoice === "yugo"
                ? "yugo"
                : "partner",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      onBooked();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  if (!contract) {
    return (
      <p className="text-[13px] text-[var(--tx2)] leading-relaxed">
        Booking opens once your contract is active.
      </p>
    );
  }

  const estimateSection = (
    <>
      {pricingLoading && (
        <p className="text-[12px] text-[var(--tx3)]">Calculating estimate…</p>
      )}
      {!pricingLoading && pricing?.error && (
        <p className="text-[12px] text-red-700">{pricing.error}</p>
      )}
      {!pricingLoading && pricing && !pricing.error && (
        <div className="rounded-lg border border-[#2C3E2D]/10 bg-[#FAF7F2]/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)]">
                Your rate
              </p>
              <p className="text-[22px] font-hero text-[#1a1f1b] mt-1">
                {formatCurrency(pricing.subtotal)}
              </p>
              <p className="text-[11px] text-[var(--tx3)] mt-1 leading-relaxed">
                {PM_UNIT_TYPE_LABELS[unitType] ?? unitType}
                {" · "}
                {selectedReason?.label ?? reasonCode}
                {pricing.weekend ? " · Weekend" : ""}
                {urgency !== "standard" ? ` · ${urgency}` : ""}
              </p>
              <p className="text-[11px] text-[#1a1f1b] mt-2">
                Zone: {ZONE_LABELS[pricing.zone] ?? pricing.zone}
                {pricing.weekend ? " · Weekend surcharges apply" : ""}
              </p>
              <p className="text-[11px] text-[#1a1f1b]">
                Base {formatCurrency(pricing.base_price)} → Total{" "}
                {formatCurrency(pricing.subtotal)}
              </p>
            </div>
            <p className="text-[10px] text-[var(--tx3)] max-w-[9rem] text-right leading-snug">
              Your contract rate — refines with dates and options below
            </p>
          </div>
        </div>
      )}
    </>
  );

  const stepMeta = PM_SCHEDULE_STEPS[pmStep - 1]!;
  const commsLabel =
    tenantCommsChoice === "use_contract"
      ? "Use contract default"
      : tenantCommsChoice === "yugo"
        ? "Yugo contacts tenant"
        : "We forward tracking";
  const selectedProjectName =
    pmProjectId && projects.find((p) => p.id === pmProjectId)?.project_name;

  const goBack = () => {
    if (pmStep <= 1) {
      onCancel?.();
      return;
    }
    setPmStep((s) => s - 1);
  };

  return (
    <form
      className="w-full flex flex-col min-h-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (pmStep === 3) void submitBooking(e);
      }}
    >
      <div className="shrink-0">
        <div className="px-0 sm:px-1 pt-2 pb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]/80 mb-1.5">
              {pmStep === 1 && "PER MOVE — BUILDING, UNIT & MOVE TYPE"}
              {pmStep === 2 && "PER MOVE — LOCATIONS, SCHEDULE & OPTIONS"}
              {pmStep === 3 && "PER MOVE — REVIEW & SUBMIT"}
            </p>
            <h2 className="font-hero text-[24px] sm:text-[28px] font-normal text-[#5C1A33] leading-[1.1] tracking-tight">
              {stepMeta.label}
            </h2>
            <p className="text-[11px] text-[#5A6B5E] mt-1">{stepMeta.description}</p>
          </div>
          <InfoHint
            ariaLabel="Booking turnaround"
            align="end"
            className="shrink-0 mt-0.5"
          >
            <span>
              Yugo confirms within two hours during business hours. Emergency requests
              are prioritized sooner.
            </span>
          </InfoHint>
        </div>
        <div className="px-0 sm:px-1 py-3 border-t border-[#2C3E2D]/10">
          <nav
            className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[9px] font-bold tracking-[0.12em] uppercase"
            aria-label="Schedule steps"
          >
            {PM_SCHEDULE_STEPS.map((s, i) => (
              <span key={s.id} className="contents">
                {i > 0 ? (
                  <span className="text-[var(--tx3)] px-0.5 select-none" aria-hidden>
                    —
                  </span>
                ) : null}
                <span
                  className={`inline-flex items-center gap-1 rounded-sm px-2 py-1.5 transition-colors ${
                    pmStep === s.id
                      ? "bg-[#5C1A33] text-[#FFFBF7] shadow-sm"
                      : pmStep > s.id
                        ? "text-[var(--tx3)]"
                        : "text-[#5A6B5E]/50"
                  }`}
                >
                  {pmStep > s.id ? (
                    <Check
                      size={11}
                      weight="bold"
                      className="text-[#5A6B5E] shrink-0"
                      aria-hidden
                    />
                  ) : null}
                  {s.label}
                </span>
              </span>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden px-0 sm:px-1 py-6 space-y-8 min-h-0">
        {pmStep === 1 && (
          <div className="space-y-8">
      <div>
        <PmScheduleSectionLabel>Building</PmScheduleSectionLabel>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className={fieldInput}
          required
        >
          {summary.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.building_name} — {p.address}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <PmScheduleSectionLabel>Unit #</PmScheduleSectionLabel>
          <input
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            className={fieldInput}
            required
          />
        </div>
        <div>
          <PmScheduleSectionLabel>Floor</PmScheduleSectionLabel>
          <input
            value={unitFloor}
            onChange={(e) => setUnitFloor(e.target.value)}
            placeholder="Optional"
            className={fieldInput}
          />
        </div>
      </div>

      <div>
        <PmScheduleSectionLabel>Unit size</PmScheduleSectionLabel>
        <select
          value={unitType}
          onChange={(e) => setUnitType(e.target.value)}
          className={fieldInput}
        >
          {[
            ["studio", "Studio"],
            ["1br", "1 bedroom"],
            ["2br", "2 bedroom"],
            ["3br", "3 bedroom"],
            ["4br_plus", "4+ bedroom"],
          ].map(([u, lab]) => (
            <option key={u} value={u}>
              {lab}
            </option>
          ))}
        </select>
      </div>

      <div>
        <PmScheduleSectionLabel>Move type</PmScheduleSectionLabel>
        {visibleReasons.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)]">Loading move types…</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {primaryReasons.map((r) => {
                const active = reasonCode === r.reason_code;
                return (
                  <button
                    key={r.reason_code}
                    type="button"
                    onClick={() => setReasonCode(r.reason_code)}
                    className={`p-3 rounded-lg border text-left transition-colors active:scale-[0.99] ${
                      active
                        ? "border-[#5C1A33] bg-[#5C1A33]/6 ring-1 ring-[#5C1A33]/20"
                        : "border-[#2C3E2D]/12 hover:border-[#5C1A33]/25 bg-white"
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-[#1a1f1b]">
                      {r.label}
                      {r.urgency_default === "emergency" ? " · Emergency" : ""}
                    </p>
                    {r.description && (
                      <p className="text-[11px] text-[var(--tx3)] mt-1 leading-relaxed">
                        {r.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {secondaryReasons.length > 0 && (
              <details className="rounded-lg border border-[#2C3E2D]/10 bg-white/80 px-3 py-2">
                <summary className="text-[12px] font-semibold text-[#5C1A33] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  More move types
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 pb-1">
                  {secondaryReasons.map((r) => {
                    const active = reasonCode === r.reason_code;
                    return (
                      <button
                        key={r.reason_code}
                        type="button"
                        onClick={() => setReasonCode(r.reason_code)}
                        className={`p-3 rounded-lg border text-left transition-colors active:scale-[0.99] ${
                          active
                            ? "border-[#5C1A33] bg-[#5C1A33]/6 ring-1 ring-[#5C1A33]/20"
                            : "border-[#2C3E2D]/12 hover:border-[#5C1A33]/25 bg-white"
                        }`}
                      >
                        <p className="text-[13px] font-semibold text-[#1a1f1b]">
                          {r.label}
                          {r.urgency_default === "emergency" ? " · Emergency" : ""}
                        </p>
                        {r.description && (
                          <p className="text-[11px] text-[var(--tx3)] mt-1 leading-relaxed">
                            {r.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div>
          <PmScheduleSectionLabel>Program (optional)</PmScheduleSectionLabel>
          <select
            value={pmProjectId}
            onChange={(e) => setPmProjectId(e.target.value)}
            className={fieldInput}
          >
            <option value="">None — standalone job</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-sm border border-[#2C3E2D]/10 bg-[#FAF7F2]/60 px-4 py-3">
        <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1">Your rate</p>
        <p className="text-[12px] text-[#5A6B5E] leading-relaxed">
          Continue to add locations and schedule — your contract estimate appears after origin and destination are set.
        </p>
      </div>
          </div>
        )}

        {pmStep === 2 && (
          <div className="space-y-8">
      <div>
        <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
          <input
            type="checkbox"
            checked={vacantNoTenant}
            onChange={(e) => setVacantNoTenant(e.target.checked)}
          />
          No tenant — vacant unit
        </label>
      </div>

      {!vacantNoTenant && (
        <div>
          <PmScheduleSectionLabel>Tenant / occupant</PmScheduleSectionLabel>
          <input
            placeholder="Name"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            className={`${fieldInput} mb-2`}
            required={!vacantNoTenant}
          />
          <input
            placeholder="Phone"
            value={tenantPhone}
            onChange={(e) => setTenantPhone(e.target.value)}
            className={`${fieldInput} mb-2`}
          />
          <input
            placeholder="Email"
            type="email"
            value={tenantEmail}
            onChange={(e) => setTenantEmail(e.target.value)}
            className={fieldInput}
          />
        </div>
      )}

      {suiteMode && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <PmScheduleSectionLabel>From unit</PmScheduleSectionLabel>
            <input
              value={suiteFrom}
              onChange={(e) => setSuiteFrom(e.target.value)}
              className={fieldInput}
              required
            />
          </div>
          <div>
            <PmScheduleSectionLabel>To unit</PmScheduleSectionLabel>
            <input
              value={suiteTo}
              onChange={(e) => setSuiteTo(e.target.value)}
              className={fieldInput}
              required
            />
          </div>
        </div>
      )}

      <div>
        <PmScheduleSectionLabel>Origin</PmScheduleSectionLabel>
        <textarea
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          rows={2}
          className={fieldTextareaUnderline}
          required
        />
      </div>
      <div>
        <PmScheduleSectionLabel>Destination</PmScheduleSectionLabel>
        <textarea
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          rows={2}
          className={fieldTextareaUnderline}
          required
        />
      </div>

      <div>
        <PmScheduleSectionLabel>Move date</PmScheduleSectionLabel>
        <input
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className={fieldInput}
          required
        />
      </div>

      {needsReturn && (
        <div>
          <PmScheduleSectionLabel>Return date</PmScheduleSectionLabel>
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className={fieldInput}
            required
          />
          <p className="text-[10px] text-[var(--tx3)] mt-1 leading-relaxed">
            A return leg will be created automatically for ops to confirm.
          </p>
        </div>
      )}

      <div>
        <PmScheduleSectionLabel>Time window</PmScheduleSectionLabel>
        <select
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          className={fieldInput}
        >
          {TIME_WINDOWS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <div>
        <PmScheduleSectionLabel>Urgency</PmScheduleSectionLabel>
        <select
          value={urgency}
          onChange={(e) =>
            setUrgency(e.target.value as "standard" | "priority" | "emergency")
          }
          className={fieldInput}
        >
          <option value="standard">Standard</option>
          <option value="priority">Priority (+15%)</option>
          <option value="emergency">Emergency (+30%)</option>
        </select>
      </div>

      <div className="space-y-2 text-[12px] text-[var(--tx2)]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={afterHours}
            onChange={(e) => setAfterHours(e.target.checked)}
          />
          After-hours window
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={holiday}
            onChange={(e) => setHoliday(e.target.checked)}
          />
          Holiday / statutory day
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={weekendOverride}
            disabled={dateIsWeekend}
            onChange={(e) => setWeekendOverride(e.target.checked)}
          />
          <span>
            Count as weekend pricing
            {dateIsWeekend ? " (auto-detected from move date)" : ""}
          </span>
        </label>
      </div>

      {addons.length > 0 && (
        <div>
          <p className={PM_SECTION_EYE}>Add-ons (contract rates)</p>
          <div className="space-y-2">
            {addons.map((a) => (
              <label
                key={a.addon_code}
                className="flex items-start gap-2 text-[12px] text-[#1a1f1b]"
              >
                <input
                  type="checkbox"
                  checked={!!selectedAddons[a.addon_code]}
                  onChange={(e) =>
                    setSelectedAddons((s) => ({
                      ...s,
                      [a.addon_code]: e.target.checked,
                    }))
                  }
                />
                <span>
                  {a.label} — {formatCurrency(Number(a.price))}
                  {a.price_type !== "flat"
                    ? ` (${a.price_type.replace("_", " ")})`
                    : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <PmScheduleSectionLabel>Special instructions</PmScheduleSectionLabel>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className={fieldTextareaUnderline}
        />
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <PmScheduleSectionLabel>Tenant communication</PmScheduleSectionLabel>
          <InfoHint
            ariaLabel="Tenant communication options"
            align="end"
            className="shrink-0 mt-0.5"
          >
            <div className="space-y-2 text-[11px]">
              <p>
                <span className="font-semibold">Yugo contacts tenant:</span> When the booking is approved, Yugo can text
                the tenant a tracking link for move day (phone required).
              </p>
              <p>
                <span className="font-semibold">We forward tracking:</span> You will receive the tracking link by email to
                share with the tenant.
              </p>
            </div>
          </InfoHint>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["use_contract", "Use contract default"],
              ["yugo", "Yugo contacts tenant"],
              ["partner", "We forward tracking"],
            ] as const
          ).map(([id, lab]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTenantCommsChoice(id)}
              className={`px-3 py-2 rounded-lg text-[12px] font-semibold border transition-colors active:scale-[0.99] ${
                tenantCommsChoice === id
                  ? "border-[#5C1A33] bg-[#5C1A33]/6 text-[#5C1A33]"
                  : "border-[#2C3E2D]/12 bg-white text-[var(--tx2)]"
              }`}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      {estimateSection}
          </div>
        )}

        {pmStep === 3 && (
          <div className="space-y-8">
            <div className="rounded-sm border border-[#2C3E2D]/10 bg-white/80 px-4 py-4 space-y-4">
              <PmScheduleSectionLabel>Booking summary</PmScheduleSectionLabel>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-[12px]">
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Building
                  </dt>
                  <dd className="text-[var(--tx)] leading-relaxed">
                    {prop?.building_name ?? "—"}
                    {prop?.address ? ` — ${prop.address}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Unit
                  </dt>
                  <dd className="text-[var(--tx)]">
                    {unitNumber || "—"}
                    {unitFloor ? ` · Floor ${unitFloor}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Unit size
                  </dt>
                  <dd className="text-[var(--tx)]">
                    {PM_UNIT_TYPE_LABELS[unitType] ?? unitType}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Move type
                  </dt>
                  <dd className="text-[var(--tx)]">
                    {selectedReason?.label ?? reasonCode}
                  </dd>
                </div>
                {selectedProjectName ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                      Program
                    </dt>
                    <dd className="text-[var(--tx)]">{selectedProjectName}</dd>
                  </div>
                ) : null}
                {suiteMode ? (
                  <>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                        From unit
                      </dt>
                      <dd className="text-[var(--tx)]">{suiteFrom || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                        To unit
                      </dt>
                      <dd className="text-[var(--tx)]">{suiteTo || "—"}</dd>
                    </div>
                  </>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Tenant
                  </dt>
                  <dd className="text-[var(--tx)] leading-relaxed">
                    {vacantNoTenant
                      ? "Vacant unit"
                      : [tenantName, tenantPhone, tenantEmail]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Origin
                  </dt>
                  <dd className="text-[var(--tx)] whitespace-pre-wrap leading-relaxed">
                    {fromAddress || "—"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Destination
                  </dt>
                  <dd className="text-[var(--tx)] whitespace-pre-wrap leading-relaxed">
                    {toAddress || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Move date
                  </dt>
                  <dd className="text-[var(--tx)]">
                    {scheduledDate ? formatDate(scheduledDate) : "—"}
                  </dd>
                </div>
                {needsReturn ? (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                      Return date
                    </dt>
                    <dd className="text-[var(--tx)]">
                      {returnDate ? formatDate(returnDate) : "—"}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Time window
                  </dt>
                  <dd className="text-[var(--tx)]">{scheduledTime}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Urgency
                  </dt>
                  <dd className="text-[var(--tx)] capitalize">{urgency}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Options
                  </dt>
                  <dd className="text-[var(--tx)] leading-relaxed">
                    {[
                      afterHours ? "After-hours window" : null,
                      holiday ? "Holiday / statutory day" : null,
                      weekendOverride && !dateIsWeekend
                        ? "Weekend pricing override"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Standard"}
                  </dd>
                </div>
                {addons.some((a) => selectedAddons[a.addon_code]) ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                      Add-ons
                    </dt>
                    <dd className="text-[var(--tx)] leading-relaxed">
                      {addons
                        .filter((a) => selectedAddons[a.addon_code])
                        .map((a) => a.label)
                        .join(" · ")}
                    </dd>
                  </div>
                ) : null}
                {instructions.trim() ? (
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                      Special instructions
                    </dt>
                    <dd className="text-[var(--tx)] whitespace-pre-wrap leading-relaxed">
                      {instructions}
                    </dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] mb-0.5">
                    Tenant communication
                  </dt>
                  <dd className="text-[var(--tx)]">{commsLabel}</dd>
                </div>
              </dl>
            </div>
            {estimateSection}
            <p className="text-[10px] text-[var(--tx3)] leading-relaxed">
              Yugo confirms within two hours during business hours. Emergency
              requests are confirmed as soon as possible.
            </p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-[#FAF7F2]/95 backdrop-blur-sm border-t border-[#2C3E2D]/10 px-0 sm:px-1 py-3.5 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase border border-[#2C3E2D]/25 text-[var(--tx)] hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm active:bg-[#5C1A33]/10"
        >
          <CaretLeft size={14} weight="bold" aria-hidden />
          {pmStep === 1 ? "Cancel" : "Back"}
        </button>
        <div className="flex-1 min-w-2" />
        {pmStep < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] active:scale-[0.98] transition-[transform,colors] rounded-sm"
          >
            Continue
            <CaretRight size={14} weight="bold" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving || !propertyId || !reasonCode}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] active:scale-[0.98] disabled:opacity-50 transition-[transform,colors] rounded-sm"
          >
            {saving ? "Submitting…" : "Submit booking request"}
            <CaretRight size={14} weight="bold" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
