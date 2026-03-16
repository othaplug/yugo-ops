"use client";

import { useState, useEffect, useCallback } from "react";
import { getPartnerFeatures, getPartnerGreeting } from "@/lib/partner-type";
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
import PartnerScheduleModal from "./PartnerScheduleModal";
import PartnerShareModal from "./PartnerShareModal";
import PartnerDeliveryDetailModal from "./PartnerDeliveryDetailModal";
import PartnerEditDeliveryModal from "./PartnerEditDeliveryModal";
import PartnerSettingsPanel from "./PartnerSettingsPanel";
import PartnerChangePasswordGate from "./PartnerChangePasswordGate";
import { PartnerNotificationProvider, usePartnerNotifications } from "./PartnerNotificationContext";
import { usePartnerOrgDisplayName } from "./PartnerOrgContext";
import YugoLogo from "@/components/YugoLogo";
import Link from "next/link";

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
  stops_detail?: { address: string; customer_name?: string | null; customer_phone?: string | null; items?: { name: string; size: string; quantity: number }[]; instructions?: string | null; zone?: number | null }[] | null;
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

export default function PartnerPortalClient({ orgId, orgName, orgType, contactName, userEmail, portalFeatures }: Props) {
  const headerOrgName = usePartnerOrgDisplayName();
  const features = getPartnerFeatures(orgType);
  // portal_features from DB override legacy type-based feature detection
  const pf: PortalFeatures = portalFeatures ?? {};
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(features.showReferrals ? "active" : "today");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleInitialDate, setScheduleInitialDate] = useState("");
  const [scheduleSuggestedItems, setScheduleSuggestedItems] = useState<string | null>(null);
  const [scheduleModalKey, setScheduleModalKey] = useState(0);
  const [bookServiceModalOpen, setBookServiceModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Delivery | null>(null);
  const [detailTarget, setDetailTarget] = useState<Delivery | null>(null);
  const [editTarget, setEditTarget] = useState<Delivery | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [partnerTheme, setPartnerTheme] = useState<string>("light");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("partner-theme") : null;
    const resolved = stored === "dark" ? "dark" : stored === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : "light";
    setPartnerTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");

    const onThemeChange = (e: Event) => {
      const r = (e as CustomEvent).detail || "light";
      setPartnerTheme(r);
    };
    window.addEventListener("partner-theme-change", onThemeChange);
    return () => window.removeEventListener("partner-theme-change", onThemeChange);
  }, []);

  const [loginInfo, setLoginInfo] = useState<{ isFirstLogin: boolean; passwordChanged: boolean; loginCount: number; lastLoginAt: string | null } | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);

  useEffect(() => {
    const fetchLoginInfo = async () => {
      try {
        const res = await fetch("/api/partner/login-track");
        if (res.ok) {
          const info = await res.json();
          setLoginInfo(info);
          const welcomeSeen = typeof window !== "undefined" && localStorage.getItem("yugo-welcome-seen");
          if (!welcomeSeen && (info.isFirstLogin || info.loginCount <= 1)) {
            setShowWelcome(true);
          }
        }
      } catch { /* graceful fail */ }
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

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date();
  const dayStr = formatDate(today, { weekday: "long", month: "long", day: "numeric" });
  const isReturning = loginInfo && !loginInfo.isFirstLogin && loginInfo.loginCount > 1;

  // Resolve feature visibility:
  // - DB portal_features only override when the key is explicitly set (not just present)
  // - Type-based defaults still apply for keys not present in portal_features
  const hasPfProjects = pf.projects !== undefined;
  const hasPfDayRates = pf.day_rates !== undefined;
  const hasPfRecurring = pf.recurring_schedules !== undefined;
  const showProjects = hasPfProjects ? (pf.projects === true) : features.showProjects;
  const showDayRates = hasPfDayRates ? (pf.day_rates === true) : features.showDayRates ?? true;
  const showRecurring = hasPfRecurring ? (pf.recurring_schedules === true) : true;
  const isDesignerOrg = orgType === "interior_designer" || orgType === "designer";

  const tabs = features.showReferrals
    ? [
        { key: "active", label: `Active (${data?.referrals.filter((r) => r.status !== "completed" && r.status !== "booked").length ?? 0})` },
        { key: "completed", label: `Completed (${data?.referrals.filter((r) => r.status === "completed" || r.status === "booked").length ?? 0})` },
        { key: "materials", label: "Materials" },
      ]
    : [
        { key: "today", label: `Today (${data?.todayDeliveries.length ?? 0})` },
        { key: "history", label: `History (${data?.allDeliveries?.filter((d) => ["completed", "delivered"].includes((d.status || "").toLowerCase())).length ?? 0})` },
        { key: "calendar", label: "Calendar" },
        { key: "tracking", label: "Live Map" },
        ...(showProjects ? [{ key: "b2b-projects", label: "Projects" }] : []),
        // Old gallery projects tab: only for art_gallery org type, not designers
        ...(!isDesignerOrg && features.showProjects ? [{ key: "projects", label: `Gallery (${data?.projects?.length ?? 0})` }] : []),
        { key: "invoices", label: "Invoices" },
        { key: "billing", label: "Monthly Report" },
        ...(showRecurring ? [{ key: "recurring", label: "Recurring" }] : []),
        { key: "analytics", label: "Analytics" },
      ];

  const hasOverdueInvoices = data && (data.invoices || []).some((inv) => {
    if (!inv.due_date) return false;
    const status = (inv.status || "").toLowerCase();
    if (status === "paid" || status === "void" || status === "cancelled") return false;
    return new Date(inv.due_date + "T23:59:59") < new Date();
  });

  return (
    <PartnerNotificationProvider orgId={orgId}>
    <PartnerChangePasswordGate>
    <div className={`min-h-screen ${partnerTheme === "dark" ? "bg-[var(--bg)]" : "bg-[#F5F3F0]"}`} data-theme={partnerTheme}>
      {/* Header */}
      <header className="bg-[var(--card)]/95 backdrop-blur border-b border-[var(--brd)] px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-1.5">
          <YugoLogo size={19} variant={partnerTheme === "dark" ? "gold" : "black"} />
          <span className="text-[7px] font-semibold tracking-[1px] uppercase text-[var(--gold)] opacity-50">BETA</span>
          <span className="text-[13px] text-[var(--tx3)] font-medium ml-1.5">{headerOrgName}</span>
        </div>
        <div className="flex items-center gap-3">
          <PartnerNotificationBell
            open={notifOpen}
            onToggle={() => setNotifOpen(!notifOpen)}
            onClose={() => setNotifOpen(false)}
          />
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#C9A962] flex items-center justify-center text-white text-[11px] font-bold cursor-pointer" onClick={() => setSettingsOpen(true)}>
            {contactName.charAt(0).toUpperCase()}{(contactName.split(" ")[1] || "").charAt(0).toUpperCase() || contactName.charAt(1)?.toUpperCase() || ""}
          </div>
        </div>
      </header>

      {/* First-time Welcome Overlay */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 overflow-hidden" style={{ animation: "fadeSlideUp 0.4s ease" }}>
            <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pt-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-full transition-all duration-300" style={{
                  width: i === welcomeStep ? 24 : 8, height: 8,
                  background: i === welcomeStep ? "#2D6A4F" : i < welcomeStep ? "#C9A962" : "#E8E4DF",
                }} />
              ))}
            </div>

            <div className="p-8 pb-6">
              {welcomeStep === 0 && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#C9A962]/10 border border-[#C9A962]/20 flex items-center justify-center">
                    <span className="text-[30px]" role="img" aria-label="wave">&#128075;</span>
                  </div>
                  <h2 className="font-hero text-[36px] font-semibold text-[#1A1714] mb-2">Welcome to YUGO+, {contactName}!</h2>
                  <p className="text-[14px] text-[#888] leading-relaxed max-w-[380px] mx-auto">
                    Your dedicated partner portal is ready. Let&apos;s take a quick tour of what you can do here.
                  </p>
                </div>
              )}

              {welcomeStep === 1 && (
                <div>
                  <h3 className="font-hero text-[26px] font-semibold text-[#1A1714] mb-5">Here&apos;s what you can do</h3>
                  <div className="space-y-3">
                    {[
                      { icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", circle: "cx='12' cy='10' r='3'", color: "#2D6A4F", bg: "#F0FFF4", title: "Track Deliveries Live", desc: "GPS tracking with real-time crew locations on a map" },
                      { icon: "M3 4h18v18H3z rx='2'", lines: true, color: "#8B5CF6", bg: "#F5F3FF", title: "Schedule & Calendar", desc: "View upcoming deliveries in calendar view, schedule new ones" },
                      { icon: "M18 5 6 12 18 19", share: true, color: "#C9A962", bg: "#FFFBF0", title: "Share Tracking Links", desc: "Send live tracking links to your end clients via email" },
                      { icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", color: "#059669", bg: "#ECFDF5", title: "Invoices & Monthly Report", desc: "View invoices, monthly performance, and SLA report" },
                    ].map((item) => (
                      <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: item.bg }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}15` }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={item.icon} />
                            {item.circle && <circle cx={12} cy={10} r={3} />}
                          </svg>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#1A1714]">{item.title}</div>
                          <div className="text-[12px] text-[#888]">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {welcomeStep === 2 && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF5F5] border border-[#FED7D7] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                  <h3 className="font-hero text-[26px] font-semibold text-[#1A1714] mb-2">Secure your account</h3>
                  <p className="text-[14px] text-[#888] leading-relaxed max-w-[360px] mx-auto mb-4">
                    For your security, we strongly recommend changing your password to something personal and memorable.
                  </p>
                  <a
                    href="/update-password"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[#E53E3E] text-white hover:bg-[#C53030] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change Password Now
                  </a>
                  <button
                    onClick={() => setWelcomeStep(3)}
                    className="block mx-auto mt-3 text-[12px] text-[#999] hover:text-[#666] transition-colors"
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    I&apos;ll do this later
                  </button>
                </div>
              )}

              {welcomeStep === 3 && (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F0FFF4] border border-[#C6F6D5] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <h3 className="font-hero text-[26px] font-semibold text-[#1A1714] mb-2">You&apos;re all set!</h3>
                  <p className="text-[14px] text-[#888] leading-relaxed max-w-[360px] mx-auto">
                    Your portal is ready. If you need help at any time, reach out to your Yugo account manager.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-8 pb-8">
              {welcomeStep < 3 ? (
                <div className="flex gap-3">
                  {welcomeStep > 0 && (
                    <button
                      onClick={() => setWelcomeStep(welcomeStep - 1)}
                      className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#666] hover:bg-[#F5F3F0] transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => setWelcomeStep(welcomeStep + 1)}
                    className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors"
                  >
                    {welcomeStep === 0 ? "Get Started" : "Next"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowWelcome(false); try { localStorage.setItem("yugo-welcome-seen", "1"); } catch {} }}
                  className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Returning user welcome-back banner */}
        {isReturning && loginInfo?.lastLoginAt && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 border-t border-[var(--brd)]/30 pt-5" style={{ animation: "fadeSlideUp 0.4s ease" }}>
            <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div className="w-9 h-9 rounded-xl bg-[#F0FFF4] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[14px] font-semibold text-[var(--tx)]">Welcome back, {contactName}</span>
              <span className="text-[12px] text-[#888] ml-2">
                Last visit: {formatDateTime(loginInfo.lastLoginAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Hero + Greeting */}
        <div className="mb-6">
          <h1 className="font-hero text-[36px] sm:text-[36px] font-semibold text-[var(--tx)] leading-tight tracking-tight">
            {isReturning ? "Welcome back" : getPartnerGreeting()}, {contactName}
          </h1>
          {features.showReferrals ? (
            <p className="text-[15px] text-[var(--tx3)] mt-1.5">Your referral dashboard and commission tracking</p>
          ) : features.showProjects ? (
            <p className="text-[15px] text-[var(--tx3)] mt-1.5">
              {data?.projects?.length ?? 0} active project{(data?.projects?.length ?? 0) !== 1 ? "s" : ""}
              {data && data.allDeliveries.some((d) => (d.status || "").toLowerCase() === "delayed") ? " · 1 vendor delay requiring attention" : ""}
            </p>
          ) : (
            <p className="text-[15px] text-[var(--tx3)] mt-1.5">{dayStr} — here are your deliveries</p>
          )}
        </div>

        {/* Overdue Invoice Banner */}
        {data && (() => {
          const overdueInvoices = (data.invoices || []).filter((inv) => {
            if (!inv.due_date) return false;
            const status = (inv.status || "").toLowerCase();
            if (status === "paid" || status === "void" || status === "cancelled") return false;
            const due = new Date(inv.due_date + "T23:59:59");
            return due < new Date();
          });
          if (overdueInvoices.length === 0) return null;
          const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
          return (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-red-600 dark:text-red-400">
                  You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""} totaling {formatCurrency(totalOverdue)}
                </div>
                <div className="text-[11px] text-red-500/70 dark:text-red-400/60 mt-0.5">
                  New bookings are paused until outstanding invoices are paid. Please contact us or settle your balance to resume scheduling.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("invoices")}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
              >
                View Invoices
              </button>
            </div>
          );
        })()}

        <div className="flex flex-wrap gap-2.5 mb-6">
          {!features.showReferrals && (
            <>
              {features.canCreateDelivery && !hasOverdueInvoices && (
                <button
                  type="button"
                  onClick={() => setBookServiceModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white border border-[#2D6A4F] hover:bg-[#245c42] hover:border-[#245c42] transition-colors"
                >
                  <span>Book a service</span>
                </button>
              )}
              {features.showProjects && data && data.allDeliveries.length > 0 && (
                <button
                  onClick={() => setShareTarget(data.allDeliveries[0])}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--card)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share with Client
                </button>
              )}
              <button
                onClick={() => setActiveTab("calendar")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--card)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Calendar
              </button>
              <button
                onClick={() => setActiveTab("billing")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--card)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Monthly Report
              </button>
            </>
          )}
        </div>

        {/* Book a service modal */}
        {bookServiceModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setBookServiceModalOpen(false)}
          >
            <div
              className="bg-[var(--card)] rounded-t-[28px] sm:rounded-[28px] shadow-2xl w-full sm:max-w-[480px] overflow-hidden"
              style={{ boxShadow: "0 -8px 60px rgba(0,0,0,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-0 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-[var(--brd)]" />
              </div>

              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[22px] font-bold text-[var(--tx)]">Book a service</h3>
                  <p className="text-[13px] text-[var(--tx3)] mt-1">Select the service that fits your needs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookServiceModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className={`px-5 pb-4 grid gap-3 ${showDayRates ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                <button
                  type="button"
                  onClick={() => { setBookServiceModalOpen(false); setScheduleModalKey((k) => k + 1); setScheduleOpen(true); }}
                  className="text-left p-5 rounded-2xl border-2 border-[var(--brd)] hover:border-[#2D6A4F]/40 bg-[var(--bg)] hover:bg-[#2D6A4F]/[0.04] transition-all group"
                >
                  <div className="text-[15px] font-bold text-[var(--tx)] mb-1">Schedule Delivery</div>
                  <div className="text-[11px] text-[var(--tx3)] leading-relaxed">Single pickup to single drop-off. Best for 1-3 items.</div>
                  <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-[#2D6A4F] group-hover:gap-2 transition-all">
                    Get started <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </button>
                {showDayRates && (
                  <Link
                    href="/partner/book-day-rate"
                    onClick={() => setBookServiceModalOpen(false)}
                    className="text-left p-5 rounded-2xl border-2 border-[var(--brd)] hover:border-[var(--gold)]/40 bg-[var(--bg)] hover:bg-[var(--gold)]/[0.04] transition-all group block"
                  >
                    <div className="text-[15px] font-bold text-[var(--tx)] mb-1">Book Day Rate</div>
                    <div className="text-[11px] text-[var(--tx3)] leading-relaxed">Dedicated truck and crew for the full day. Best for 4+ stops.</div>
                    <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-[var(--gold)] group-hover:gap-2 transition-all">
                      Get started <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </Link>
                )}
              </div>

              <div className="px-5 pb-6 pt-1 sm:hidden">
                <button
                  type="button"
                  onClick={() => setBookServiceModalOpen(false)}
                  className="w-full py-3 rounded-full text-[13px] font-semibold text-[var(--tx3)] border border-[var(--brd)] hover:bg-[var(--bg)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API error */}
        {portalError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-[13px] flex items-center justify-between gap-4">
            <span>{portalError}</span>
            <button
              type="button"
              onClick={() => { setPortalError(null); setLoading(true); loadData(); }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 font-semibold hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[1,2,3,4].map((i) => (
              <div key={i} className="animate-pulse h-[80px]" />
            ))}
          </div>
        ) : features.showReferrals ? (
          <div className="mb-8"><RealtorKPIs data={data} /></div>
        ) : (
          <div className="mb-8"><DeliveryKPIs data={data} /></div>
        )}

        {/* Tabs — fixed min-widths so counts (e.g. Today (0)) don't cause layout shift */}
        <div className="overflow-hidden mb-4">
          <div className="flex flex-wrap justify-center gap-0 overflow-x-auto scrollbar-hide border-b border-[var(--brd)]/30 px-2 sm:px-4">
            {tabs.map((t) => {
              const hasCount = /\(\d+\)$/.test(t.label);
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex-shrink-0 px-4 py-3.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                    hasCount ? "min-w-[7rem]" : "min-w-[5rem]"
                  } ${
                    activeTab === t.key
                      ? "border-[var(--gold)] text-[var(--gold)]"
                      : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

        {/* Tab Content */}
        <div key={activeTab} className="p-4 sm:p-6 tab-content">
          {activeTab === "b2b-projects" && (
            <PartnerB2BProjectsTab
              onScheduleDelivery={(suggestedItems) => {
                setScheduleSuggestedItems(suggestedItems || null);
                setScheduleModalKey((k) => k + 1);
                setScheduleOpen(true);
              }}
            />
          )}
          {activeTab === "projects" && data && (
            <PartnerProjectsTab
              projects={(data.projects || []).map((p) => {
                const projectDeliveries = data.allDeliveries.filter((d) =>
                  d.customer_name?.toLowerCase().includes((p.name || "").toLowerCase()) ||
                  d.delivery_address?.toLowerCase().includes((p.address || "").toLowerCase())
                );
                const vendorList = projectDeliveries.map((d) => ({
                  vendor: d.client_name || d.delivery_number,
                  items: Array.isArray(d.items) ? d.items.map((i: unknown) => typeof i === "string" ? i : (i as {name?: string})?.name || "").join(", ") : "",
                  status: (d.status || "").toLowerCase() === "delivered" ? "done"
                    : (d.status || "").toLowerCase() === "in-transit" || (d.status || "").toLowerCase() === "in_transit" ? "transit"
                    : (d.status || "").toLowerCase() === "cancelled" ? "late"
                    : "wait",
                  eta: d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD",
                }));
                const delivered = vendorList.filter((v) => v.status === "done").length;
                const total = Math.max(vendorList.length, 1);
                return {
                  id: p.id,
                  name: p.name,
                  address: p.address || "",
                  installDate: p.end_date ? new Date(p.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD",
                  percent: Math.round((delivered / total) * 100),
                  vendors: vendorList,
                  vendorCount: vendorList.length,
                  deliveredCount: delivered,
                  delayedCount: vendorList.filter((v) => v.status === "late").length,
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
              onScheduleDelivery={() => { setScheduleModalKey((k) => k + 1); setScheduleOpen(true); }}
              orgType={orgType}
            />
          )}
          {activeTab === "history" && data && (
            <PartnerDeliveriesTab
              deliveries={data.allDeliveries.filter((d) => ["completed", "delivered"].includes((d.status || "").toLowerCase()))}
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
              orgType={orgType}
            />
          )}
          {activeTab === "tracking" && (
            <PartnerLiveMapTab orgId={orgId} />
          )}
          {activeTab === "invoices" && data && (
            <PartnerInvoicesTab invoices={data.invoices} />
          )}
          {activeTab === "billing" && data && (
            <PartnerBillingTab data={data} orgName={orgName} onViewInvoices={() => setActiveTab("invoices")} />
          )}
          {activeTab === "recurring" && showRecurring && (
            <PartnerRecurringTab orgId={orgId} />
          )}
          {activeTab === "analytics" && (
            <PartnerAnalyticsTab orgId={orgId} orgName={orgName} />
          )}
          {activeTab === "active" && data && (
            <PartnerRealtorTab
              referrals={data.referrals.filter((r) => r.status !== "completed" && r.status !== "booked")}
              mode="active"
              orgId={orgId}
              onRefresh={loadData}
            />
          )}
          {activeTab === "completed" && data && (
            <PartnerRealtorTab
              referrals={data.referrals.filter((r) => r.status === "completed" || r.status === "booked")}
              mode="completed"
              orgId={orgId}
              onRefresh={loadData}
            />
          )}
          {activeTab === "materials" && (
            <MaterialsTab />
          )}
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
          onClose={() => { setScheduleOpen(false); setScheduleInitialDate(""); setScheduleSuggestedItems(null); }}
          onCreated={() => { setScheduleOpen(false); setScheduleInitialDate(""); setScheduleSuggestedItems(null); loadData(); }}
        />
      )}
      {shareTarget && (
        <PartnerShareModal
          delivery={shareTarget}
          onClose={() => setShareTarget(null)}
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
          onSaved={() => { setEditTarget(null); loadData(); }}
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
    </div>
    </PartnerChangePasswordGate>
    </PartnerNotificationProvider>
  );
}

function DeliveryKPIs({ data }: { data: DashboardData | null }) {
  return (
    <div className="border-t border-[var(--brd)]/30 pt-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">This Month</div>
          <div className="text-[26px] sm:text-[30px] font-bold text-[var(--tx)] mt-1 font-hero">{data?.completedThisMonth ?? 0}</div>
          <div className="text-[11px] text-[#2D9F5A] mt-0.5 font-medium">
            {(data?.completedThisMonth ?? 0) > 0 ? `+${data?.completedThisMonth} vs last` : ""}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">On-Time Rate</div>
          <div className="text-[26px] sm:text-[30px] font-bold text-[#22C55E] mt-1 font-hero">{data?.onTimeRate ?? 100}%</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Satisfaction</div>
          <div className="text-[26px] sm:text-[30px] font-bold text-[#C9A962] mt-1 font-hero">{data?.satisfactionScore ?? "—"}</div>
          {data?.satisfactionScore != null && (
            <div className="text-[11px] text-[var(--tx3)] mt-0.5">out of 5</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Outstanding</div>
          <div className="text-[26px] sm:text-[30px] font-bold text-[var(--tx)] mt-1 font-hero">{formatCurrency(data?.outstandingAmount ?? 0)}</div>
          {data?.outstandingDueDate && (
            <div className="text-[11px] text-[var(--tx3)] mt-0.5">Due {new Date(data.outstandingDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
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
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Total Earned</div>
        <div className="text-[44px] font-bold text-[#2D9F5A] mt-2 font-hero">{formatCurrency(data?.totalEarned ?? 0)}</div>
        <div className="text-[12px] text-[#2D9F5A] mt-1 font-medium">
          {data?.completedReferrals ?? 0} completed move{(data?.completedReferrals ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--brd)] p-6 bg-[var(--card)]">
        <ReferralForm />
      </div>
    </div>
  );
}

function ReferralForm() {
  const [form, setForm] = useState({ client_name: "", client_email: "", property: "", move_date: "", tier: "standard" });
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
        setForm({ client_name: "", client_email: "", property: "", move_date: "", tier: "standard" });
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Submit New Referral</div>
      <div className="space-y-2">
        <input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Client full name" required className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <input value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} placeholder="Client email" type="email" className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <input value={form.property} onChange={(e) => setForm((f) => ({ ...f, property: e.target.value }))} placeholder="Property address" className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <input value={form.move_date} onChange={(e) => setForm((f) => ({ ...f, move_date: e.target.value }))} placeholder="Target move date" type="date" className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] focus:border-[#C9A962] focus:outline-none transition-colors bg-white">
          <option value="standard">Curated</option>
          <option value="premium">Signature</option>
          <option value="luxury">Estate</option>
        </select>
      </div>
      <button type="submit" disabled={submitting} className="w-full mt-3 px-4 py-2.5 rounded-lg text-[12px] font-bold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors disabled:opacity-50">
        {submitting ? "Submitting..." : success ? "Referral Submitted!" : "Submit Referral"}
      </button>
    </form>
  );
}

function PartnerNotificationBell({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = usePartnerNotifications();
  const ref = { current: null as HTMLDivElement | null };

  return (
    <div className="relative" ref={(el) => { ref.current = el; }}>
      <button
        onClick={onToggle}
        className="relative p-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-[#C9A962] text-white text-[8px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-xl overflow-hidden animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]">
              <h3 className="text-[13px] font-bold text-[var(--tx)]">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[10px] font-semibold text-[#C9A962] hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">All caught up!</div>
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
                      !notif.read ? "bg-[#C9A962]/5" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5 w-4 flex items-center justify-center">
                      {!notif.read && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9A962] opacity-50" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A962]" />
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0 mt-0.5 text-[var(--tx3)]">
                      <PartnerNotifIcon name={notif.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] leading-snug ${!notif.read ? "font-semibold text-[var(--tx)]" : "text-[var(--tx2)]"}`}>
                        {notif.title}
                      </div>
                      {notif.body && (
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                          {notif.body}
                        </div>
                      )}
                      <div className="text-[9px] text-[var(--tx3)]/60 mt-1">{notif.time}</div>
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
  const props = { width: 14, height: 14, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "check": return <svg {...props}><path d="M20 6 9 17l-5-5" /></svg>;
    case "truck": return <svg {...props}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18h2" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /></svg>;
    case "x": return <svg {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
    case "dollar": return <svg {...props}><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
    case "clipboard": return <svg {...props}><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>;
    case "calendar": return <svg {...props}><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case "alertTriangle": return <svg {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
    default: return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
  }
}

function MaterialsTab() {
  const materials = [
    { name: "Yugo Service Guide (PDF)", desc: "Overview of all service tiers", icon: "doc" },
    { name: "Referral Program Overview", desc: "Commission structure and benefits", icon: "doc" },
    { name: "Client FAQ Sheet", desc: "Common questions your clients may ask", icon: "doc" },
  ];

  return (
    <div>
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Marketing Materials</div>
      <div className="space-y-0">
        {materials.map((m, i) => (
          <div key={m.name} className={`flex items-center justify-between py-4 ${i > 0 ? "border-t border-[var(--brd)]/30" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[var(--tx)]">{m.name}</div>
                <div className="text-[12px] text-[var(--tx3)]">{m.desc}</div>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-[var(--bg)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
