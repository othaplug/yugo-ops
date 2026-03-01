"use client";

import { useState, useEffect, useCallback } from "react";
import { getPartnerFeatures, getPartnerGreeting } from "@/lib/partner-type";
import { formatCurrency } from "@/lib/format-currency";
import PartnerSignOut from "./PartnerSignOut";
import PartnerDeliveriesTab from "./tabs/PartnerDeliveriesTab";
import PartnerCalendarTab from "./tabs/PartnerCalendarTab";
import PartnerInvoicesTab from "./tabs/PartnerInvoicesTab";
import PartnerBillingTab from "./tabs/PartnerBillingTab";
import PartnerLiveMapTab from "./tabs/PartnerLiveMapTab";
import PartnerRealtorTab from "./tabs/PartnerRealtorTab";
import PartnerProjectsTab from "./tabs/PartnerProjectsTab";
import PartnerScheduleModal from "./PartnerScheduleModal";
import PartnerShareModal from "./PartnerShareModal";

interface Props {
  orgId: string;
  orgName: string;
  orgType: string;
  contactName: string;
  userEmail: string;
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
  damageClaims: number;
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

export default function PartnerPortalClient({ orgId, orgName, orgType, contactName, userEmail }: Props) {
  const features = getPartnerFeatures(orgType);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(features.showReferrals ? "active" : features.showProjects ? "projects" : "today");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Delivery | null>(null);

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
          if (info.isFirstLogin || info.loginCount <= 1) setShowWelcome(true);
        }
      } catch { /* graceful fail */ }
    };
    fetchLoginInfo();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/portal-data");
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date();
  const dayStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isReturning = loginInfo && !loginInfo.isFirstLogin && loginInfo.loginCount > 1;

  const tabs = features.showReferrals
    ? [
        { key: "active", label: `Active (${data?.referrals.filter((r) => r.status !== "completed" && r.status !== "booked").length ?? 0})` },
        { key: "completed", label: `Completed (${data?.referrals.filter((r) => r.status === "completed" || r.status === "booked").length ?? 0})` },
        { key: "materials", label: "Materials" },
      ]
    : [
        ...(features.showProjects ? [{ key: "projects", label: `Projects (${data?.projects?.length ?? 0})` }] : []),
        { key: "today", label: `Today (${data?.todayDeliveries.length ?? 0})` },
        { key: "upcoming", label: "Upcoming" },
        { key: "calendar", label: "Calendar" },
        { key: "tracking", label: "Live Map" },
        { key: "invoices", label: "Invoices" },
        { key: "billing", label: "Billing" },
      ];

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#E8E4DF] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="font-serif text-[18px] tracking-[1px] text-[#1A1A1A] font-semibold">YUGO</span>
          <span className="text-[13px] text-[#666] font-medium">{orgName}</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-[#C9A962]/15 text-[#C9A962] border border-[#C9A962]/30">OPS+</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-[#C9A962] flex items-center justify-center text-white text-[11px] font-bold">
            {contactName.charAt(0).toUpperCase()}{(contactName.split(" ")[1] || "").charAt(0).toUpperCase() || contactName.charAt(1)?.toUpperCase() || ""}
          </div>
          <PartnerSignOut />
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
                    <span className="text-[28px]" role="img" aria-label="wave">&#128075;</span>
                  </div>
                  <h2 className="font-serif text-[28px] font-semibold text-[#1A1714] mb-2">Welcome to OPS+, {contactName}!</h2>
                  <p className="text-[14px] text-[#888] leading-relaxed max-w-[380px] mx-auto">
                    Your dedicated partner portal is ready. Let&apos;s take a quick tour of what you can do here.
                  </p>
                </div>
              )}

              {welcomeStep === 1 && (
                <div>
                  <h3 className="font-serif text-[22px] font-semibold text-[#1A1714] mb-5">Here&apos;s what you can do</h3>
                  <div className="space-y-3">
                    {[
                      { icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", circle: "cx='12' cy='10' r='3'", color: "#2D6A4F", bg: "#F0FFF4", title: "Track Deliveries Live", desc: "GPS tracking with real-time crew locations on a map" },
                      { icon: "M3 4h18v18H3z rx='2'", lines: true, color: "#8B5CF6", bg: "#F5F3FF", title: "Schedule & Calendar", desc: "View upcoming deliveries in calendar view, schedule new ones" },
                      { icon: "M18 5 6 12 18 19", share: true, color: "#C9A962", bg: "#FFFBF0", title: "Share Tracking Links", desc: "Send live tracking links to your end clients via email" },
                      { icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", color: "#059669", bg: "#ECFDF5", title: "Invoices & Billing", desc: "View invoices, billing history, and SLA performance" },
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
                  <h3 className="font-serif text-[22px] font-semibold text-[#1A1714] mb-2">Secure your account</h3>
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
                  <h3 className="font-serif text-[22px] font-semibold text-[#1A1714] mb-2">You&apos;re all set!</h3>
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
                  onClick={() => setShowWelcome(false)}
                  className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Returning user welcome-back banner */}
        {isReturning && loginInfo?.lastLoginAt && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#E8E4DF]" style={{ animation: "fadeSlideUp 0.4s ease" }}>
            <style>{`@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div className="w-8 h-8 rounded-lg bg-[#F0FFF4] flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-[#1A1714]">Welcome back, {contactName}</span>
              <span className="text-[12px] text-[#999] ml-2">
                Last visit: {new Date(loginInfo.lastLoginAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Greeting */}
        <h1 className="font-serif text-[26px] sm:text-[30px] font-semibold text-[#1A1A1A] leading-tight">
          {isReturning ? "Welcome back" : getPartnerGreeting()}, {contactName}
        </h1>
        {features.showReferrals ? (
          <p className="text-[14px] text-[#888] mt-1">Your referral dashboard and commission tracking</p>
        ) : features.showProjects ? (
          <p className="text-[14px] text-[#888] mt-1">
            {data?.projects?.length ?? 0} active project{(data?.projects?.length ?? 0) !== 1 ? "s" : ""}
            {data && data.allDeliveries.some((d) => (d.status || "").toLowerCase() === "delayed") ? " · 1 vendor delay requiring attention" : ""}
          </p>
        ) : (
          <p className="text-[14px] text-[#888] mt-1">{dayStr} — here are your deliveries</p>
        )}

        {/* Primary Actions */}
        <div className="flex flex-wrap gap-2 mt-5">
          {features.canCreateDelivery && (
            <button
              onClick={() => setScheduleOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Schedule Delivery
            </button>
          )}
          {!features.showReferrals && (
            <>
              {features.showProjects && (
                <button
                  onClick={() => {/* share with client placeholder */}}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-white text-[#1A1A1A] border border-[#E8E4DF] hover:border-[#C9A962] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share with Client
                </button>
              )}
              <button
                onClick={() => setActiveTab("calendar")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-white text-[#1A1A1A] border border-[#E8E4DF] hover:border-[#C9A962] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Calendar
              </button>
              <button
                onClick={() => setActiveTab("billing")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-white text-[#1A1A1A] border border-[#E8E4DF] hover:border-[#C9A962] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Monthly Report
              </button>
            </>
          )}
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="bg-white border border-[#E8E4DF] rounded-xl p-4 animate-pulse h-[90px]" />
            ))}
          </div>
        ) : features.showReferrals ? (
          <RealtorKPIs data={data} />
        ) : (
          <DeliveryKPIs data={data} />
        )}

        {/* Tabs */}
        <div className="mt-6 border-b border-[#E8E4DF]">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === t.key
                    ? "border-[#C9A962] text-[#C9A962]"
                    : "border-transparent text-[#888] hover:text-[#1A1A1A]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
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
              onShare={(d) => setShareTarget(d)}
              orgType={orgType}
            />
          )}
          {activeTab === "upcoming" && data && (
            <PartnerDeliveriesTab
              deliveries={data.upcomingDeliveries}
              label="upcoming"
              onShare={(d) => setShareTarget(d)}
              orgType={orgType}
            />
          )}
          {activeTab === "calendar" && data && (
            <PartnerCalendarTab deliveries={data.allDeliveries} />
          )}
          {activeTab === "tracking" && (
            <PartnerLiveMapTab orgId={orgId} />
          )}
          {activeTab === "invoices" && data && (
            <PartnerInvoicesTab invoices={data.invoices} />
          )}
          {activeTab === "billing" && data && (
            <PartnerBillingTab data={data} orgName={orgName} />
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
      </main>

      {/* Modals */}
      {scheduleOpen && (
        <PartnerScheduleModal
          orgId={orgId}
          orgType={orgType}
          onClose={() => setScheduleOpen(false)}
          onCreated={() => { setScheduleOpen(false); loadData(); }}
        />
      )}
      {shareTarget && (
        <PartnerShareModal
          delivery={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

function DeliveryKPIs({ data }: { data: DashboardData | null }) {
  return (
    <div className="mt-6">
      <div className="text-[10px] font-bold tracking-wider uppercase text-[#888] mb-2">Completed</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-[#E8E4DF] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">This Month</div>
          <div className="text-[28px] font-bold text-[#1A1A1A] mt-1 font-serif">{data?.completedThisMonth ?? 0}</div>
          <div className="text-[11px] text-[#2D9F5A] mt-0.5 font-medium">
            {(data?.completedThisMonth ?? 0) > 0 ? `+${data?.completedThisMonth} vs last` : ""}
          </div>
        </div>
        <div className="bg-white border border-[#E8E4DF] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">On-Time Rate</div>
          <div className="text-[28px] font-bold text-[#1A1A1A] mt-1 font-serif">{data?.onTimeRate ?? 100}%</div>
        </div>
        <div className="bg-white border border-[#E8E4DF] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Damage Claims</div>
          <div className="text-[28px] font-bold text-[#1A1A1A] mt-1 font-serif">{data?.damageClaims ?? 0}</div>
          <div className="text-[11px] text-[#2D9F5A] mt-0.5 font-medium">Lifetime</div>
        </div>
        <div className="bg-white border border-[#E8E4DF] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Outstanding</div>
          <div className="text-[28px] font-bold text-[#1A1A1A] mt-1 font-serif">{formatCurrency(data?.outstandingAmount ?? 0)}</div>
          {data?.outstandingDueDate && (
            <div className="text-[11px] text-[#888] mt-0.5">Due {new Date(data.outstandingDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RealtorKPIs({ data }: { data: DashboardData | null }) {
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white border border-[#E8E4DF] rounded-xl p-6 flex flex-col items-center justify-center min-h-[180px]">
        <div className="text-[10px] font-semibold tracking-wider uppercase text-[#C9A962]">Total Earned</div>
        <div className="text-[42px] font-bold text-[#2D9F5A] mt-2 font-serif">{formatCurrency(data?.totalEarned ?? 0)}</div>
        <div className="text-[12px] text-[#2D9F5A] mt-1 font-medium">
          {data?.completedReferrals ?? 0} completed move{(data?.completedReferrals ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="bg-white border border-[#E8E4DF] rounded-xl p-6">
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
      <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888] mb-3">Submit New Referral</div>
      <div className="space-y-2">
        <input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Client full name" required className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <input value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} placeholder="Client email" type="email" className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <input value={form.property} onChange={(e) => setForm((f) => ({ ...f, property: e.target.value }))} placeholder="Property address" className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <input value={form.move_date} onChange={(e) => setForm((f) => ({ ...f, move_date: e.target.value }))} placeholder="Target move date" type="date" className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#aaa] focus:border-[#C9A962] focus:outline-none transition-colors bg-white" />
        <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] focus:border-[#C9A962] focus:outline-none transition-colors bg-white">
          <option value="standard">Essentials</option>
          <option value="premium">Premier</option>
          <option value="luxury">Estate</option>
        </select>
      </div>
      <button type="submit" disabled={submitting} className="w-full mt-3 px-4 py-2.5 rounded-lg text-[12px] font-bold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors disabled:opacity-50">
        {submitting ? "Submitting..." : success ? "Referral Submitted!" : "Submit Referral"}
      </button>
    </form>
  );
}

function MaterialsTab() {
  const materials = [
    { name: "Yugo Service Guide (PDF)", desc: "Overview of all service tiers", icon: "doc" },
    { name: "Referral Program Overview", desc: "Commission structure and benefits", icon: "doc" },
    { name: "Client FAQ Sheet", desc: "Common questions your clients may ask", icon: "doc" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-[16px] font-bold text-[#1A1A1A] font-serif">Marketing Materials</h3>
      {materials.map((m) => (
        <div key={m.name} className="bg-white border border-[#E8E4DF] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F5F3F0] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A962" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#1A1A1A]">{m.name}</div>
              <div className="text-[12px] text-[#888]">{m.desc}</div>
            </div>
          </div>
          <button className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A962" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
