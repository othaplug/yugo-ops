"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Lock,
  Check,
  Warning,
  ShareNetwork,
  Calendar,
  ChartBar,
  Bell,
  FileText,
  DownloadSimple,
  Plus,
  NavigationArrow,
  UserCircle,
  ListBullets,
  X,
  Money,
  ClipboardText,
  MapPin,
  ArrowsClockwise,
  CaretRight,
} from "@phosphor-icons/react";
import { getPartnerFeatures, getPartnerGreeting } from "@/lib/partner-type";
import { getPartnerPortalTerminology } from "@/lib/partner-vertical-copy";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate, formatDateTime } from "@/lib/client-timezone";
import PartnerDeliveriesTab from "./tabs/PartnerDeliveriesTab";
import PartnerCalendarTab from "./tabs/PartnerCalendarTab";
import PartnerInvoicesTab from "./tabs/PartnerInvoicesTab";
import PartnerBillingTab from "./tabs/PartnerBillingTab";
import PartnerLiveMapTab from "./tabs/PartnerLiveMapTab";
import PartnerRealtorTab from "./tabs/PartnerRealtorTab";
import PartnerProjectsTab from "./tabs/PartnerProjectsTab";
import PartnerB2BProjectsTab from "./tabs/PartnerB2BProjectsTab";
import PartnerRecurringTab from "./tabs/PartnerRecurringTab";
import PartnerAnalyticsTab from "./tabs/PartnerAnalyticsTab";
import PartnerInboundShipmentsTab from "./tabs/PartnerInboundShipmentsTab";
import PartnerScheduleModal from "./PartnerScheduleModal";
import PartnerShareModal from "./PartnerShareModal";
import PartnerDeliveryDetailModal from "./PartnerDeliveryDetailModal";
import PartnerEditDeliveryModal from "./PartnerEditDeliveryModal";
import PartnerSettingsPanel from "./PartnerSettingsPanel";
import PartnerChangePasswordGate from "./PartnerChangePasswordGate";
import PartnerPropertyManagementPortal from "./PartnerPropertyManagementPortal";
import type { PmTabId } from "@/components/partner/pm/PartnerPmPortalViews";
import PartnerSignOut from "./PartnerSignOut";
import {
  PartnerNotificationProvider,
  usePartnerNotifications,
} from "./PartnerNotificationContext";
import { usePartnerOrgDisplayName } from "./PartnerOrgContext";
import { ToastProvider, useToast } from "@/app/admin/components/Toast";
import YugoLogo from "@/components/YugoLogo";
import Link from "next/link";
import { applyPartnerPortalLightTheme } from "@/lib/partner-portal-theme";
import { FOREST, WINE } from "@/app/quote/[quoteId]/quote-shared";
import { normalizeDeliveryItemsForDisplay } from "@/lib/delivery-items";
import { PartnerPortalWelcomeTour } from "@/components/partner/PartnerPortalWelcomeTour";
import { partnerWineAccountButtonClass } from "@/components/partner/PartnerChrome";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

interface PortalFeatures {
  projects?: boolean;
  day_rates?: boolean;
  recurring_schedules?: boolean;
}

interface Props {
  orgId: string;
  orgName: string;
  orgType: string;
  contactName: string;
  userEmail: string;
  portalFeatures?: PortalFeatures | null;
  initialProjectId?: string;
  /** Property-management portal only: opens the given tab on load (e.g. `calendar`). */
  initialPmTab?: PmTabId;
}

interface ProjectData {
  id: string;
  name: string;
  address: string | null;
  status: string;
  gallery: string | null;
  details: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface DashboardData {
  orgType: string;
  deliveriesCount: number;
  movesCount: number;
  completedThisMonth: number;
  onTimeRate: number;
  satisfactionScore: number | null;
  outstandingAmount: number;
  outstandingDueDate: string | null;
  todayDeliveries: Delivery[];
  upcomingDeliveries: Delivery[];
  allDeliveries: Delivery[];
  recentMoves: Move[];
  invoices: Invoice[];
  referrals: Referral[];
  totalEarned: number;
  completedReferrals: number;
  projects: ProjectData[];
  statements?: PartnerStatement[];
}

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string;
  stage: string | null;
  scheduled_date: string | null;
  time_slot: string | null;
  delivery_window?: string | null;
  delivery_address: string | null;
  pickup_address: string | null;
  items: unknown[] | string[] | null;
  category: string | null;
  crew_id: string | null;
  created_at: string;
  quoted_price?: number | null;
  total_price?: number | null;
  admin_adjusted_price?: number | null;
  booking_type?: string | null;
  vehicle_type?: string | null;
  num_stops?: number | null;
  delivery_type?: string | null;
  zone?: number | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  estimated_duration_hours?: number | null;
  stops_detail?:
    | {
        address: string;
        customer_name?: string | null;
        customer_phone?: string | null;
        items?: { name: string; size: string; quantity: number }[];
        instructions?: string | null;
        zone?: number | null;
      }[]
    | null;
}

interface Move {
  id: string;
  move_code: string;
  client_name: string | null;
  status: string;
  stage: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  from_address: string | null;
  to_address: string | null;
  crew_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface Referral {
  id: string;
  agent_name: string;
  client_name: string | null;
  client_email: string | null;
  property: string | null;
  tier: string | null;
  status: string;
  commission: number;
  move_type: string | null;
  created_at: string;
}

interface PartnerStatement {
  id: string;
  statement_number: string;
  period_start: string;
  period_end: string;
  delivery_count: number;
  subtotal: number;
  hst: number;
  total: number;
  due_date: string;
  payment_terms: string;
  status: string;
  paid_amount: number;
  paid_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  dispatched: "bg-amber-50 text-amber-700 border-amber-200",
  "in-transit": "bg-amber-50 text-amber-700 border-amber-200",
  in_transit: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-orange-50 text-orange-700 border-orange-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  booked: "bg-green-50 text-green-700 border-green-200",
  new: "bg-blue-50 text-blue-700 border-blue-200",
};

function PartnerPortalInner({
  orgId,
  orgName,
  orgType,
  contactName,
  userEmail,
  portalFeatures,
  initialProjectId,
  initialPmTab,
}: Props) {
  const { toast } = useToast();
  const headerOrgName = usePartnerOrgDisplayName();
  const features = getPartnerFeatures(orgType);
  const portalTerms = useMemo(
    () => getPartnerPortalTerminology(orgType),
    [orgType],
  );
  // portal_features from DB override legacy type-based feature detection
  const pf: PortalFeatures = portalFeatures ?? {};
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(
    initialProjectId && (portalFeatures?.projects ?? features.showProjects)
      ? "b2b-projects"
      : features.showReferrals
        ? "active"
        : "today",
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleInitialDate, setScheduleInitialDate] = useState("");
  const [scheduleSuggestedItems, setScheduleSuggestedItems] = useState<
    string | null
  >(null);
  const [scheduleModalKey, setScheduleModalKey] = useState(0);
  const [bookServiceModalOpen, setBookServiceModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Delivery | null>(null);
  const [detailTarget, setDetailTarget] = useState<Delivery | null>(null);
  const [editTarget, setEditTarget] = useState<Delivery | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    applyPartnerPortalLightTheme();
  }, []);

  const [loginInfo, setLoginInfo] = useState<{
    isFirstLogin: boolean;
    passwordChanged: boolean;
    loginCount: number;
    lastLoginAt: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchLoginInfo = async () => {
      try {
        const res = await fetch("/api/partner/login-track");
        if (res.ok) {
          const info = await res.json();
          setLoginInfo(info);
        }
      } catch {
        /* graceful fail */
      }
    };
    fetchLoginInfo();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/portal-data");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = d?.detail || d?.error || `Failed to load (${res.status})`;
        console.error("portal-data error", res.status, d);
        setData(null);
        setPortalError(msg);
        setLoading(false);
        return;
      }
      setPortalError(null);
      setData(d);
    } catch (e) {
      console.error("portal-data fetch failed", e);
      setData(null);
      setPortalError("Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    containerRef: pullRef,
    pullDistance,
    refreshing,
  } = usePullToRefresh({
    onRefresh: loadData,
    disabled: loading,
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date();
  const dayStr = formatDate(today, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const isReturning =
    loginInfo && !loginInfo.isFirstLogin && loginInfo.loginCount > 1;

  // Resolve feature visibility:
  // - DB portal_features only override when the key is explicitly set (not just present)
  // - Type-based defaults still apply for keys not present in portal_features
  const hasPfProjects = pf.projects !== undefined;
  const hasPfDayRates = pf.day_rates !== undefined;
  const hasPfRecurring = pf.recurring_schedules !== undefined;
  const showProjects = hasPfProjects
    ? pf.projects === true
    : features.showProjects;
  const showDayRates = hasPfDayRates
    ? pf.day_rates === true
    : (features.showDayRates ?? true);
  const showRecurring = hasPfRecurring ? pf.recurring_schedules === true : true;
  const isDesignerOrg =
    orgType === "interior_designer" || orgType === "designer";

  const tabs = features.showReferrals
    ? [
        {
          key: "active",
          label: `Active (${data?.referrals.filter((r) => r.status !== "completed" && r.status !== "booked").length ?? 0})`,
        },
        {
          key: "completed",
          label: `Completed (${data?.referrals.filter((r) => r.status === "completed" || r.status === "booked").length ?? 0})`,
        },
        { key: "materials", label: "Materials" },
      ]
    : [
        { key: "today", label: `Today (${data?.todayDeliveries.length ?? 0})` },
        {
          key: "history",
          label: `History (${data?.allDeliveries?.filter((d) => ["completed", "delivered"].includes((d.status || "").toLowerCase())).length ?? 0})`,
        },
        { key: "calendar", label: "Calendar" },
        { key: "tracking", label: "Live Map" },
        { key: "inbound", label: "Inbound" },
        ...(showProjects
          ? [{ key: "b2b-projects", label: portalTerms.coordinationPlural }]
          : []),
        // Old gallery projects tab: only for art_gallery org type, not designers
        ...(!isDesignerOrg && features.showProjects
          ? [
              {
                key: "projects",
                label: `Gallery (${data?.projects?.length ?? 0})`,
              },
            ]
          : []),
        { key: "invoices", label: "Invoices" },
        { key: "billing", label: "Monthly Report" },
        ...(showRecurring ? [{ key: "recurring", label: "Recurring" }] : []),
        { key: "analytics", label: "Analytics" },
      ];

  const hasOverdueInvoices =
    data &&
    (data.invoices || []).some((inv) => {
      if (!inv.due_date) return false;
      const status = (inv.status || "").toLowerCase();
      if (status === "paid" || status === "void" || status === "cancelled")
        return false;
      return new Date(inv.due_date + "T23:59:59") < new Date();
    });

  if (!features.hasSelfServePortal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="max-w-md w-full rounded-2xl border border-[#2C3E2D]/12 bg-white p-8 text-center shadow-sm">
          <div className="flex justify-center mb-4">
            <YugoLogo size={24} variant="wine" />
          </div>
          <h1 className="font-semibold text-[var(--tx)] text-lg mb-2">
            No self-serve portal for this partner type
          </h1>
          <p className="text-sm text-[var(--tx3)] leading-relaxed mb-6">
            Your organization is set up without a partner dashboard.
            Coordinators will work with you directly for referrals and
            commissions.
          </p>
          <div className="flex justify-center">
            <PartnerSignOut />
          </div>
        </div>
      </div>
    );
  }

  if (features.showPropertyManagementPortal) {
    return (
      <PartnerPropertyManagementPortal
        orgId={orgId}
        orgName={headerOrgName}
        contactName={contactName}
        initialTab={initialPmTab}
      />
    );
  }

  return (
    <PartnerNotificationProvider orgId={orgId}>
      <PartnerChangePasswordGate>
        <div
          className="min-h-screen min-h-dvh w-full max-w-full min-w-0 overflow-x-clip bg-white text-[#1a1f1b]"
          data-theme="light"
        >
          {/* Header */}
          <header className="bg-white border-b border-[#2C3E2D]/12 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
              <YugoLogo size={19} variant="wine" />
              <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] shrink-0">
                BETA
              </span>
              <span
                className="h-3 w-px bg-[#2C3E2D]/12 shrink-0 hidden sm:block"
                aria-hidden
              />
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] truncate ml-0 sm:ml-1">
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

          <PartnerPortalWelcomeTour contactName={contactName} mode="standard" />

          <main
            ref={(el) => {
              pullRef.current = el;
            }}
            className="max-w-[1100px] mx-auto px-4 sm:px-8 py-5 sm:py-8 pb-[calc(var(--admin-mobile-nav-bar)+env(safe-area-inset-bottom,0px))] sm:pb-10"
          >
            {/* Pull-to-refresh indicator */}
            {(pullDistance > 0 || refreshing) && (
              <div
                className="fixed top-[52px] left-1/2 -translate-x-1/2 z-[--z-toast] flex items-center justify-center w-9 h-9 rounded-full bg-[var(--card)] border border-[var(--brd)] shadow-lg transition-transform"
                style={{ transform: `translate(-50%, ${pullDistance}px)` }}
                aria-live="polite"
              >
                {refreshing ? (
                  <span className="spinner w-4 h-4" />
                ) : (
                  <ArrowsClockwise
                    size={16}
                    color={FOREST}
                    style={{
                      transform: `rotate(${(pullDistance / 72) * 180}deg)`,
                      transition: "transform 0.1s",
                    }}
                    aria-hidden
                  />
                )}
              </div>
            )}
            {/* Full-page skeleton on initial load */}
            {loading && !data && (
              <div className="animate-pulse space-y-6 pt-2">
                <div className="h-9 w-48 bg-[var(--brd)] rounded-lg" />
                <div className="h-4 w-64 bg-[var(--brd)] rounded" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-[80px] bg-[var(--brd)] rounded-xl"
                    />
                  ))}
                </div>
                <div className="flex gap-2 border-b border-[var(--brd)]/30 pb-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 w-24 bg-[var(--brd)] rounded-t-lg"
                    />
                  ))}
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-[var(--brd)] rounded-xl" />
                  ))}
                </div>
              </div>
            )}

            {/* Returning user welcome-back banner */}
            {isReturning && loginInfo?.lastLoginAt && (
              <div
                className="mb-5 flex items-center gap-3 px-4 py-3 border-t border-[var(--brd)]/30 pt-5"
                style={{ animation: "fadeSlideUp 0.4s ease" }}
              >
                <div className="w-9 h-9 rounded-xl bg-[#F0FFF4] flex items-center justify-center flex-shrink-0">
                  <Check size={18} color="#2D6A4F" weight="bold" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[var(--text-base)] font-semibold text-[var(--tx)]">
                    Welcome back, {contactName}
                  </span>
                  <span className="text-[12px] text-[#4F4B47] ml-2">
                    Last visit:{" "}
                    {formatDateTime(loginInfo.lastLoginAt, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Hero + Greeting */}
            <div className="mb-6 pt-1">
              <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">
                Partner portal
              </p>
              <h1
                className="font-hero text-[28px] sm:text-[34px] md:text-[36px] font-normal leading-[1.08] tracking-tight break-words"
                style={{ color: WINE }}
              >
                {isReturning ? "Welcome back" : getPartnerGreeting()},{" "}
                {contactName}
              </h1>
              {features.showReferrals ? (
                <p className="text-[14px] text-[#5A6B5E] mt-2 leading-relaxed max-w-xl">
                  Your referral dashboard and commission tracking
                </p>
              ) : isDesignerOrg ? (
                <p className="text-[14px] text-[#5A6B5E] mt-2 leading-relaxed max-w-xl">
                  {data?.todayDeliveries && data.todayDeliveries.length > 0
                    ? `${data.todayDeliveries.length} ${data.todayDeliveries.length !== 1 ? "deliveries" : "delivery"} scheduled today`
                    : portalTerms.designerDashboardSubtitle}
                </p>
              ) : features.showProjects ? (
                <p className="text-[14px] text-[#5A6B5E] mt-2 leading-relaxed max-w-xl">
                  {portalTerms.activeCoordinationSummary(
                    data?.projects?.length ?? 0,
                    !!(
                      data &&
                      data.allDeliveries.some(
                        (d) => (d.status || "").toLowerCase() === "delayed",
                      )
                    ),
                  )}
                </p>
              ) : (
                <p className="text-[14px] text-[#5A6B5E] mt-2 leading-relaxed max-w-xl">
                  {dayStr} here are your deliveries
                </p>
              )}
            </div>

            {/* Overdue Invoice Banner */}
            {data &&
              (() => {
                const overdueInvoices = (data.invoices || []).filter((inv) => {
                  if (!inv.due_date) return false;
                  const status = (inv.status || "").toLowerCase();
                  if (
                    status === "paid" ||
                    status === "void" ||
                    status === "cancelled"
                  )
                    return false;
                  const due = new Date(inv.due_date + "T23:59:59");
                  return due < new Date();
                });
                if (overdueInvoices.length === 0) return null;
                const totalOverdue = overdueInvoices.reduce(
                  (sum, inv) => sum + (inv.amount || 0),
                  0,
                );
                return (
                  <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Warning size={16} color="#EF4444" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-red-600">
                        You have {overdueInvoices.length} overdue invoice
                        {overdueInvoices.length > 1 ? "s" : ""} totaling{" "}
                        {formatCurrency(totalOverdue)}
                      </div>
                      <div className="text-[11px] text-red-500/70 mt-0.5">
                        New bookings are paused until outstanding invoices are
                        paid. Please contact us or settle your balance to resume
                        scheduling.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("invoices")}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                    >
                      View Invoices
                    </button>
                  </div>
                );
              })()}

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-8">
              {!features.showReferrals && (
                <>
                  {features.canCreateDelivery && !hasOverdueInvoices && (
                    <div className="relative ml-0 sm:ml-1 hidden sm:block">
                      <button
                        type="button"
                        onClick={() =>
                          setBookServiceModalOpen(!bookServiceModalOpen)
                        }
                        className="w-9 h-9 flex items-center justify-center border border-[#2C3E2D]/35 text-[var(--tx)] bg-white text-[20px] font-light leading-none transition-colors hover:bg-[#2C3E2D]/[0.04] select-none rounded-sm"
                        title="Book a service"
                        aria-expanded={bookServiceModalOpen}
                      >
                        +
                      </button>

                      {bookServiceModalOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setBookServiceModalOpen(false)}
                          />
                          <div className="absolute left-0 top-full mt-2 z-50 w-[min(100vw-2rem,280px)] bg-white border border-[#2C3E2D]/12 overflow-hidden shadow-[0_20px_50px_rgba(44,62,45,0.1)] rounded-sm">
                            <div className="px-4 py-3 border-b border-[#2C3E2D]/10">
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]">
                                Book a service
                              </p>
                            </div>
                            <div className="py-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setBookServiceModalOpen(false);
                                  setScheduleModalKey((k) => k + 1);
                                  setScheduleOpen(true);
                                }}
                                className="w-full flex items-start gap-2 px-4 py-3 text-left border-b border-[#2C3E2D]/8 hover:bg-[#2C3E2D]/[0.03] transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--tx)] flex items-center gap-1">
                                    {portalTerms.scheduleDeliveryTitle}
                                    <CaretRight
                                      className="opacity-60"
                                      size={12}
                                      weight="bold"
                                      aria-hidden
                                    />
                                  </div>
                                  <div className="text-[11px] text-[#5A6B5E] mt-0.5 leading-snug font-normal normal-case tracking-normal">
                                    {portalTerms.scheduleDeliverySubtitle}
                                  </div>
                                </div>
                              </button>

                              {showDayRates && (
                                <Link
                                  href="/partner/book-day-rate"
                                  onClick={() => setBookServiceModalOpen(false)}
                                  className="flex items-start gap-2 px-4 py-3 text-left border-b border-[#2C3E2D]/8 hover:bg-[#2C3E2D]/[0.03] transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--tx)] flex items-center gap-1">
                                      Book day rate
                                      <CaretRight
                                        className="opacity-60"
                                        size={12}
                                        weight="bold"
                                        aria-hidden
                                      />
                                    </div>
                                    <div className="text-[11px] text-[#5A6B5E] mt-0.5 leading-snug font-normal normal-case tracking-normal">
                                      Full day crew and van
                                    </div>
                                  </div>
                                </Link>
                              )}

                              {showProjects && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookServiceModalOpen(false);
                                    setActiveTab("b2b-projects");
                                  }}
                                  className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-[#2C3E2D]/[0.03] transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--tx)] flex items-center gap-1">
                                      {portalTerms.newCoordinationCta}
                                      <CaretRight
                                        className="opacity-60"
                                        size={12}
                                        weight="bold"
                                        aria-hidden
                                      />
                                    </div>
                                    <div className="text-[11px] text-[#5A6B5E] mt-0.5 leading-snug font-normal normal-case tracking-normal">
                                      {portalTerms.newCoordinationSubtitle}
                                    </div>
                                  </div>
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {features.showProjects &&
                    data &&
                    data.allDeliveries.length > 0 && (
                      <button
                        onClick={() => setShareTarget(data.allDeliveries[0])}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#2C3E2D]/25 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx)] bg-transparent hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm"
                      >
                        <ShareNetwork size={14} weight="regular" />
                        Share with client
                        <CaretRight
                          size={12}
                          weight="bold"
                          className="opacity-50"
                          aria-hidden
                        />
                      </button>
                    )}
                  <button
                    onClick={() => setActiveTab("calendar")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#2C3E2D]/25 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx)] bg-transparent hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm"
                  >
                    <Calendar size={14} weight="regular" />
                    Calendar
                    <CaretRight
                      size={12}
                      weight="bold"
                      className="opacity-50"
                      aria-hidden
                    />
                  </button>
                  <button
                    onClick={() => setActiveTab("billing")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#2C3E2D]/25 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx)] bg-transparent hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm"
                  >
                    <ChartBar size={14} weight="regular" />
                    Monthly report
                    <CaretRight
                      size={12}
                      weight="bold"
                      className="opacity-50"
                      aria-hidden
                    />
                  </button>
                </>
              )}
            </div>

            {/* API error */}
            {portalError && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-[13px] flex items-center justify-between gap-4">
                <span>{portalError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPortalError(null);
                    setLoading(true);
                    loadData();
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 font-semibold hover:bg-red-500/30"
                >
                  Retry
                </button>
              </div>
            )}

            {/* KPI Stats */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse h-[80px]" />
                ))}
              </div>
            ) : features.showReferrals ? (
              <div className="mb-8">
                <RealtorKPIs data={data} />
              </div>
            ) : (
              <div className="mb-8">
                <DeliveryKPIs data={data} />
              </div>
            )}

            {/* Tabs, horizontally scrollable, no wrapping, no vertical movement */}
            <div className="overflow-hidden mb-2">
              <div
                className="flex items-center justify-start sm:justify-center gap-0 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-[#2C3E2D]/10 px-0 sm:px-2"
                style={{
                  touchAction: "pan-x",
                  overscrollBehaviorX: "contain",
                  overscrollBehaviorY: "none",
                }}
              >
                {tabs.map((t) => {
                  const hasCount = /\(\d+\)$/.test(t.label);
                  const href = "href" in t ? t.href : undefined;
                  if (href) {
                    return (
                      <Link
                        key={t.key}
                        href={href}
                        className={`flex-shrink-0 px-3 sm:px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase whitespace-nowrap border-b transition-colors -mb-px ${
                          hasCount ? "min-w-[6.5rem]" : "min-w-[4.5rem]"
                        } border-transparent text-[#5A6B5E] hover:text-[var(--tx2)]`}
                      >
                        {t.label}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`flex-shrink-0 px-3 sm:px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase whitespace-nowrap border-b transition-colors -mb-px ${
                        hasCount ? "min-w-[6.5rem]" : "min-w-[4.5rem]"
                      } ${
                        activeTab === t.key
                          ? "border-[#2C3E2D] text-[var(--tx)]"
                          : "border-transparent text-[#5A6B5E] hover:text-[var(--tx2)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div
                key={activeTab}
                className="pt-6 sm:pt-8 px-0 sm:px-1 tab-content"
              >
                {activeTab === "b2b-projects" && (
                  <PartnerB2BProjectsTab
                    initialProjectId={initialProjectId}
                    orgType={orgType}
                    portalTerms={portalTerms}
                    onScheduleDelivery={(suggestedItems) => {
                      setScheduleSuggestedItems(suggestedItems || null);
                      setScheduleModalKey((k) => k + 1);
                      setScheduleOpen(true);
                    }}
                  />
                )}
                {activeTab === "projects" && data && (
                  <PartnerProjectsTab
                    orgType={orgType}
                    portalTerms={portalTerms}
                    projects={(data.projects || []).map((p) => {
                      const projectDeliveries = data.allDeliveries.filter(
                        (d) =>
                          d.customer_name
                            ?.toLowerCase()
                            .includes((p.name || "").toLowerCase()) ||
                          d.delivery_address
                            ?.toLowerCase()
                            .includes((p.address || "").toLowerCase()),
                      );
                      const vendorList = projectDeliveries.map((d) => ({
                        vendor: d.client_name || d.delivery_number,
                        items: Array.isArray(d.items)
                          ? normalizeDeliveryItemsForDisplay(d.items)
                              .map((row) =>
                                row.qty > 1
                                  ? `${row.name} ×${row.qty}`
                                  : row.name,
                              )
                              .filter(Boolean)
                              .join(", ")
                          : "",
                        status:
                          (d.status || "").toLowerCase() === "delivered"
                            ? "done"
                            : (d.status || "").toLowerCase() === "in-transit" ||
                                (d.status || "").toLowerCase() === "in_transit"
                              ? "transit"
                              : (d.status || "").toLowerCase() === "cancelled"
                                ? "late"
                                : "wait",
                        eta: d.scheduled_date
                          ? new Date(
                              d.scheduled_date + "T00:00:00",
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "TBD",
                      }));
                      const delivered = vendorList.filter(
                        (v) => v.status === "done",
                      ).length;
                      const total = Math.max(vendorList.length, 1);
                      return {
                        id: p.id,
                        name: p.name,
                        address: p.address || "",
                        installDate: p.end_date
                          ? new Date(
                              p.end_date + "T00:00:00",
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "TBD",
                        percent: Math.round((delivered / total) * 100),
                        vendors: vendorList,
                        vendorCount: vendorList.length,
                        deliveredCount: delivered,
                        delayedCount: vendorList.filter(
                          (v) => v.status === "late",
                        ).length,
                      };
                    })}
                  />
                )}
                {activeTab === "today" && data && (
                  <PartnerDeliveriesTab
                    deliveries={data.todayDeliveries}
                    label="today"
                    onShare={(d) => setShareTarget(d as Delivery)}
                    onDetailClick={(d) => setDetailTarget(d)}
                    onEditClick={(d) => setEditTarget(d)}
                    onScheduleDelivery={() => {
                      setScheduleModalKey((k) => k + 1);
                      setScheduleOpen(true);
                    }}
                    orgType={orgType}
                  />
                )}
                {activeTab === "history" && data && (
                  <PartnerDeliveriesTab
                    deliveries={data.allDeliveries.filter((d) =>
                      ["completed", "delivered"].includes(
                        (d.status || "").toLowerCase(),
                      ),
                    )}
                    label="history"
                    onShare={(d) => setShareTarget(d as Delivery)}
                    onDetailClick={(d) => setDetailTarget(d)}
                    onEditClick={(d) => setEditTarget(d)}
                    orgType={orgType}
                  />
                )}
                {activeTab === "calendar" && data && (
                  <PartnerCalendarTab
                    deliveries={data.allDeliveries}
                    upcomingDeliveries={data.upcomingDeliveries}
                    onSelectDate={(date) => {
                      setScheduleInitialDate(date);
                      setScheduleModalKey((k) => k + 1);
                      setScheduleOpen(true);
                    }}
                    onDeliveryClick={(d) => setDetailTarget(d as Delivery)}
                    onShare={(d) => setShareTarget(d as Delivery)}
                    onDetailClick={(d) => setDetailTarget(d as Delivery)}
                    onEditClick={(d) => setEditTarget(d as Delivery)}
                    onRescheduled={loadData}
                    orgType={orgType}
                  />
                )}
                {activeTab === "tracking" && (
                  <PartnerLiveMapTab orgId={orgId} />
                )}
                {activeTab === "inbound" && <PartnerInboundShipmentsTab />}
                {activeTab === "invoices" && data && (
                  <PartnerInvoicesTab invoices={data.invoices} />
                )}
                {activeTab === "billing" && data && (
                  <PartnerBillingTab
                    data={data}
                    orgName={orgName}
                    statements={data.statements ?? []}
                    onViewInvoices={() => setActiveTab("invoices")}
                  />
                )}
                {activeTab === "recurring" && showRecurring && (
                  <PartnerRecurringTab orgId={orgId} />
                )}
                {activeTab === "analytics" && (
                  <PartnerAnalyticsTab orgId={orgId} orgName={orgName} />
                )}
                {activeTab === "active" && data && (
                  <PartnerRealtorTab
                    referrals={data.referrals.filter(
                      (r) => r.status !== "completed" && r.status !== "booked",
                    )}
                    mode="active"
                    orgId={orgId}
                    onRefresh={loadData}
                  />
                )}
                {activeTab === "completed" && data && (
                  <PartnerRealtorTab
                    referrals={data.referrals.filter(
                      (r) => r.status === "completed" || r.status === "booked",
                    )}
                    mode="completed"
                    orgId={orgId}
                    onRefresh={loadData}
                  />
                )}
                {activeTab === "materials" && <MaterialsTab />}
              </div>
            </div>
          </main>

          {/* Modals */}
          {scheduleOpen && (
            <PartnerScheduleModal
              key={scheduleModalKey}
              orgId={orgId}
              orgType={orgType}
              initialDate={scheduleInitialDate}
              initialItems={scheduleSuggestedItems ?? undefined}
              onClose={() => {
                setScheduleOpen(false);
                setScheduleInitialDate("");
                setScheduleSuggestedItems(null);
              }}
              onCreated={() => {
                setScheduleOpen(false);
                setScheduleInitialDate("");
                setScheduleSuggestedItems(null);
                loadData();
              }}
            />
          )}
          {shareTarget && (
            <PartnerShareModal
              delivery={shareTarget}
              onClose={() => setShareTarget(null)}
              onSent={() => toast("Tracking link sent", "check")}
            />
          )}
          {detailTarget && (
            <PartnerDeliveryDetailModal
              delivery={detailTarget}
              onClose={() => setDetailTarget(null)}
              onShare={() => {
                setShareTarget(detailTarget);
                setDetailTarget(null);
              }}
              onEdit={() => {
                setEditTarget(detailTarget);
                setDetailTarget(null);
              }}
            />
          )}
          {editTarget && (
            <PartnerEditDeliveryModal
              delivery={editTarget}
              onClose={() => setEditTarget(null)}
              onSaved={() => {
                setEditTarget(null);
                loadData();
                toast("Delivery updated", "check");
              }}
            />
          )}
          <PartnerSettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            orgName={orgName}
            contactName={contactName}
            userEmail={userEmail}
            orgType={orgType}
          />

          {/* Mobile bottom navigation, hidden on sm+ */}
          {!features.showReferrals && (
            <nav
              className="sm:hidden fixed bottom-0 left-0 right-0 z-[var(--z-topbar)] border-t border-[#2C3E2D]/10 flex items-stretch bg-white"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              aria-label="Main navigation"
            >
              {[
                {
                  key: "today",
                  label: "Today",
                  icon: (active: boolean) => (
                    <Calendar
                      size={22}
                      color={active ? FOREST : "var(--tx3)"}
                      weight={active ? "duotone" : "regular"}
                    />
                  ),
                },
                {
                  key: "calendar",
                  label: "Schedule",
                  icon: (active: boolean) => (
                    <ListBullets
                      size={22}
                      color={active ? FOREST : "var(--tx3)"}
                      weight={active ? "duotone" : "regular"}
                    />
                  ),
                },
                ...(features.canCreateDelivery && !hasOverdueInvoices
                  ? [
                      {
                        key: "__schedule__",
                        label: "Book",
                        icon: (_active: boolean) => (
                          <div className="w-10 h-10 flex items-center justify-center text-[var(--tx)] bg-white border border-[#2C3E2D]/35 -mt-3 rounded-sm">
                            <Plus size={20} color="#2C3E2D" weight="bold" />
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  key: "tracking",
                  label: "Map",
                  icon: (active: boolean) => (
                    <NavigationArrow
                      size={22}
                      color={active ? FOREST : "var(--tx3)"}
                      weight={active ? "duotone" : "regular"}
                    />
                  ),
                },
                {
                  key: "__settings__",
                  label: "Account",
                  icon: (active: boolean) => (
                    <UserCircle
                      size={22}
                      color={active ? FOREST : "var(--tx3)"}
                      weight={active ? "duotone" : "regular"}
                    />
                  ),
                },
              ].map(({ key, label, icon }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === "__schedule__") {
                        setScheduleModalKey((k) => k + 1);
                        setScheduleOpen(true);
                      } else if (key === "__settings__") {
                        setSettingsOpen(true);
                      } else setActiveTab(key);
                    }}
                    className={`flex-1 flex flex-col items-center justify-end gap-1 pb-2.5 pt-2 min-h-[52px] text-[10px] font-bold tracking-[0.08em] uppercase transition-colors touch-manipulation ${
                      isActive ? "text-[var(--tx)]" : "text-[#5A6B5E]"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {icon(isActive)}
                    {label}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </PartnerChangePasswordGate>
    </PartnerNotificationProvider>
  );
}

export default function PartnerPortalClient(props: Props) {
  return (
    <ToastProvider>
      <PartnerPortalInner {...props} />
    </ToastProvider>
  );
}

function DeliveryKPIs({ data }: { data: DashboardData | null }) {
  const cell =
    "text-center px-3 sm:px-6 py-1 md:border-l md:border-[#2C3E2D]/10 md:first:border-l-0";
  const label =
    "text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]/70";
  const figure =
    "text-[24px] sm:text-[28px] font-normal text-[var(--tx)] mt-1.5 font-hero leading-none";
  return (
    <div className="border-t border-[#2C3E2D]/10 pt-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-6 md:gap-y-0">
        <div className={cell}>
          <div className={label}>This month</div>
          <div className={figure}>{data?.completedThisMonth ?? 0}</div>
          <div className="text-[11px] text-[#2D9F5A] mt-1 font-medium min-h-[1rem]">
            {(data?.completedThisMonth ?? 0) > 0
              ? `+${data?.completedThisMonth} vs last`
              : "\u00a0"}
          </div>
        </div>
        <div className={cell}>
          <div className={label}>On-time rate</div>
          <div className={figure}>{data?.onTimeRate ?? 100}%</div>
        </div>
        <div className={cell}>
          <div className={label}>Outstanding</div>
          <div className={figure}>
            {formatCurrency(data?.outstandingAmount ?? 0)}
          </div>
          {data?.outstandingDueDate && (
            <div className="text-[11px] text-[#5A6B5E] mt-1">
              Due{" "}
              {new Date(data.outstandingDueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RealtorKPIs({ data }: { data: DashboardData | null }) {
  return (
    <div className="border-t border-[var(--brd)]/30 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="flex flex-col justify-center">
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#3D4F41]">
          Total Earned
        </div>
        <div className="text-[44px] font-bold text-[#2D9F5A] mt-2 font-hero">
          {formatCurrency(data?.totalEarned ?? 0)}
        </div>
        <div className="text-[12px] text-[#2D9F5A] mt-1 font-medium">
          {data?.completedReferrals ?? 0} completed move
          {(data?.completedReferrals ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--brd)] p-6 bg-[var(--card)]">
        <ReferralForm />
      </div>
    </div>
  );
}

function ReferralForm() {
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    property: "",
    move_date: "",
    tier: "standard",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/partner/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess(true);
        setForm({
          client_name: "",
          client_email: "",
          property: "",
          move_date: "",
          tier: "standard",
        });
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#3D4F41] mb-3">
        Submit New Referral
      </div>
      <div className="space-y-2">
        <input
          value={form.client_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, client_name: e.target.value }))
          }
          placeholder="Client full name"
          required
          className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#2C3E2D] focus:outline-none transition-colors bg-white"
        />
        <input
          value={form.client_email}
          onChange={(e) =>
            setForm((f) => ({ ...f, client_email: e.target.value }))
          }
          placeholder="Client email"
          type="email"
          className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#2C3E2D] focus:outline-none transition-colors bg-white"
        />
        <AddressAutocomplete
          value={form.property}
          onRawChange={(t) => setForm((f) => ({ ...f, property: t }))}
          onChange={(r) => setForm((f) => ({ ...f, property: r.fullAddress }))}
          placeholder="Property address"
          className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#2C3E2D] focus:outline-none transition-colors bg-white"
        />
        <input
          value={form.move_date}
          onChange={(e) =>
            setForm((f) => ({ ...f, move_date: e.target.value }))
          }
          placeholder="Target move date"
          type="date"
          className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#2C3E2D] focus:outline-none transition-colors bg-white"
        />
        <select
          value={form.tier}
          onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] focus:border-[#2C3E2D] focus:outline-none transition-colors bg-white"
        >
          <option value="standard">Essential</option>
          <option value="premium">Signature</option>
          <option value="luxury">Estate</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full mt-3 px-4 py-2.5 rounded-lg text-[12px] font-bold bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors disabled:opacity-50"
      >
        {submitting
          ? "Submitting..."
          : success
            ? "Referral submitted!"
            : "Submit referral"}
      </button>
    </form>
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
        onClick={onToggle}
        className="relative p-2 rounded-sm hover:bg-[#5C1A33]/[0.06] transition-colors"
      >
        <Bell size={18} color={WINE} weight="regular" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-[#5C1A33] text-white text-[8px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-xl overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]">
              <h3 className="text-[13px] font-bold text-[var(--tx)]">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] font-semibold text-[var(--tx)] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">
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
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--brd)] last:border-0 hover:bg-[var(--bg)] cursor-pointer transition-colors w-full text-left ${
                      !notif.read ? "bg-[#2C3E2D]/6" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5 w-4 flex items-center justify-center">
                      {!notif.read && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2C3E2D] opacity-50" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2C3E2D]" />
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0 mt-0.5 text-[var(--tx3)]">
                      <PartnerNotifIcon name={notif.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] leading-snug ${!notif.read ? "font-semibold text-[var(--tx)]" : "text-[var(--tx2)]"}`}
                      >
                        {notif.title}
                      </div>
                      {notif.body && (
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                          {notif.body}
                        </div>
                      )}
                      <div className="text-[9px] text-[#5A635C] mt-1">
                        {notif.time}
                      </div>
                    </div>
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

function PartnerNotifIcon({ name }: { name: string }) {
  const map: Record<string, React.ReactNode> = {
    check: <Check size={14} weight="regular" />,
    x: <X size={14} weight="regular" />,
    dollar: <Money size={14} weight="regular" />,
    clipboard: <ClipboardText size={14} weight="regular" />,
    calendar: <Calendar size={14} weight="regular" />,
    alertTriangle: <Warning size={14} weight="regular" />,
  };
  return <>{map[name] ?? <Bell size={14} />}</>;
}

function MaterialsTab() {
  const materials = [
    {
      name: "Yugo Service Guide (PDF)",
      desc: "Overview of all service tiers",
      icon: "doc",
    },
    {
      name: "Referral Program Overview",
      desc: "Commission structure and benefits",
      icon: "doc",
    },
    {
      name: "Client FAQ Sheet",
      desc: "Common questions your clients may ask",
      icon: "doc",
    },
  ];

  return (
    <div>
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#3D4F41] mb-4">
        Marketing Materials
      </div>
      <div className="space-y-0">
        {materials.map((m, i) => (
          <div
            key={m.name}
            className={`flex items-center justify-between py-4 ${i > 0 ? "border-t border-[var(--brd)]/30" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center">
                <FileText size={20} color={FOREST} />
              </div>
              <div>
                <div className="text-[var(--text-base)] font-semibold text-[var(--tx)]">
                  {m.name}
                </div>
                <div className="text-[12px] text-[var(--tx3)]">{m.desc}</div>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-[var(--bg)] transition-colors">
              <DownloadSimple size={18} color={FOREST} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
