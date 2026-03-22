"use client";

import { useState, useEffect, useCallback } from "react";
import { CaretLeft, X, CaretRight, Lock, NavigationArrow, ArrowSquareOut, SignOut, Sun, Moon, Desktop, UserCircle, Bell, Sliders } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { VERTICAL_LABELS } from "@/lib/partner-type";

type Theme = "light" | "dark" | "system";

interface Props {
  open: boolean;
  onClose: () => void;
  orgName: string;
  contactName: string;
  userEmail: string;
  orgType: string;
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("partner-theme") as Theme) || "light";
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const resolved = t === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : t;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  localStorage.setItem("partner-theme", t);
  window.dispatchEvent(new CustomEvent("partner-theme-change", { detail: resolved }));
}

export default function PartnerSettingsPanel({ open, onClose, orgName, contactName, userEmail, orgType }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [theme, setTheme] = useState<Theme>("light");
  const [section, setSection] = useState<"main" | "profile" | "notifications" | "preferences">("main");
  const [profile, setProfile] = useState({ contact_name: contactName, email: "", phone: "" });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    email_delivery_updates: true,
    email_daily_summary: false,
    email_invoice_ready: true,
  });
  const [deliveryPrefs, setDeliveryPrefs] = useState({
    default_time_slot: "morning",
    auto_share_tracking: false,
    default_special_handling: "",
    customer_notifications: false,
    notification_message: "",
  });
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [summaryTestSending, setSummaryTestSending] = useState(false);
  const [summaryTestResult, setSummaryTestResult] = useState<"sent" | "error" | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile({
          contact_name: data.contact_name || contactName,
          email: data.email || "",
          phone: data.phone || "",
        });
      }
    } catch {}
  }, [contactName]);

  useEffect(() => {
    if (open && section === "profile") loadProfile();
  }, [open, section, loadProfile]);

  useEffect(() => {
    if (open && section === "notifications") {
      fetch("/api/partner/settings/notifications")
        .then((r) => r.json())
        .then((d) => {
          if (typeof d.email_delivery_updates === "boolean") {
            setNotifPrefs({
              email_delivery_updates: d.email_delivery_updates,
              email_daily_summary: d.email_daily_summary ?? false,
              email_invoice_ready: d.email_invoice_ready ?? true,
            });
          }
        })
        .catch(() => { /* fall back to localStorage */ });
    }
  }, [open, section]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("partner-notif-prefs");
    if (stored) try { setNotifPrefs(JSON.parse(stored)); } catch {}
    const storedDP = localStorage.getItem("partner-delivery-prefs");
    if (storedDP) try { setDeliveryPrefs(JSON.parse(storedDP)); } catch {}
  }, []);

  const handleTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  const saveProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } catch {}
    setProfileLoading(false);
  };

  const saveNotifPrefs = async () => {
    localStorage.setItem("partner-notif-prefs", JSON.stringify(notifPrefs));
    try {
      await fetch("/api/partner/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_notifications_enabled: deliveryPrefs.customer_notifications,
          customer_notification_message: deliveryPrefs.notification_message || null,
          email_delivery_updates: notifPrefs.email_delivery_updates,
          email_daily_summary: notifPrefs.email_daily_summary,
          email_invoice_ready: notifPrefs.email_invoice_ready,
        }),
      });
    } catch { /* graceful fail — localStorage already saved */ }
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const saveDeliveryPrefs = async () => {
    localStorage.setItem("partner-delivery-prefs", JSON.stringify(deliveryPrefs));
    try {
      await fetch("/api/partner/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_notifications_enabled: deliveryPrefs.customer_notifications,
          customer_notification_message: deliveryPrefs.notification_message || null,
        }),
      });
    } catch {}
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/partner/login");
    router.refresh();
  };

  if (!open) return null;

  const panelContent = (
    <>
      <div className="fixed inset-0 z-[99998] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed top-0 right-0 z-[99999] h-full w-full max-w-[400px] bg-[var(--card,#fff)] border-l border-[var(--brd,#E8E4DF)] shadow-2xl flex flex-col drawer-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brd,#E8E4DF)]">
          <div className="flex items-center gap-2">
            {section !== "main" && (
              <button onClick={() => setSection("main")} className="p-1.5 rounded-lg hover:bg-[var(--hover,#F5F3F0)] transition-colors mr-1">
                <CaretLeft size={16} weight="regular" />
              </button>
            )}
            <h2 className="text-[24px] font-medium font-hero text-[var(--tx,#1A1A1A)]">
              {section === "main" ? "Settings" : section === "profile" ? "Edit Profile" : section === "notifications" ? "Notifications" : "Delivery Preferences"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--hover,#F5F3F0)] transition-colors">
            <X size={18} weight="regular" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {section === "main" && (
            <div className="p-5 space-y-5">
              {/* Account */}
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3,#888)] mb-3">Account</div>
                <div className="rounded-xl border border-[var(--brd,#E8E4DF)] overflow-hidden">
                  <div className="px-4 py-3.5 flex items-center gap-3 bg-[var(--card,#fff)]">
                    <div className="w-10 h-10 rounded-full bg-[#C9A962] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                      {contactName.charAt(0).toUpperCase()}{(contactName.split(" ")[1] || "").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-[var(--tx,#1A1A1A)] truncate">{contactName}</div>
                      <div className="text-[12px] text-[var(--tx3,#888)] truncate">{userEmail}</div>
                    </div>
                  </div>
                  <div className="border-t border-[var(--brd,#E8E4DF)] px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[12px] text-[var(--tx3,#888)]">{orgName}</span>
                    <span className="text-[11px] font-semibold text-[#C9A962] uppercase tracking-wide">
                      {VERTICAL_LABELS[orgType] || orgType.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3,#888)] mb-3">Theme</div>
                <div className="flex gap-2">
                  {([
                    { key: "light" as Theme, label: "Light", PhIcon: Sun },
                    { key: "dark" as Theme, label: "Dark", PhIcon: Moon },
                    { key: "system" as Theme, label: "Auto", PhIcon: Desktop },
                  ]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => handleTheme(t.key)}
                      className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                        theme === t.key
                          ? "border-[#C9A962] bg-[#C9A962]/5"
                          : "border-[var(--brd,#E8E4DF)] bg-[var(--card,#fff)] hover:border-[var(--tx3,#888)]/30"
                      }`}
                    >
                      <t.PhIcon size={20} color={theme === t.key ? "#C9A962" : "currentColor"} />
                      <span className={`text-[11px] font-semibold ${theme === t.key ? "text-[#C9A962]" : "text-[var(--tx3,#888)]"}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu items */}
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3,#888)] mb-3">Manage</div>
                <div className="space-y-1">
                  {[
                    { key: "profile" as const, PhIcon: UserCircle, label: "Edit Profile", desc: "Name, email, phone" },
                    { key: "notifications" as const, PhIcon: Bell, label: "Notifications", desc: "Email and delivery alerts" },
                    { key: "preferences" as const, PhIcon: Sliders, label: "Delivery Preferences", desc: "Defaults for new deliveries" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setSection(item.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--hover,#F5F3F0)] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[var(--hover,#F5F3F0)] flex items-center justify-center flex-shrink-0">
                        <item.PhIcon size={16} color="var(--tx3,#888)" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">{item.label}</div>
                        <div className="text-[11px] text-[var(--tx3,#888)]">{item.desc}</div>
                      </div>
                      <CaretRight size={14} weight="regular" color="var(--tx3,#888)" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div>
                <div className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3,#888)] mb-3">Quick Links</div>
                <div className="space-y-1">
                  <a
                    href="/update-password"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--hover,#F5F3F0)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--hover,#F5F3F0)] flex items-center justify-center flex-shrink-0">
                      <Lock size={16} color="var(--tx3,#888)" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">Change Password</div>
                      <div className="text-[11px] text-[var(--tx3,#888)]">Update your login credentials</div>
                    </div>
                    <CaretRight size={14} weight="regular" color="var(--tx3,#888)" />
                  </a>
                  <a
                    href="/tracking"
                    target="_blank"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--hover,#F5F3F0)] transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--hover,#F5F3F0)] flex items-center justify-center flex-shrink-0">
                      <NavigationArrow size={16} color="var(--tx3,#888)" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">Public Tracking Page</div>
                      <div className="text-[11px] text-[var(--tx3,#888)]">Share with your customers</div>
                    </div>
                    <ArrowSquareOut size={14} color="var(--tx3,#888)" />
                  </a>
                </div>
              </div>

              {/* Sign out */}
              <div className="pt-3 border-t border-[var(--brd,#E8E4DF)]">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <SignOut size={16} color="#EF4444" />
                  </div>
                  <span className="text-[13px] font-semibold text-red-500">Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Profile Section */}
          {section === "profile" && (
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider block mb-1.5">Contact Name</label>
                <input
                  value={profile.contact_name}
                  onChange={(e) => setProfile((p) => ({ ...p, contact_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--brd,#E8E4DF)] text-[var(--text-base)] text-[var(--tx,#1A1A1A)] bg-[var(--card,#fff)] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider block mb-1.5">Business Email</label>
                <input
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  type="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--brd,#E8E4DF)] text-[var(--text-base)] text-[var(--tx,#1A1A1A)] bg-[var(--card,#fff)] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider block mb-1.5">Phone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  type="tel"
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--brd,#E8E4DF)] text-[var(--text-base)] text-[var(--tx,#1A1A1A)] bg-[var(--card,#fff)] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
              </div>
              <div className="pt-2">
                <div className="rounded-xl bg-[var(--hover,#F5F3F0)] border border-[var(--brd,#E8E4DF)] px-4 py-3">
                  <div className="text-[10px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider mb-0.5">Organization</div>
                  <div className="text-[var(--text-base)] font-semibold text-[var(--tx,#1A1A1A)]">{orgName}</div>
                  <div className="text-[12px] text-[var(--tx3,#888)]">
                    {VERTICAL_LABELS[orgType] || orgType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} · {userEmail}
                  </div>
                </div>
              </div>
              <button
                onClick={saveProfile}
                disabled={profileLoading}
                className="w-full py-3 rounded-xl text-[13px] font-bold bg-[#C9A962] text-white hover:bg-[#B89A52] disabled:opacity-50 transition-colors"
              >
                {profileLoading ? "Saving…" : profileSaved ? "Saved!" : "Save changes"}
              </button>
            </div>
          )}

          {/* Notifications Section */}
          {section === "notifications" && (
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[var(--tx3,#888)]">Control which email notifications you receive.</p>
              {[
                { key: "email_delivery_updates" as const, label: "Delivery status updates", desc: "Get notified when deliveries change status" },
                { key: "email_daily_summary" as const, label: "Daily summary", desc: "Receive a morning digest of today's deliveries" },
                { key: "email_invoice_ready" as const, label: "Invoice ready", desc: "Notified when a new invoice is available" },
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--brd,#E8E4DF)]">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">{pref.label}</div>
                    <div className="text-[11px] text-[var(--tx3,#888)]">{pref.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs[pref.key]}
                    onClick={() => setNotifPrefs((p) => ({ ...p, [pref.key]: !p[pref.key] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notifPrefs[pref.key] ? "bg-[#C9A962]" : "bg-[var(--brd,#D1D5DB)]"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifPrefs[pref.key] ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
              <button
                onClick={saveNotifPrefs}
                className="w-full py-3 rounded-xl text-[13px] font-bold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors"
              >
                {prefsSaved ? "Saved!" : "Save preferences"}
              </button>

              {notifPrefs.email_daily_summary && (
                <div className="rounded-xl border border-[var(--brd,#E8E4DF)] px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">Test Daily Summary</div>
                    <div className="text-[11px] text-[var(--tx3,#888)]">Send yourself a preview email right now</div>
                  </div>
                  <button
                    type="button"
                    disabled={summaryTestSending}
                    onClick={async () => {
                      setSummaryTestSending(true);
                      setSummaryTestResult(null);
                      try {
                        const r = await fetch("/api/partner/daily-summary", { method: "POST" });
                        setSummaryTestResult(r.ok ? "sent" : "error");
                      } catch {
                        setSummaryTestResult("error");
                      }
                      setSummaryTestSending(false);
                      setTimeout(() => setSummaryTestResult(null), 4000);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      summaryTestResult === "sent"
                        ? "bg-green-500/10 text-green-600"
                        : summaryTestResult === "error"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-[#C9A962]/10 text-[#C9A962] hover:bg-[#C9A962]/20"
                    }`}
                  >
                    {summaryTestSending ? "Sending…" : summaryTestResult === "sent" ? "Sent" : summaryTestResult === "error" ? "Failed" : "Send test"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delivery Preferences Section */}
          {section === "preferences" && (
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[var(--tx3,#888)]">Set defaults used when scheduling new deliveries.</p>
              <div>
                <label className="text-[11px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider block mb-1.5">Default Time Slot</label>
                <select
                  value={deliveryPrefs.default_time_slot}
                  onChange={(e) => setDeliveryPrefs((p) => ({ ...p, default_time_slot: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--brd,#E8E4DF)] text-[var(--text-base)] text-[var(--tx,#1A1A1A)] bg-[var(--card,#fff)] focus:border-[#C9A962] focus:outline-none transition-colors"
                >
                  <option value="morning">Morning (8 AM – 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM – 5 PM)</option>
                  <option value="evening">Evening (5 PM – 9 PM)</option>
                  <option value="flexible">Flexible / Any time</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--brd,#E8E4DF)]">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">Auto-share tracking link</div>
                  <div className="text-[11px] text-[var(--tx3,#888)]">Automatically email tracking link to customer on dispatch</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={deliveryPrefs.auto_share_tracking}
                  onClick={() => setDeliveryPrefs((p) => ({ ...p, auto_share_tracking: !p.auto_share_tracking }))}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${deliveryPrefs.auto_share_tracking ? "bg-[#C9A962]" : "bg-[var(--brd,#D1D5DB)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${deliveryPrefs.auto_share_tracking ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--brd,#E8E4DF)]">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--tx,#1A1A1A)]">End Customer Notifications</div>
                  <div className="text-[11px] text-[var(--tx3,#888)]">Allow Yugo to send delivery tracking updates directly to your customers on your behalf</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={deliveryPrefs.customer_notifications}
                  onClick={() => setDeliveryPrefs((p) => ({ ...p, customer_notifications: !p.customer_notifications }))}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${deliveryPrefs.customer_notifications ? "bg-[#C9A962]" : "bg-[var(--brd,#D1D5DB)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${deliveryPrefs.customer_notifications ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {deliveryPrefs.customer_notifications && (
                <div>
                  <label className="text-[11px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider block mb-1.5">Custom notification message</label>
                  <input
                    type="text"
                    value={deliveryPrefs.notification_message || ""}
                    onChange={(e) => setDeliveryPrefs((p) => ({ ...p, notification_message: e.target.value }))}
                    placeholder="Add a custom note to delivery notifications"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--brd,#E8E4DF)] text-[var(--text-base)] text-[var(--tx,#1A1A1A)] bg-[var(--card,#fff)] placeholder-[var(--tx3,#aaa)] focus:border-[#C9A962] focus:outline-none transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold text-[var(--tx3,#888)] uppercase tracking-wider block mb-1.5">Default Special Handling Note</label>
                <textarea
                  value={deliveryPrefs.default_special_handling}
                  onChange={(e) => setDeliveryPrefs((p) => ({ ...p, default_special_handling: e.target.value }))}
                  placeholder="e.g. White glove service, assemble furniture"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--brd,#E8E4DF)] text-[var(--text-base)] text-[var(--tx,#1A1A1A)] bg-[var(--card,#fff)] placeholder-[var(--tx3,#aaa)] focus:border-[#C9A962] focus:outline-none transition-colors resize-none"
                />
              </div>
              <button
                onClick={saveDeliveryPrefs}
                className="w-full py-3 rounded-xl text-[13px] font-bold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors"
              >
                {prefsSaved ? "Saved!" : "Save preferences"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panelContent, document.body);
}
