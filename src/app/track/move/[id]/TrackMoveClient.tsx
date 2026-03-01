"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getMoveCode, formatJobId } from "@/lib/move-code";
import TrackInventory from "./TrackInventory";
import TrackPhotos from "./TrackPhotos";
import TrackDocuments from "./TrackDocuments";
import TrackMessageThread from "./TrackMessageThread";
import TrackLiveMap from "./TrackLiveMap";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import DeliveryProgressBar from "@/components/DeliveryProgressBar";
import StageProgressBar from "@/components/StageProgressBar";
import { useToast } from "@/app/admin/components/Toast";
import {
  MOVE_STATUS_OPTIONS,
  MOVE_STATUS_INDEX,
  MOVE_STATUS_COLORS,
  LIVE_TRACKING_STAGES,
  getStatusLabel,
} from "@/lib/move-status";
import { formatMoveDate, parseDateOnly } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { formatPhone, normalizePhone } from "@/lib/phone";

const CHANGE_TYPES = [
  "Change move date",
  "Change move time",
  "Add items to inventory",
  "Remove items from inventory",
  "Change destination address",
  "Add special instructions",
  "Upgrade service tier",
  "Other",
];

const YUGO_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";
const YUGO_EMAIL = process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com";

type TabKey = "dash" | "track" | "inv" | "photos" | "docs" | "msg";

/** Map legacy status to index for timeline */
function getStatusIdx(status: string | null): number {
  if (!status) return 0;
  if (MOVE_STATUS_INDEX[status] !== undefined) return MOVE_STATUS_INDEX[status];
  const legacy: Record<string, number> = {
    pending: 0, quote: 0, delivered: 4, dispatched: 3, "in-transit": 3,
  };
  return legacy[status] ?? 0;
}

export default function TrackMoveClient({
  move,
  crew,
  token,
  fromNotify = false,
  paymentSuccess = false,
  linkExpired = false,
  additionalFeesCents = 0,
  changeRequestFeesCents = 0,
  extraItemFeesCents = 0,
}: {
  move: any;
  crew: { id: string; name: string; members?: string[] } | null;
  token: string;
  fromNotify?: boolean;
  paymentSuccess?: boolean;
  linkExpired?: boolean;
  additionalFeesCents?: number;
  changeRequestFeesCents?: number;
  extraItemFeesCents?: number;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("dash");
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(paymentSuccess);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeType, setChangeType] = useState(CHANGE_TYPES[0]);
  const [changeDesc, setChangeDesc] = useState("");
  const [changeAddress, setChangeAddress] = useState("");
  const [changeUrgent, setChangeUrgent] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeSubmitted, setChangeSubmitted] = useState(false);
  const { toast } = useToast();
  const [liveStage, setLiveStage] = useState<string | null>(move.stage || null);
  const [showNotifyBanner, setShowNotifyBanner] = useState(!!fromNotify);

  useEffect(() => {
    setLiveStage(move.stage || null);
  }, [move.stage]);

  // Auto-hide "your move status was recently updated" card after 5s when arriving from notify email
  useEffect(() => {
    if (!fromNotify) return;
    const t = setTimeout(() => setShowNotifyBanner(false), 5000);
    return () => clearTimeout(t);
  }, [fromNotify]);

  const [paymentRecorded, setPaymentRecorded] = useState(false);

  // Record payment and add receipt to documents when landing from Square redirect
  useEffect(() => {
    if (!paymentSuccess || !showPaymentSuccess) return;
    fetch(`/api/track/moves/${move.id}/record-payment?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        if (d?.ok) {
          setPaymentRecorded(true);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [paymentSuccess, showPaymentSuccess, move.id, token, router]);

  const handleBackToDashboard = () => {
    setShowPaymentSuccess(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    router.replace(url.pathname + url.search);
  };

  // Poll crew-status (including liveStage, scheduled_date, status) so client stays in sync when admin updates
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/track/moves/${move.id}/crew-status?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (res.ok && data) {
          if ("liveStage" in data) setLiveStage(data.liveStage ?? null);
          if ("scheduled_date" in data) setLiveScheduledDate(data.scheduled_date ?? null);
          if ("arrival_window" in data) setLiveArrivalWindow(data.arrival_window ?? null);
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [move.id, token]);

  const moveCode = getMoveCode(move);
  const displayCode = formatJobId(moveCode, "move");
  // On move day: when crew shares live stage, treat as in_progress across timeline/progress bar (no refresh needed)
  const EN_ROUTE_OR_ACTIVE = ["en_route_to_pickup", "en_route_to_destination", "on_route", "en_route", "arrived_at_pickup", "loading", "arrived_at_destination", "unloading"];
  const statusVal =
    liveStage === "completed"
      ? "completed"
      : liveStage && EN_ROUTE_OR_ACTIVE.includes(liveStage)
        ? "in_progress"
        : move.status || "confirmed";
  const currentIdx = getStatusIdx(statusVal);
  const isCancelled = statusVal === "cancelled";
  const isCompleted = statusVal === "completed" || statusVal === "delivered";
  const isInProgress = statusVal === "in_progress";


  const typeLabel = move.move_type === "office" ? "Office / Commercial" : "Premier Residential";
  const [liveScheduledDate, setLiveScheduledDate] = useState<string | null>(move.scheduled_date || null);
  const [liveArrivalWindow, setLiveArrivalWindow] = useState<string | null>(move.arrival_window || null);
  const scheduledDate = liveScheduledDate ? (parseDateOnly(liveScheduledDate) ?? new Date(liveScheduledDate)) : null;
  const arrivalWindow = liveArrivalWindow ?? move.arrival_window ?? null;
  const daysUntil = scheduledDate ? Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000) : null;
  const isPaid = move.status === "paid" || paymentRecorded || showPaymentSuccess;
  const baseBalance = isPaid ? 0 : Number(move.estimate || 0);
  const feesDollars = isPaid ? 0 : (additionalFeesCents || 0) / 100;
  const totalBalance = baseBalance + feesDollars;
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [paymentLinkError, setPaymentLinkError] = useState<string | null>(null);

  const crewMembers = Array.isArray(move.assigned_members) ? move.assigned_members : (crew?.members ?? []);
  const crewRoles = ["Lead", "Specialist", "Specialist", "Driver"];

  const handleSubmitChange = async () => {
    const isAddressChange = changeType === "Change destination address";
    if (isAddressChange && !changeAddress.trim()) return;
    const desc = isAddressChange
      ? `New address: ${changeAddress.trim()}${changeDesc.trim() ? `\n\n${changeDesc.trim()}` : ""}`
      : changeDesc.trim();
    if (!desc) return;
    setChangeSubmitting(true);
    try {
      const res = await fetch(
        `/api/track/moves/${move.id}/change-request?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: changeType,
            description: desc,
            urgency: changeUrgent ? "urgent" : "normal",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to submit");
      setChangeSubmitted(true);
      setChangeModalOpen(false);
      setChangeDesc("");
      setChangeAddress("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to submit change request", "x");
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleMakePayment = async () => {
    if (totalBalance <= 0) return;
    setPaymentLinkError(null);
    setPaymentLinkLoading(true);
    try {
      const res = await fetch(
        `/api/track/moves/${move.id}/payment-link?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error("payment_failed");
      const url = data.url ?? data.paymentUrl;
      if (url) window.location.href = url;
      else throw new Error("payment_failed");
    } catch {
      setPaymentLinkError("Unable to process payment right now. Please contact us to arrange payment.");
    } finally {
      setPaymentLinkLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dash", label: "Dashboard" },
    { key: "track" as TabKey, label: "Live Tracking" },
    { key: "inv", label: "Inventory" },
    { key: "photos", label: "Photos" },
    { key: "docs", label: "Documents" },
    { key: "msg", label: "Messages" },
  ];

  if (linkExpired) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] font-sans flex items-center justify-center px-4" data-theme="light">
        <div className="max-w-md w-full text-center">
          <h1 className="font-hero text-[24px] sm:text-[28px] font-semibold text-[#1A1A1A] mb-2">Your move is complete</h1>
          <p className="text-[13px] text-[#666] mb-6">
            This tracking link has expired. If you need documents or support, please contact us.
          </p>
          <a
            href={`tel:${normalizePhone(YUGO_PHONE)}`}
            className="inline-block rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold text-[12px] py-2.5 px-4 hover:bg-[#B89A52] transition-colors"
          >
            Contact us
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] font-sans" data-theme="light">
      {/* Header - YUGO + YOUR MOVE */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E7E5E4]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-hero text-[20px] tracking-[2px] text-[#1A1A1A] font-bold">YUGO</span>
            <span className="text-[10px] font-bold text-[#1A1A1A] bg-[#E8D5A3] border border-[#D4BC7A] px-2.5 py-1 rounded-md tracking-wider">
              YOUR MOVE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-6 min-w-0 w-full pb-8">
        {showPaymentSuccess && (
          <div className="mb-5 rounded-xl border border-[#E7E5E4] bg-white p-6 sm:p-8 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex justify-center sm:justify-start shrink-0">
                <div className="relative w-[72px] h-[72px] sm:w-20 sm:h-20">
                  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full drop-shadow-sm">
                    <defs>
                      <linearGradient id="success-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#E8D5A3" />
                        <stop offset="100%" stopColor="#D4BC7A" />
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="40" r="36" fill="url(#success-bg)" stroke="#C9A962" strokeWidth="2" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#C9A962" strokeWidth="1" strokeDasharray="5 3" opacity="0.4" />
                    <path d="M28 40 L36 48 L52 32" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h2 className="text-[20px] sm:text-[22px] font-bold text-[#1A1A1A] font-heading">Payment received</h2>
                <p className="text-[14px] text-[#666] mt-2 leading-relaxed">
                  Thank you for making your final payment. We are excited to see you on move day!
                </p>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="mt-5 rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold text-[14px] py-3 px-5 hover:bg-[#B89A52] transition-colors shadow-sm"
                >
                  Back to main dashboard
                </button>
              </div>
            </div>
          </div>
        )}
        {fromNotify && !showPaymentSuccess && (
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out mb-5"
            style={{ gridTemplateRows: showNotifyBanner ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div
                className={`rounded-xl border border-[#C9A962]/40 bg-[#C9A962]/10 px-4 py-3 transition-opacity duration-300 ease-out ${showNotifyBanner ? "opacity-100" : "opacity-0"}`}
              >
                <div className="text-[13px] font-semibold text-[#1A1A1A]">Your move status was recently updated</div>
                <div className="text-[11px] text-[#666] mt-0.5">View the details below to see what changed.</div>
              </div>
            </div>
          </div>
        )}
        {/* Client + status header (exact design: name left, tag right) */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
              const firstName = (move.client_name || "there").split(" ")[0];
              const subtitle = isCompleted ? "Here's your move summary" : "Here's your move overview";
              return (
                <>
                  <p className="text-[13px] text-[#666] mb-0.5 font-sans">
                    {greeting}, {firstName}
                  </p>
                  <h1 className="font-hero text-[22px] sm:text-[26px] text-[#2D2D2D] leading-tight font-semibold tracking-tight">
                    {move.client_name || "Your Move"}
                  </h1>
                  <p className="text-[13px] text-[#666] mt-0.5 font-sans">
                    {displayCode} • {typeLabel}
                  </p>
                  <p className="text-[12px] text-[#666] mt-0.5 font-sans">
                    {subtitle}
                  </p>
                </>
              );
            })()}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold shrink-0 bg-[#F5E6C8] text-[#B8860B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A962]" aria-hidden />
            {getStatusLabel(statusVal)}
          </span>
        </div>

        {/* Main countdown card - light cream, rounded, centered content */}
        <div className="rounded-[16px] bg-[#FAF8F5] border border-[#EDE9E3] p-6 sm:p-8 mb-5">
          {isCompleted ? (
            <div className="text-center">
              <div className="font-hero text-[24px] sm:text-[28px] leading-tight text-[#1A1A1A] font-semibold">
                Your Move is Complete
              </div>
              <p className="mt-2 text-[13px] text-[#666] font-sans">
                Please tell us about your move.
              </p>
              <a
                href="https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold text-[12px] py-2.5 px-4 hover:bg-[#B89A52] transition-colors"
              >
                Leave a Review
              </a>
            </div>
          ) : daysUntil === 0 ? (
            <>
              <div className="text-center">
                <div className="font-hero text-[28px] md:text-[32px] leading-tight text-[#C9A962] font-semibold">Today&apos;s the day!</div>
                <div className="mt-1 text-[13px] text-[#666] font-sans">
                  {isInProgress && liveStage != null
                    ? LIVE_TRACKING_STAGES.find((s) => s.key === liveStage)?.label ?? "In progress"
                    : arrivalWindow
                      ? `Your crew arrives between ${arrivalWindow}`
                      : "Your crew is on the way"}
                </div>
                {crewMembers.length > 0 && (
                  <div className="mt-2 text-[12px] text-[#2D2D2D] font-sans">Crew: {crewMembers.join(", ")}</div>
                )}
              </div>
              {/* Stage progress bar - starts when team is en route, purple line, stage labels */}
              {scheduledDate && (
                <div className="mt-6">
                  <StageProgressBar
                    stages={[{ label: "En Route" }, { label: "Loading" }, { label: "Unloading" }, { label: "Complete" }]}
                    currentIndex={
                      isCompleted
                        ? 3
                        : isInProgress && liveStage != null
                          ? (() => {
                              const s = liveStage as string;
                              if (["job_complete", "completed"].includes(s)) return 3;
                              if (["unloading", "arrived_at_destination", "in_transit", "en_route_to_destination"].includes(s)) return 2;
                              if (["loading", "arrived_on_site", "arrived_at_pickup"].includes(s)) return 1;
                              if (["on_route", "en_route", "en_route_to_pickup"].includes(s)) return 0;
                              return -1;
                            })()
                          : -1
                    }
                    variant="dark"
                  />
                </div>
              )}
            </>
          ) : daysUntil != null && daysUntil < 0 ? (
            /* Past move date but not yet marked complete */
            <div className="text-center">
              <div className="font-hero text-[20px] sm:text-[24px] leading-tight text-[#2D2D2D] font-semibold">
                Move day has passed
              </div>
              <p className="mt-1 text-[13px] text-[#666] font-sans">
                Your move will be marked complete soon. Contact us if you have questions.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="font-hero text-[56px] sm:text-[64px] md:text-[72px] leading-none text-[#C9A962] font-semibold tracking-tight">
                  {daysUntil ?? "—"}
                </div>
                <div className="mt-1 text-[13px] text-[#2D2D2D] font-sans">days until move day</div>
                {scheduledDate && (
                  <div className="mt-3 text-[14px] font-sans">
                    <span className="font-semibold text-[#2D2D2D]">
                      {scheduledDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    {arrivalWindow && (
                      <span className="text-[#2D2D2D] font-normal"> • {arrivalWindow}</span>
                    )}
                  </div>
                )}
              </div>
              {/* Stage progress bar - starts when team is en route */}
              {scheduledDate && (
                <div className="mt-6">
                  <StageProgressBar
                    stages={[{ label: "En Route" }, { label: "Loading" }, { label: "Unloading" }, { label: "Complete" }]}
                    currentIndex={
                      isCompleted
                        ? 3
                        : isInProgress && liveStage != null
                          ? (() => {
                              const s = liveStage as string;
                              if (["job_complete", "completed"].includes(s)) return 3;
                              if (["unloading", "arrived_at_destination", "in_transit", "en_route_to_destination"].includes(s)) return 2;
                              if (["loading", "arrived_on_site", "arrived_at_pickup"].includes(s)) return 1;
                              if (["on_route", "en_route", "en_route_to_pickup"].includes(s)) return 0;
                              return -1;
                            })()
                          : -1
                    }
                    variant="dark"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Live tracking highlight on move day - front and center */}
        {!isCompleted && daysUntil === 0 && (
          <div className="mb-5 rounded-xl border-2 border-[#C9A962]/50 bg-[#FAF8F5] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0">
                  {isInProgress && liveStage != null && (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
                    </>
                  )}
                  {(!isInProgress || liveStage == null) && (
                    <span className="inline-flex rounded-full h-3 w-3 bg-[#C9A962]/60" />
                  )}
                </span>
                <div>
                  <h3 className="text-[14px] font-bold text-[#1A1A1A]">
                    {isInProgress && liveStage != null
                      ? LIVE_TRACKING_STAGES.find((s) => s.key === liveStage)?.label ?? "Live"
                      : "Live Tracking"}
                  </h3>
                  <p className="text-[12px] text-[#666] mt-0.5">
                    {isInProgress && liveStage != null
                      ? "See your crew on the map"
                      : "Map will appear when your crew starts"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("track")}
                className="shrink-0 rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold text-[12px] py-2.5 px-4 hover:bg-[#B89A52] transition-colors"
              >
                View map
              </button>
            </div>
          </div>
        )}

        {/* Tabs - horizontally scrollable on mobile with fade hint */}
        <div className="relative mb-5 overflow-hidden">
          <div
            className="flex gap-0 border-b border-[#E7E5E4] overflow-x-auto overflow-y-hidden scrollbar-hide bg-white rounded-t-lg scroll-smooth"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 px-4 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 rounded-t-lg transition-colors ${
                  activeTab === t.key
                    ? "text-[#C9A962] border-[#C9A962]"
                    : "text-[#999] border-transparent hover:text-[#666]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none rounded-tr-lg"
            style={{
              background: "linear-gradient(to left, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 40%, transparent 100%)",
            }}
            aria-hidden
          />
        </div>

        {/* Tab content */}
        {activeTab === "dash" && (
          <div className="space-y-6">
            {/* Move Timeline - Confirmed → Scheduled → In Progress → Completed (Paid shown in financial section) */}
            <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
              <h3 className="text-[14px] font-bold mb-4 text-[#1A1A1A]">Move Timeline</h3>
              <div className="relative pl-7 before:content-[''] before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-0.5 before:bg-[#E7E5E4] before:transition-colors before:duration-500">
                {MOVE_STATUS_OPTIONS.filter((s) => s.value !== "cancelled").map((s, i) => {
                  const statusOrder = ["confirmed", "scheduled", "paid", "in_progress", "completed"];
                  const stepIdx = statusOrder.indexOf(s.value);
                  const effectiveStatus = statusVal === "delivered" ? "completed" : statusVal;
                  const stepCurrentIdx = statusOrder.indexOf(effectiveStatus);
                  const state = isCancelled
                    ? "wait"
                    : s.value === "completed" && effectiveStatus === "completed"
                      ? "done"
                      : stepIdx < stepCurrentIdx
                        ? "done"
                        : stepIdx === stepCurrentIdx
                          ? "act"
                          : "wait";
                  const isCompletedStep = s.value === "completed";
                  const subLabels: Record<string, { done: string; act: string; wait: string }> = {
                    confirmed: { done: "Your move is confirmed", act: "Your move is confirmed", wait: "Upcoming" },
                    scheduled: { done: "Crew and date assigned", act: "Crew and date assigned", wait: "Upcoming" },
                    paid: { done: "Payment received", act: "Payment received", wait: "Upcoming" },
                    in_progress: { done: "Move underway", act: "Crew is on the way", wait: "Upcoming" },
                    completed: { done: "Move finished!", act: "Move finished!", wait: "Upcoming" },
                  };
                  const sub = subLabels[s.value] || { done: "Done", act: "In progress", wait: "Upcoming" };
                  const completedDate = isCompleted && s.value === "completed" ? formatMoveDate(move.updated_at ? new Date(move.updated_at) : scheduledDate) : null;
                  const actDateStr = scheduledDate ? scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
                  return (
                    <div
                      key={s.value}
                      className="relative pb-5 last:pb-0 group cursor-default transition-colors duration-200"
                    >
                      <div
                        className={`absolute -left-[17px] top-0.5 -translate-x-1/2 rounded-full border-2 border-white z-10 transition-all duration-300 ease-out client-timeline-dot ${
                          state === "done" && isCompletedStep
                            ? "w-5 h-5 bg-[#22C55E] shadow-[0_0_0_0_4px_rgba(34,197,94,0.25)] client-timeline-dot-completed"
                            : state === "done"
                            ? "w-3.5 h-3.5 bg-[#22C55E] group-hover:scale-110"
                            : state === "act"
                            ? "w-3.5 h-3.5 bg-[#F59E0B] shadow-[0_0_0_4px_rgba(245,158,11,0.2)] group-hover:shadow-[0_0_0_6px_rgba(245,158,11,0.3)]"
                            : "w-3 h-3 bg-[#E7E5E4] group-hover:bg-[#D4D4D4]"
                        }`}
                      />
                      <div className={`text-[13px] font-semibold transition-colors duration-300 ${state === "done" ? "text-[#22C55E]" : state === "act" ? "text-[#F59E0B]" : "text-[#999]"}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-[#666] mt-0.5">
                        {state === "done" ? (completedDate ? `Completed ${completedDate}` : sub.done) : state === "act" ? (actDateStr ? `In Progress — ${actDateStr}` : sub.act) : sub.wait}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {additionalFeesCents > 0 && !isPaid && (
              <div className="mb-4 rounded-xl border border-[#C9A962] bg-[#FDF8F0] p-4 text-[13px] text-[#1A1A1A]">
                You have additional charges of {formatCurrency((additionalFeesCents || 0) / 100)} from approved change requests and extra items. Pay below.
              </div>
            )}

            {/* Move Details + Your Crew grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#999] mb-4">Move Details</h3>
                <div className="space-y-3">
                  {scheduledDate && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">Date & Time</div>
                      <div className="text-[13px] text-[#1A1A1A]">
                        {formatMoveDate(scheduledDate)}
                        {arrivalWindow && (
                          <span className="block text-[12px] text-[#666] mt-0.5">
                            Crew arrives between {arrivalWindow}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">From</div>
                    <div className="text-[13px] text-[#1A1A1A]">{move.from_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">To</div>
                    <div className="text-[13px] text-[#1A1A1A]">{move.to_address || move.delivery_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">Total Balance</div>
                    <div className="font-hero text-[18px] font-bold text-[#C9A962]">{formatCurrency(totalBalance)}</div>
                  </div>
                  {totalBalance > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleMakePayment}
                        disabled={paymentLinkLoading}
                        className="w-full rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold text-[13px] py-3 px-4 hover:bg-[#B89A52] disabled:opacity-60 transition-colors"
                      >
                        {paymentLinkLoading ? "Preparing…" : "Make Payment"}
                      </button>
                      {paymentLinkError && (
                        <p className="mt-2 text-[11px] text-red-600" role="alert">
                          {paymentLinkError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#999] mb-4">
                  Your Crew ({crewMembers.length})
                </h3>
                {crewMembers.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {crewMembers.map((name: string, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#C19A6B] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                            {(name || "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-[#1A1A1A]">{name}</div>
                            <div className="text-[11px] text-[#666]">{crewRoles[i] || "Team member"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#E0E0E0]">
                      <div className="text-[13px] font-bold text-[#1A1A1A]">Coordinator</div>
                      <a href={`tel:${normalizePhone(YUGO_PHONE)}`} className="text-[13px] text-[#1A1A1A] mt-0.5 block hover:text-[#C9A962] transition-colors">
                        Yugo • {formatPhone(YUGO_PHONE)}
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] text-[#666]">
                    Your crew will be assigned as your move is confirmed. Contact us with any questions.
                  </div>
                )}
              </div>
            </div>

{changeSubmitted && (
              <div className="rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/10 px-4 py-3">
                <div className="text-[13px] font-semibold text-[#1A1A1A]">Change request submitted</div>
                <div className="text-[12px] text-[#666] mt-0.5">Your coordinator will reach out within 10 minutes.</div>
              </div>
            )}

            {/* Request a Change - hide when move is completed */}
            {!isCompleted && (
              <button
                type="button"
                onClick={() => setChangeModalOpen(true)}
                className="w-full rounded-xl border-2 border-dashed border-[#E7E5E4] py-4 text-[12px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors flex items-center justify-center gap-2 bg-white"
              >
                Request a Change
              </button>
            )}
            {isCompleted && (
              <p className="text-[12px] text-[#666]">Change requests are closed for completed moves.</p>
            )}
          </div>
        )}

        {activeTab === "track" && (
          <div className="space-y-5">
            {isCompleted ? (
              <div className="rounded-xl border border-[#E7E5E4] bg-white p-6 sm:p-8 text-center">
                <h2 className="font-hero text-[20px] font-semibold text-[#1A1A1A]">Your move is complete</h2>
                <p className="mt-2 text-[13px] text-[#666]">Thank you for choosing us. We hope your move went smoothly.</p>
                <a
                  href="https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block rounded-lg bg-[#C9A962] text-[var(--btn-text-on-accent)] font-semibold text-[12px] py-2.5 px-4 hover:bg-[#B89A52] transition-colors"
                >
                  Leave a Review
                </a>
              </div>
            ) : (
              <TrackLiveMap
                moveId={move.id}
                token={token}
                move={move}
                crew={crew}
                onLiveStageChange={setLiveStage}
              />
            )}
          </div>
        )}

        {activeTab === "inv" && (
          <div className="mb-6">
            <TrackInventory moveId={move.id} token={token} />
          </div>
        )}

        {activeTab === "photos" && (
          <div className="mb-6">
            <TrackPhotos moveId={move.id} token={token} />
          </div>
        )}

        {activeTab === "docs" && (
          <div className="mb-6">
            <TrackDocuments moveId={move.id} token={token} refreshTrigger={paymentRecorded} />
          </div>
        )}

        {activeTab === "msg" && (
          <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
            <h3 className="text-[14px] font-bold mb-3 text-[#1A1A1A]">Messages with your coordinator</h3>
            <div className="space-y-1.5 text-[13px] mb-4 text-[#1A1A1A]">
              <p>Phone: <a href={`tel:${normalizePhone(YUGO_PHONE)}`} className="text-[#C9A962] hover:underline">{formatPhone(YUGO_PHONE)}</a></p>
              <p>Email: <a href={`mailto:${YUGO_EMAIL}`} className="text-[#C9A962] hover:underline">{YUGO_EMAIL}</a></p>
            </div>
            <TrackMessageThread moveId={move.id} token={token} moveStatus={statusVal} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 text-center bg-white border-t border-[#E7E5E4]">
        <p className="text-[12px] text-[#666] mb-2">© Yugo — Art of moving</p>
        <p className="text-[11px] text-[#999]">
          <Link href="/privacy" className="text-[#C9A962] hover:underline">Privacy Policy</Link>
          <span className="mx-2">|</span>
          <Link href="/terms" className="text-[#C9A962] hover:underline">Terms of Use</Link>
        </p>
      </footer>

      {/* Change Request Modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E7E5E4] bg-white p-5">
            <h3 className="mb-3 text-[16px] font-bold text-[#1A1A1A] font-heading">Request a Change</h3>
            <p className="mb-4 text-[12px] text-[#666] leading-relaxed">
              Submit a change request. Your coordinator will review and confirm.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[#999]">Type of Change</label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-3 py-2 text-[12px] text-[#1A1A1A] focus:border-[#C9A962] outline-none"
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {changeType === "Change destination address" && (
                <div>
                  <AddressAutocomplete
                    value={changeAddress}
                    onRawChange={setChangeAddress}
                    onChange={(r) => setChangeAddress(r.fullAddress)}
                    placeholder="Enter new destination address"
                    label="New Address"
                    className="w-full rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-3 py-2 text-[12px] text-[#1A1A1A] focus:border-[#C9A962] outline-none"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[#999]">
                  {changeType === "Change destination address" ? "Additional details (optional)" : "Details"}
                </label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  placeholder={changeType === "Change destination address" ? "e.g. Access code, special instructions..." : "Describe what you need changed..."}
                  rows={changeType === "Change destination address" ? 2 : 4}
                  className="w-full resize-y rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-3 py-2 text-[12px] text-[#1A1A1A] placeholder:text-[#999] focus:border-[#C9A962] outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase text-[#999]">Urgency</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#666]">
                    <input type="radio" name="urgency" checked={!changeUrgent} onChange={() => setChangeUrgent(false)} className="accent-[#C9A962]" />
                    Normal
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#666]">
                    <input type="radio" name="urgency" checked={changeUrgent} onChange={() => setChangeUrgent(true)} className="accent-[#C9A962]" />
                    Urgent
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="flex-1 rounded-lg border border-[#E7E5E4] py-2.5 text-[12px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitChange}
                  disabled={
                    changeSubmitting ||
                    (changeType === "Change destination address" ? !changeAddress.trim() : !changeDesc.trim())
                  }
                  className="flex-1 rounded-lg bg-[#C9A962] py-2.5 text-[12px] font-bold text-[var(--btn-text-on-accent)] hover:bg-[#B89A52] disabled:opacity-50 transition-colors"
                >
                  {changeSubmitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
