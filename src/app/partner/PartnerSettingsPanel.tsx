"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import {
  CaretLeft,
  X,
  CaretRight,
  Lock,
  NavigationArrow,
  ArrowSquareOut,
  SignOut,
  UserCircle,
  Bell,
  Sliders,
  Check,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { organizationTypeLabel } from "@/lib/partner-type";
import {
  WINE,
  FOREST,
  TEXT_MUTED_ON_LIGHT,
  CREAM,
  PARTNER_SETTINGS_EYEBROW_CLASS,
  PARTNER_SETTINGS_MENU_TITLE_CLASS,
  PARTNER_SETTINGS_SIGN_OUT_LABEL_CLASS,
  PARTNER_SETTINGS_SECTION_LABEL_COLOR,
  PARTNER_SETTINGS_ACCOUNT_NAME_CLASS,
} from "@/lib/client-theme";

const PREMIUM_PREF_CARD =
  "flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 min-h-[4.5rem] shadow-[0_2px_28px_rgba(44,62,45,0.06)]";
const premiumPrefCardStyle: CSSProperties = {
  borderColor: `${FOREST}18`,
  backgroundColor: "#FFFBF7",
};

const PREMIUM_MENU_CARD =
  "w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-[0_2px_24px_rgba(44,62,45,0.05)] transition-opacity hover:opacity-90 active:opacity-[0.97]";
const premiumMenuCardStyle: CSSProperties = {
  borderColor: `${FOREST}16`,
  backgroundColor: "#FFFBF7",
};

const premiumIconWellStyle: CSSProperties = {
  backgroundColor: `${FOREST}0D`,
};

const PARTNER_SETTINGS_TOGGLE_CLASS =
  "relative h-7 w-12 shrink-0 cursor-pointer touch-manipulation rounded-full border-2 border-transparent outline-none transition-[background-color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2C3E2D]/35";

function partnerSettingsToggleTrackStyle(on: boolean): CSSProperties {
  if (on) {
    return {
      backgroundColor: FOREST,
      boxShadow: "none",
      borderColor: "transparent",
    };
  }
  return {
    backgroundColor: "#E8E4DF",
    borderColor: "rgba(44, 62, 45, 0.38)",
    boxShadow: "inset 0 1px 2px rgba(44, 62, 45, 0.08)",
  };
}

function PremiumSaveButton({
  onClick,
  disabled,
  idleLabel,
  loading = false,
  saved = false,
  loadingLabel = "Saving…",
  savedLabel = "Saved!",
}: {
  onClick: () => void;
  disabled?: boolean;
  idleLabel: string;
  loading?: boolean;
  saved?: boolean;
  loadingLabel?: string;
  savedLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full inline-flex items-center justify-center gap-1.5 py-3.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] leading-none border-2 border-solid transition-opacity hover:opacity-85 disabled:opacity-45 disabled:pointer-events-none"
      style={{
        borderColor: FOREST,
        color: FOREST,
        backgroundColor: "transparent",
      }}
    >
      {loading ? (
        loadingLabel
      ) : saved ? (
        <>
          <Check size={14} weight="bold" className="shrink-0" aria-hidden />
          {savedLabel}
        </>
      ) : (
        <>
          {idleLabel}
          <CaretRight
            size={14}
            weight="bold"
            className="shrink-0"
            aria-hidden
          />
        </>
      )}
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  orgName: string;
  contactName: string;
  userEmail: string;
  orgType: string;
}

export default function PartnerSettingsPanel({
  open,
  onClose,
  orgName,
  contactName,
  userEmail,
  orgType,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [section, setSection] = useState<
    "main" | "profile" | "notifications" | "preferences"
  >("main");
  const [profile, setProfile] = useState({
    contact_name: contactName,
    email: "",
    phone: "",
  });
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
  const [summaryTestResult, setSummaryTestResult] = useState<
    "sent" | "error" | null
  >(null);

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
    if (!open || (section !== "notifications" && section !== "preferences")) {
      return;
    }
    let cancelled = false;
    fetch("/api/partner/settings/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (typeof d.email_delivery_updates === "boolean") {
          setNotifPrefs({
            email_delivery_updates: d.email_delivery_updates,
            email_daily_summary: d.email_daily_summary ?? false,
            email_invoice_ready: d.email_invoice_ready ?? true,
          });
        }
        if (typeof d.customer_notifications_enabled === "boolean") {
          setDeliveryPrefs((p) => ({
            ...p,
            customer_notifications: d.customer_notifications_enabled,
            notification_message:
              d.customer_notification_message == null
                ? ""
                : String(d.customer_notification_message),
          }));
        }
      })
      .catch(() => {
        /* fall back to localStorage */
      });
    return () => {
      cancelled = true;
    };
  }, [open, section]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("partner-notif-prefs");
    if (stored)
      try {
        setNotifPrefs(JSON.parse(stored));
      } catch {}
    const storedDP = localStorage.getItem("partner-delivery-prefs");
    if (storedDP)
      try {
        setDeliveryPrefs(JSON.parse(storedDP));
      } catch {}
  }, []);

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
          customer_notification_message:
            deliveryPrefs.notification_message || null,
          email_delivery_updates: notifPrefs.email_delivery_updates,
          email_daily_summary: notifPrefs.email_daily_summary,
          email_invoice_ready: notifPrefs.email_invoice_ready,
        }),
      });
    } catch {
      /* graceful fail, localStorage already saved */
    }
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const saveDeliveryPrefs = async () => {
    localStorage.setItem(
      "partner-delivery-prefs",
      JSON.stringify(deliveryPrefs),
    );
    try {
      await fetch("/api/partner/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_notifications_enabled: deliveryPrefs.customer_notifications,
          customer_notification_message:
            deliveryPrefs.notification_message || null,
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
      <div className="fixed inset-0 z-[99998] bg-black/45" onClick={onClose} />
      <div
        className="fixed top-0 right-0 z-[99999] h-full w-full max-w-[400px] border-l shadow-[0_8px_48px_rgba(92,26,51,0.08)] flex flex-col drawer-card"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          backgroundColor: CREAM,
          borderColor: `${FOREST}14`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: `${FOREST}12`, backgroundColor: "#FFFBF7" }}
        >
          <div className="flex items-center gap-2">
            {section !== "main" && (
              <button
                type="button"
                onClick={() => setSection("main")}
                className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                style={{ color: FOREST }}
                aria-label="Back to settings"
              >
                <CaretLeft size={16} weight="regular" />
              </button>
            )}
            <h2
              className="text-[22px] font-semibold font-hero leading-tight"
              style={{ color: WINE }}
            >
              {section === "main"
                ? "Settings"
                : section === "profile"
                  ? "Edit Profile"
                  : section === "notifications"
                    ? "Notifications"
                    : "Delivery Preferences"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: FOREST }}
            aria-label="Close settings"
          >
            <X size={18} weight="regular" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {section === "main" && (
            <div className="p-5 pb-8 space-y-6">
              {/* Account */}
              <div>
                <p
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-3`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Account
                </p>
                <div
                  className="rounded-2xl border overflow-hidden shadow-[0_2px_28px_rgba(44,62,45,0.06)]"
                  style={{
                    borderColor: `${FOREST}18`,
                    backgroundColor: "#FFFBF7",
                  }}
                >
                  <div className="px-4 py-4 flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-[11px] font-bold shrink-0 shadow-[0_2px_10px_rgba(92,26,51,0.08)] tracking-[0.06em]"
                      style={{
                        borderColor: `${FOREST}28`,
                        color: WINE,
                        backgroundColor: "#FFFFFF",
                      }}
                      aria-hidden
                    >
                      {contactName.charAt(0).toUpperCase()}
                      {(contactName.split(" ")[1] || "")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={PARTNER_SETTINGS_ACCOUNT_NAME_CLASS}
                        style={{ color: WINE }}
                      >
                        {contactName}
                      </div>
                      <div
                        className="text-[13px] leading-relaxed truncate mt-1 font-medium [font-family:var(--font-body)]"
                        style={{ color: TEXT_MUTED_ON_LIGHT }}
                      >
                        {userEmail}
                      </div>
                    </div>
                  </div>
                  <div
                    className="px-4 py-3 flex items-center justify-between gap-3 border-t"
                    style={{ borderColor: `${FOREST}10` }}
                  >
                    <span
                      className="text-[13px] font-medium leading-snug min-w-0"
                      style={{ color: TEXT_MUTED_ON_LIGHT }}
                    >
                      {orgName}
                    </span>
                    <span
                      className={`${PARTNER_SETTINGS_EYEBROW_CLASS} shrink-0 text-right max-w-[50%]`}
                      style={{ color: FOREST }}
                    >
                      {organizationTypeLabel(orgType)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div>
                <p
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-3`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Manage
                </p>
                <div className="space-y-2.5">
                  {[
                    {
                      key: "profile" as const,
                      PhIcon: UserCircle,
                      label: "Edit Profile",
                      desc: "Name, email, phone",
                    },
                    {
                      key: "notifications" as const,
                      PhIcon: Bell,
                      label: "Notifications",
                      desc: "Email and delivery alerts",
                    },
                    {
                      key: "preferences" as const,
                      PhIcon: Sliders,
                      label: "Delivery Preferences",
                      desc: "Defaults for new deliveries",
                    },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSection(item.key)}
                      className={PREMIUM_MENU_CARD}
                      style={premiumMenuCardStyle}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={premiumIconWellStyle}
                      >
                        <item.PhIcon
                          size={18}
                          weight="regular"
                          style={{ color: FOREST }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                          style={{ color: WINE }}
                        >
                          {item.label}
                        </div>
                        <div
                          className="text-[12px] leading-relaxed mt-0.5"
                          style={{ color: TEXT_MUTED_ON_LIGHT }}
                        >
                          {item.desc}
                        </div>
                      </div>
                      <CaretRight
                        size={16}
                        weight="bold"
                        className="shrink-0"
                        style={{ color: FOREST }}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div>
                <p
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-3`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Quick Links
                </p>
                <div className="space-y-2.5">
                  <a
                    href="/update-password"
                    className={PREMIUM_MENU_CARD}
                    style={premiumMenuCardStyle}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={premiumIconWellStyle}
                    >
                      <Lock
                        size={18}
                        weight="regular"
                        style={{ color: FOREST }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                        style={{ color: WINE }}
                      >
                        Change Password
                      </div>
                      <div
                        className="text-[12px] leading-relaxed mt-0.5"
                        style={{ color: TEXT_MUTED_ON_LIGHT }}
                      >
                        Update your login credentials
                      </div>
                    </div>
                    <CaretRight
                      size={16}
                      weight="bold"
                      className="shrink-0"
                      style={{ color: FOREST }}
                      aria-hidden
                    />
                  </a>
                  <a
                    href="/tracking"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={PREMIUM_MENU_CARD}
                    style={premiumMenuCardStyle}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={premiumIconWellStyle}
                    >
                      <NavigationArrow
                        size={18}
                        weight="regular"
                        style={{ color: FOREST }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                        style={{ color: WINE }}
                      >
                        Public Tracking Page
                      </div>
                      <div
                        className="text-[12px] leading-relaxed mt-0.5"
                        style={{ color: TEXT_MUTED_ON_LIGHT }}
                      >
                        Share with your customers
                      </div>
                    </div>
                    <ArrowSquareOut
                      size={16}
                      weight="bold"
                      className="shrink-0"
                      style={{ color: FOREST }}
                      aria-hidden
                    />
                  </a>
                </div>
              </div>

              {/* Sign out */}
              <div
                className="pt-2 border-t"
                style={{ borderColor: `${FOREST}12` }}
              >
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-colors shadow-[0_2px_18px_rgba(127,29,29,0.07)] hover:bg-[#FEE2E2]"
                  style={{
                    borderColor: "rgba(185, 28, 28, 0.5)",
                    backgroundColor: "#FEF2F2",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-solid"
                    style={{
                      backgroundColor: "rgba(185, 28, 28, 0.16)",
                      borderColor: "rgba(185, 28, 28, 0.35)",
                    }}
                  >
                    <SignOut size={18} weight="bold" color="#991B1B" aria-hidden />
                  </div>
                  <span
                    className={PARTNER_SETTINGS_SIGN_OUT_LABEL_CLASS}
                    style={{ color: "#991B1B" }}
                  >
                    Sign out
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Profile Section */}
          {section === "profile" && (
            <div className="p-5 space-y-5">
              <p
                className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-1`}
                style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
              >
                Profile
              </p>
              <p
                className="text-[13px] leading-relaxed -mt-2 mb-1"
                style={{ color: TEXT_MUTED_ON_LIGHT }}
              >
                Update how we reach you. Organization details are managed by
                your coordinator.
              </p>
              <div>
                <label
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} block mb-2`}
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  Contact name
                </label>
                <input
                  value={profile.contact_name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, contact_name: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-2xl border-2 text-[15px] bg-white focus:outline-none transition-colors"
                  style={{ borderColor: `${FOREST}14`, color: WINE }}
                />
              </div>
              <div>
                <label
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} block mb-2`}
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  Business email
                </label>
                <input
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  type="email"
                  className="w-full px-4 py-3 rounded-2xl border-2 text-[15px] bg-white focus:outline-none transition-colors"
                  style={{ borderColor: `${FOREST}14`, color: WINE }}
                />
              </div>
              <div>
                <label
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} block mb-2`}
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  Phone
                </label>
                <input
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                  type="tel"
                  className="w-full px-4 py-3 rounded-2xl border-2 text-[15px] bg-white focus:outline-none transition-colors"
                  style={{ borderColor: `${FOREST}14`, color: WINE }}
                />
              </div>
              <div
                className="rounded-2xl border px-4 py-4 shadow-[0_2px_24px_rgba(44,62,45,0.05)]"
                style={{
                  borderColor: `${FOREST}12`,
                  backgroundColor: "#FFFBF7",
                }}
              >
                <div
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-1`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Organization
                </div>
                <div
                  className="font-hero text-[16px] font-semibold leading-snug"
                  style={{ color: WINE }}
                >
                  {orgName}
                </div>
                <div
                  className="text-[12px] leading-relaxed mt-1"
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  {organizationTypeLabel(orgType)} · {userEmail}
                </div>
              </div>
              <PremiumSaveButton
                onClick={saveProfile}
                disabled={profileLoading}
                loading={profileLoading}
                saved={profileSaved}
                idleLabel="Save changes"
              />
            </div>
          )}

          {/* Notifications Section */}
          {section === "notifications" && (
            <div className="p-5 space-y-5">
              <div>
                <p
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-1`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Email
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  Choose which updates we send. You can change these anytime.
                </p>
              </div>
              {[
                {
                  key: "email_delivery_updates" as const,
                  label: "Delivery status updates",
                  desc: "Get notified when deliveries change status",
                },
                {
                  key: "email_daily_summary" as const,
                  label: "Daily summary",
                  desc: "Receive a morning digest of today's deliveries",
                },
                {
                  key: "email_invoice_ready" as const,
                  label: "Invoice ready",
                  desc: "Notified when a new invoice is available",
                },
              ].map((pref) => (
                <div
                  key={pref.key}
                  className={PREMIUM_PREF_CARD}
                  style={premiumPrefCardStyle}
                >
                  <div className="min-w-0 pr-2">
                    <div
                      className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                      style={{ color: WINE }}
                    >
                      {pref.label}
                    </div>
                    <div
                      className="text-[12px] leading-relaxed mt-1.5"
                      style={{ color: TEXT_MUTED_ON_LIGHT }}
                    >
                      {pref.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs[pref.key]}
                    aria-label={`${notifPrefs[pref.key] ? "Disable" : "Enable"} ${pref.label}`}
                    onClick={() =>
                      setNotifPrefs((p) => ({ ...p, [pref.key]: !p[pref.key] }))
                    }
                    className={PARTNER_SETTINGS_TOGGLE_CLASS}
                    style={partnerSettingsToggleTrackStyle(notifPrefs[pref.key])}
                  >
                    <span
                      className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${notifPrefs[pref.key] ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>
              ))}
              <div className="pt-1">
                <PremiumSaveButton
                  onClick={saveNotifPrefs}
                  saved={prefsSaved}
                  idleLabel="Save preferences"
                />
              </div>

              {notifPrefs.email_daily_summary && (
                <div
                  className={`${PREMIUM_PREF_CARD} mt-6`}
                  style={premiumPrefCardStyle}
                >
                  <div className="min-w-0 pr-2">
                    <div
                      className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                      style={{ color: WINE }}
                    >
                      Test daily summary
                    </div>
                    <div
                      className="text-[12px] leading-relaxed mt-1.5"
                      style={{ color: TEXT_MUTED_ON_LIGHT }}
                    >
                      Send yourself a preview email now
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={summaryTestSending}
                    onClick={async () => {
                      setSummaryTestSending(true);
                      setSummaryTestResult(null);
                      try {
                        const r = await fetch("/api/partner/daily-summary", {
                          method: "POST",
                        });
                        setSummaryTestResult(r.ok ? "sent" : "error");
                      } catch {
                        setSummaryTestResult("error");
                      }
                      setSummaryTestSending(false);
                      setTimeout(() => setSummaryTestResult(null), 4000);
                    }}
                    className="shrink-0 inline-flex cursor-pointer touch-manipulation items-center gap-1 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] border-2 border-solid transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={
                      summaryTestResult === "error"
                        ? {
                            borderColor: "#991B1B",
                            color: "#991B1B",
                            backgroundColor: "rgba(254, 242, 242, 0.65)",
                          }
                        : summaryTestResult === "sent"
                          ? {
                              borderColor: "#166534",
                              color: "#166534",
                              backgroundColor: "rgba(240, 253, 244, 0.7)",
                            }
                          : {
                              borderColor: FOREST,
                              color: FOREST,
                              backgroundColor: "transparent",
                            }
                    }
                  >
                    {summaryTestSending ? (
                      "Sending…"
                    ) : summaryTestResult === "sent" ? (
                      <>
                        <Check size={12} weight="bold" aria-hidden />
                        Sent
                      </>
                    ) : summaryTestResult === "error" ? (
                      "Failed"
                    ) : (
                      <>
                        Send test
                        <CaretRight size={12} weight="bold" aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delivery Preferences Section */}
          {section === "preferences" && (
            <div className="p-5 space-y-5">
              <div>
                <p
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} mb-1`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Defaults
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  Applied when you schedule new deliveries. Adjust anytime.
                </p>
              </div>
              <div
                className="rounded-2xl border px-4 py-4 shadow-[0_2px_24px_rgba(44,62,45,0.05)]"
                style={{
                  borderColor: `${FOREST}14`,
                  backgroundColor: "#FFFBF7",
                }}
              >
                <label
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} block mb-2`}
                  style={{ color: PARTNER_SETTINGS_SECTION_LABEL_COLOR }}
                >
                  Default time slot
                </label>
                <select
                  value={deliveryPrefs.default_time_slot}
                  onChange={(e) =>
                    setDeliveryPrefs((p) => ({
                      ...p,
                      default_time_slot: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-2xl border-2 text-[15px] bg-white focus:outline-none transition-colors cursor-pointer"
                  style={{ borderColor: `${FOREST}30`, color: WINE }}
                >
                  <option value="morning">Morning (8 AM – 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM – 5 PM)</option>
                  <option value="evening">Evening (5 PM – 9 PM)</option>
                  <option value="flexible">Flexible / Any time</option>
                </select>
              </div>
              <div className={PREMIUM_PREF_CARD} style={premiumPrefCardStyle}>
                <div className="min-w-0 pr-2">
                  <div
                    className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                    style={{ color: WINE }}
                  >
                    Auto-share tracking link
                  </div>
                  <div
                    className="text-[12px] leading-relaxed mt-1.5"
                    style={{ color: TEXT_MUTED_ON_LIGHT }}
                  >
                    Email the tracking link to your customer when a delivery is
                    dispatched
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={deliveryPrefs.auto_share_tracking}
                  aria-label={`${deliveryPrefs.auto_share_tracking ? "Disable" : "Enable"} auto-share tracking link`}
                  onClick={() =>
                    setDeliveryPrefs((p) => ({
                      ...p,
                      auto_share_tracking: !p.auto_share_tracking,
                    }))
                  }
                  className={PARTNER_SETTINGS_TOGGLE_CLASS}
                  style={partnerSettingsToggleTrackStyle(
                    deliveryPrefs.auto_share_tracking,
                  )}
                >
                  <span
                    className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${deliveryPrefs.auto_share_tracking ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
              <div className={PREMIUM_PREF_CARD} style={premiumPrefCardStyle}>
                <div className="min-w-0 pr-2">
                  <div
                    className={PARTNER_SETTINGS_MENU_TITLE_CLASS}
                    style={{ color: WINE }}
                  >
                    Customer notifications
                  </div>
                  <div
                    className="text-[12px] leading-relaxed mt-1.5"
                    style={{ color: TEXT_MUTED_ON_LIGHT }}
                  >
                    Let Yugo send tracking updates directly to your customers on
                    your behalf
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={deliveryPrefs.customer_notifications}
                  aria-label={`${deliveryPrefs.customer_notifications ? "Disable" : "Enable"} customer notifications`}
                  onClick={() =>
                    setDeliveryPrefs((p) => ({
                      ...p,
                      customer_notifications: !p.customer_notifications,
                    }))
                  }
                  className={PARTNER_SETTINGS_TOGGLE_CLASS}
                  style={partnerSettingsToggleTrackStyle(
                    deliveryPrefs.customer_notifications,
                  )}
                >
                  <span
                    className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${deliveryPrefs.customer_notifications ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
              {deliveryPrefs.customer_notifications && (
                <div>
                  <label
                    className={`${PARTNER_SETTINGS_EYEBROW_CLASS} block mb-2`}
                    style={{ color: TEXT_MUTED_ON_LIGHT }}
                  >
                    Custom notification message
                  </label>
                  <input
                    type="text"
                    value={deliveryPrefs.notification_message || ""}
                    onChange={(e) =>
                      setDeliveryPrefs((p) => ({
                        ...p,
                        notification_message: e.target.value,
                      }))
                    }
                    placeholder="Add a short note included with notifications"
                    className="w-full px-4 py-3 rounded-2xl border-2 text-[15px] bg-white placeholder:text-[#6B6B6B] focus:outline-none transition-colors"
                    style={{ borderColor: `${FOREST}14`, color: WINE }}
                  />
                </div>
              )}
              <div>
                <label
                  className={`${PARTNER_SETTINGS_EYEBROW_CLASS} block mb-2`}
                  style={{ color: TEXT_MUTED_ON_LIGHT }}
                >
                  Default special handling note
                </label>
                <textarea
                  value={deliveryPrefs.default_special_handling}
                  onChange={(e) =>
                    setDeliveryPrefs((p) => ({
                      ...p,
                      default_special_handling: e.target.value,
                    }))
                  }
                  placeholder="e.g. White glove service, assemble furniture"
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border-2 text-[15px] bg-white placeholder:text-[#6B6B6B] focus:outline-none transition-colors resize-none leading-relaxed"
                  style={{ borderColor: `${FOREST}14`, color: WINE }}
                />
              </div>
              <PremiumSaveButton
                onClick={saveDeliveryPrefs}
                saved={prefsSaved}
                idleLabel="Save preferences"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panelContent, document.body);
}
