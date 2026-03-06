"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
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
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { formatPhone, normalizePhone } from "@/lib/phone";
import YugoLogo from "@/components/YugoLogo";
import TipScreen from "@/components/tracking/TipScreen";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
};
type SquarePayments = { card: () => Promise<SquareCard> };
declare global {
  interface Window { Square?: { payments: (appId: string, locationId: string) => SquarePayments } }
}

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PRODUCTION = "https://web.squarecdn.com/v1/square.js";

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
  tippingEnabled = true,
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
  tippingEnabled?: boolean;
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
  const [dashboardInventory, setDashboardInventory] = useState<{ items: { id: string; room?: string; item_name?: string }[]; extraItems: { id: string; description?: string }[] } | null>(null);

  useEffect(() => {
    setLiveStage(move.stage || null);
  }, [move.stage]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/track/moves/${move.id}/inventory?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.items) setDashboardInventory({ items: data.items || [], extraItems: data.extraItems || [] });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [move.id, token]);

  // Auto-hide "your move status was recently updated" card after 5s when arriving from notify email
  useEffect(() => {
    if (!fromNotify) return;
    const t = setTimeout(() => setShowNotifyBanner(false), 5000);
    return () => clearTimeout(t);
  }, [fromNotify]);

  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [tipPreset, setTipPreset] = useState<number | null>(20);
  const [tipCustomDollars, setTipCustomDollars] = useState("");
  const [tipSubmitting, setTipSubmitting] = useState(false);

  // Full-screen tip system (auto-show on completion)
  const [showTipScreen, setShowTipScreen] = useState(false);
  const [showTipBanner, setShowTipBanner] = useState(false);

  // Determine if tip screen should show (respects tipping_enabled toggle)
  useEffect(() => {
    if (!tippingEnabled) return;
    const isComplete = move.status === "completed" || move.status === "delivered";
    const alreadyTipped = !!move.tip_charged_at;
    const alreadySkipped = !!move.tip_skipped_at;
    const hasCard = !!move.square_card_id;
    const tipPromptShown = !!move.tip_prompt_shown_at;

    if (!isComplete || alreadyTipped || !hasCard) return;

    if (alreadySkipped) {
      const skipDate = new Date(move.tip_skipped_at).getTime();
      const daysSinceSkip = (Date.now() - skipDate) / (1000 * 60 * 60 * 24);
      if (daysSinceSkip <= 7) setShowTipBanner(true);
      return;
    }

    if (!tipPromptShown) {
      setShowTipScreen(true);
      fetch(`/api/tips/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId: move.id, token, action: "prompt_shown" }),
      }).catch(() => {});
    }
  }, [tippingEnabled, move.status, move.tip_charged_at, move.tip_skipped_at, move.tip_prompt_shown_at, move.square_card_id, move.id, token]);

  // Also trigger tip screen when liveStage transitions to completed
  useEffect(() => {
    if (!tippingEnabled) return;
    if (liveStage !== "completed") return;
    const alreadyTipped = !!move.tip_charged_at;
    const alreadySkipped = !!move.tip_skipped_at;
    const hasCard = !!move.square_card_id;
    if (!alreadyTipped && !alreadySkipped && hasCard) {
      setTimeout(() => setShowTipScreen(true), 2000);
    }
  }, [tippingEnabled, liveStage, move.tip_charged_at, move.tip_skipped_at, move.square_card_id]);

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

  const tipAmountCents = (() => {
    if (tipPreset != null) return tipPreset * 100;
    const custom = parseFloat(tipCustomDollars);
    if (Number.isFinite(custom) && custom >= 1) return Math.round(custom * 100);
    return 0;
  })();

  const handleTipSubmit = async () => {
    if (tipAmountCents < 100) return;
    setTipSubmitting(true);
    try {
      const res = await fetch(
        `/api/track/moves/${move.id}/tip?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents: tipAmountCents }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast((data as { error?: string }).error || "Could not process tip. Please try again.", "x");
        return;
      }
      toast("Thank you! Your tip has been charged to your card on file.", "check");
      setTipModalOpen(false);
      setTipPreset(20);
      setTipCustomDollars("");
    } catch {
      toast("Something went wrong. Please try again.", "x");
    } finally {
      setTipSubmitting(false);
    }
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
  /** When move is in progress, show "Today's the day!" UI instead of countdown */
  const showAsMoveDay = daysUntil === 0 || isInProgress;
  const isPaid = move.status === "paid" || !!move.payment_marked_paid || paymentRecorded || showPaymentSuccess;
  const baseBalance = isPaid ? 0 : Number(move.estimate || 0);
  const feesDollars = isPaid ? 0 : (additionalFeesCents || 0) / 100;
  const totalBalance = baseBalance + feesDollars;
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [sqSdkReady, setSqSdkReady] = useState(false);
  const [sqCardReady, setSqCardReady] = useState(false);
  const [sqProcessing, setSqProcessing] = useState(false);
  const [sqError, setSqError] = useState<string | null>(null);
  const sqCardRef = useRef<SquareCard | null>(null);
  const sqInitRef = useRef(false);

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

  const initSquareCard = useCallback(async (appId: string, locationId: string) => {
    if (sqInitRef.current || !window.Square) return;
    sqInitRef.current = true;
    try {
      const payments = window.Square.payments(appId, locationId);
      const card = await payments.card();
      await card.attach("#sq-track-card");
      sqCardRef.current = card;
      setSqCardReady(true);
    } catch {
      setSqError("Unable to load payment form. Please refresh.");
    }
  }, []);

  useEffect(() => {
    if (!sqSdkReady || sqInitRef.current || !paymentModalOpen) return;
    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID?.trim();
    const locId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID?.trim();
    if (appId && locId) { initSquareCard(appId, locId); return; }

    let cancelled = false;
    let attempts = 0;
    const fetchCfg = () => {
      attempts++;
      fetch("/api/payments/config").then(r => r.json()).then(d => {
        if (cancelled || sqInitRef.current) return;
        const a = d.appId?.trim(); const l = d.locationId?.trim();
        if (a && l) initSquareCard(a, l);
        else if (attempts < 3) setTimeout(fetchCfg, 1500 * attempts);
        else setSqError("Payment not configured. Please contact support.");
      }).catch(() => { if (!cancelled && attempts < 3) setTimeout(fetchCfg, 1500 * attempts); else setSqError("Payment not configured."); });
    };
    fetchCfg();
    return () => { cancelled = true; };
  }, [sqSdkReady, initSquareCard, paymentModalOpen]);

  useEffect(() => { return () => { sqCardRef.current?.destroy(); }; }, []);

  const handleInlinePayment = async () => {
    if (!sqCardRef.current || sqProcessing) return;
    setSqProcessing(true);
    setSqError(null);
    try {
      const tokenResult = await sqCardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setSqError(tokenResult.errors?.[0]?.message ?? "Card verification failed.");
        setSqProcessing(false);
        return;
      }
      const res = await fetch("/api/payments/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: tokenResult.token, moveId: move.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSqError(data.error ?? "Payment failed. Please try again.");
        setSqProcessing(false);
        return;
      }
      setPaymentRecorded(true);
      setPaymentModalOpen(false);
      toast("Payment successful!", "check");
    } catch (e) {
      setSqError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setSqProcessing(false);
    }
  };

  const useSandbox = process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";
  const squareScriptUrl = useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dash", label: "Dashboard" },
    { key: "track" as TabKey, label: "Live Tracking" },
    { key: "inv", label: "Inventory" },
    { key: "photos", label: "Photos" },
    { key: "docs", label: "Documents" },
    { key: "msg", label: "Messages" },
  ];

  const moveTotal = Number(move.amount || move.estimate || 0);

  if (tippingEnabled && showTipScreen) {
    return (
      <TipScreen
        moveId={move.id}
        token={token}
        clientName={move.client_name || ""}
        crewName={crew?.name || "Your Crew"}
        crewMembers={Array.isArray(move.assigned_members) ? move.assigned_members : crew?.members}
        moveTotal={moveTotal}
        hoursWorked={move.estimated_hours ? Number(move.estimated_hours) : undefined}
        cardLast4={move.card_last4 || null}
        onComplete={() => { setShowTipScreen(false); router.refresh(); }}
        onSkip={() => { setShowTipScreen(false); }}
      />
    );
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen font-sans flex items-center justify-center px-4" data-theme="light" style={{ backgroundColor: CREAM, color: FOREST }}>
        <div className="max-w-md w-full text-center">
          <h1 className="font-hero text-h1 sm:text-hero font-semibold mb-2" style={{ color: WINE }}>Your move is complete</h1>
          <p className="text-body mb-6 opacity-80" style={{ color: FOREST }}>
            This tracking link has expired. If you need documents or support, please contact us.
          </p>
          <a
            href={`tel:${normalizePhone(YUGO_PHONE)}`}
            className="inline-block rounded-lg font-semibold text-ui py-2.5 px-4 transition-colors hover:opacity-90"
            style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
          >
            Contact us
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" data-theme="light" style={{ backgroundColor: CREAM, color: FOREST }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ backgroundColor: `${WINE}F5`, borderColor: `${WINE}80` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <YugoLogo size={20} variant="gold" />
            <span
              className="text-nano font-bold px-1.5 py-[2px] rounded tracking-[1.5px] uppercase leading-none"
              style={{ color: CREAM, backgroundColor: `${GOLD}CC`, letterSpacing: "1.5px" }}
            >
              BETA
            </span>
          </div>
          {isInProgress && liveStage != null && (
            <button
              type="button"
              onClick={() => setActiveTab("track")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label font-bold transition-colors"
              style={{ backgroundColor: `${GOLD}25`, color: GOLD }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#22C55E" }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: "#22C55E" }} />
              </span>
              LIVE
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-6 min-w-0 w-full pb-8">
        {showPaymentSuccess && (
          <div className="mb-5 rounded-xl border bg-white p-6 sm:p-8 animate-fade-up" style={{ borderColor: `${FOREST}25` }}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex justify-center sm:justify-start shrink-0">
                <div className="relative w-[72px] h-[72px] sm:w-20 sm:h-20">
                  <svg viewBox="0 0 80 80" fill="none" className="w-full h-full drop-shadow-sm">
                    <defs>
                      <linearGradient id="success-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={GOLD} />
                        <stop offset="100%" stopColor="#A07F26" />
                      </linearGradient>
                    </defs>
                    <circle cx="40" cy="40" r="36" fill="url(#success-bg)" stroke={GOLD} strokeWidth="2" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="5 3" opacity="0.4" />
                    <path d="M28 40 L36 48 L52 32" stroke={FOREST} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h2 className="text-h2-sm sm:text-h2 font-bold font-heading" style={{ color: WINE }}>Payment received</h2>
                <p className="text-title mt-2 leading-relaxed opacity-80" style={{ color: FOREST }}>
                  Thank you for making your final payment. We are excited to see you on move day!
                </p>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="mt-5 rounded-lg font-semibold text-title py-3 px-5 transition-colors shadow-sm hover:opacity-90"
                  style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
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
                className={`rounded-xl border px-4 py-3 transition-opacity duration-300 ease-out ${showNotifyBanner ? "opacity-100" : "opacity-0"}`}
                style={{ borderColor: `${GOLD}40`, backgroundColor: `${GOLD}12` }}
              >
                <div className="text-body font-semibold" style={{ color: FOREST }}>Your move status was recently updated</div>
                <div className="text-caption mt-0.5 opacity-80" style={{ color: FOREST }}>View the details below to see what changed.</div>
              </div>
            </div>
          </div>
        )}
        {/* Tip banner (revisit within 7 days after skipping) */}
        {tippingEnabled && showTipBanner && !move.tip_charged_at && (
          <div className="mb-5 rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: `${GOLD}40`, backgroundColor: `${GOLD}12` }}>
            <div>
              <div className="text-body font-semibold" style={{ color: FOREST }}>Leave a tip for your crew?</div>
              <div className="text-caption mt-0.5 opacity-70" style={{ color: FOREST }}>100% goes directly to your movers.</div>
            </div>
            <button
              type="button"
              onClick={() => { setShowTipBanner(false); setShowTipScreen(true); }}
              className="shrink-0 rounded-lg font-semibold text-ui py-2 px-4 transition-colors hover:opacity-90"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              Leave Tip
            </button>
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
                  <p className="text-body mb-0.5 font-sans opacity-80" style={{ color: FOREST }}>
                    {greeting}, {firstName}
                  </p>
                  <h1 className="font-hero text-h2 sm:text-h1-lg leading-tight font-semibold tracking-tight" style={{ color: WINE }}>
                    {move.client_name || "Your Move"}
                  </h1>
                  <p className="text-body mt-0.5 font-sans opacity-80" style={{ color: FOREST }}>
                    {displayCode} • {typeLabel}
                  </p>
                  <p className="text-ui mt-0.5 font-sans opacity-80" style={{ color: FOREST }}>
                    {subtitle}
                  </p>
                </>
              );
            })()}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold shrink-0" style={{ backgroundColor: `${GOLD}20`, color: WINE }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} aria-hidden />
            {getStatusLabel(statusVal)}
          </span>
        </div>

        {/* Main countdown section */}
        <div className="py-4 sm:py-6 mb-3">
          {isCompleted ? (
            <div className="text-center">
              <div className="font-hero text-h1 sm:text-hero leading-tight font-semibold" style={{ color: WINE }}>
                Your Move is Complete
              </div>
              <p className="mt-2 text-body font-sans opacity-80" style={{ color: FOREST }}>
                Please tell us about your move.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg font-semibold text-ui py-2.5 px-5 transition-colors hover:opacity-90 border-2"
                  style={{ backgroundColor: GOLD, color: "#1A1A1A", borderColor: GOLD }}
                >
                  Leave a Review
                </a>
                <button
                  type="button"
                  onClick={() => setTipModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg font-semibold text-ui py-2.5 px-5 transition-colors hover:opacity-90 border-2"
                  style={{ borderColor: FOREST, color: FOREST, backgroundColor: "transparent" }}
                >
                  Leave a Tip
                </button>
              </div>
            </div>
          ) : daysUntil === 0 ? (
            <>
              <div className="text-center">
                <div className="font-hero text-hero md:text-price-xs leading-tight font-semibold" style={{ color: GOLD }}>Today&apos;s the day!</div>
                <div className="mt-1 text-body font-sans opacity-80" style={{ color: FOREST }}>
                  {isInProgress && liveStage != null
                    ? LIVE_TRACKING_STAGES.find((s) => s.key === liveStage)?.label ?? "In progress"
                    : arrivalWindow
                      ? `Your crew arrives between ${arrivalWindow}`
                      : "Your crew is on the way"}
                </div>
                {crewMembers.length > 0 && (
                  <div className="mt-2 text-ui text-[#2D2D2D] font-sans">Crew: {crewMembers.join(", ")}</div>
                )}
              </div>
              {/* Stage progress bar: En Route → Loading → In Transit (to destination) → Unloading → Complete */}
              {scheduledDate && (
                <div className="mt-6">
                  <StageProgressBar
                    stages={[
                      { label: "En Route" },
                      { label: "Loading" },
                      { label: "In Transit" },
                      { label: "Unloading" },
                      { label: "Complete" },
                    ]}
                    currentIndex={
                      isCompleted
                        ? 4
                        : isInProgress && liveStage != null
                          ? (() => {
                              const s = liveStage as string;
                              if (["job_complete", "completed"].includes(s)) return 4;
                              if (["unloading", "arrived_at_destination"].includes(s)) return 3;
                              if (["en_route_to_destination", "in_transit"].includes(s)) return 2;
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
          ) : daysUntil != null && daysUntil < 0 && !isInProgress ? (
            <div className="text-center">
              <div className="font-hero text-h2-sm sm:text-h1 leading-tight font-semibold" style={{ color: WINE }}>
                Move day has passed
              </div>
              <p className="mt-1 text-body font-sans opacity-80" style={{ color: FOREST }}>
                Your move will be marked complete soon. Contact us if you have questions.
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="font-hero text-display sm:text-display-lg md:text-display-xl leading-none font-semibold tracking-tight" style={{ color: GOLD }}>
                  {daysUntil ?? "—"}
                </div>
                <div className="mt-1 text-body font-sans" style={{ color: FOREST }}>days until move day</div>
                {scheduledDate && (
                  <div className="mt-3 text-title font-sans">
                    <span className="font-semibold" style={{ color: FOREST }}>
                      {scheduledDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                    {arrivalWindow && (
                      <span className="font-normal" style={{ color: FOREST }}> • {arrivalWindow}</span>
                    )}
                  </div>
                )}
              </div>
              {/* Stage progress bar: En Route → Loading → In Transit (to destination) → Unloading → Complete */}
              {scheduledDate && (
                <div className="mt-6">
                  <StageProgressBar
                    stages={[
                      { label: "En Route" },
                      { label: "Loading" },
                      { label: "In Transit" },
                      { label: "Unloading" },
                      { label: "Complete" },
                    ]}
                    currentIndex={
                      isCompleted
                        ? 4
                        : isInProgress && liveStage != null
                          ? (() => {
                              const s = liveStage as string;
                              if (["job_complete", "completed"].includes(s)) return 4;
                              if (["unloading", "arrived_at_destination"].includes(s)) return 3;
                              if (["en_route_to_destination", "in_transit"].includes(s)) return 2;
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

        {!isCompleted && showAsMoveDay && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {isInProgress && liveStage != null ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
                  </>
                ) : (
                  <span className="inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: GOLD, opacity: 0.6 }} />
                )}
              </span>
              <div className="min-w-0">
                <span className="text-body font-semibold" style={{ color: FOREST }}>
                  {isInProgress && liveStage != null
                    ? LIVE_TRACKING_STAGES.find((s) => s.key === liveStage)?.label ?? "Live"
                    : "Live"}
                </span>
                <span className="text-caption ml-1.5 opacity-60" style={{ color: FOREST }}>
                  {isInProgress && liveStage != null
                    ? "See your crew on the map"
                    : "Map appears when crew starts"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("track")}
              className="shrink-0 rounded-full font-semibold text-caption py-1.5 px-4 transition-all hover:opacity-90"
              style={{ backgroundColor: isInProgress && liveStage != null ? "#22C55E" : GOLD, color: isInProgress && liveStage != null ? "white" : "#1A1A1A" }}
            >
              View
            </button>
          </div>
        )}

        {/* Tabs - horizontally scrollable on mobile with fade hint */}
        <div className="relative mb-5 overflow-hidden">
          <div
            className="flex gap-0 overflow-x-auto overflow-y-hidden scrollbar-hide bg-white rounded-t-lg scroll-smooth"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 px-4 py-3 text-ui font-semibold whitespace-nowrap border-b-2 rounded-t-lg transition-colors ${
                  activeTab === t.key
                    ? "text-[#B8962E] border-[#B8962E]"
                    : "border-transparent opacity-60 hover:opacity-80"
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
          <div className="space-y-0">
            {/* Move Timeline - Confirmed → Scheduled → In Progress → Completed (Paid shown in financial section) */}
            <div className="pt-6">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Move Timeline</h3>
              <div className="relative pl-7 before:content-[''] before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-0.5 before:bg-[#2C3E2D20] before:transition-colors before:duration-500">
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
                            : "w-3 h-3 bg-[#2C3E2D20] group-hover:bg-[#2C3E2D40]"
                        }`}
                      />
                      <div className={`text-body font-semibold transition-colors duration-300 ${state === "done" ? "text-[#22C55E]" : state === "act" ? "text-[#F59E0B]" : "text-[#999]"}`}>
                        {s.label}
                      </div>
                      <div className="text-caption mt-0.5 opacity-80" style={{ color: FOREST }}>
                        {state === "done" ? (completedDate ? `Completed ${completedDate}` : sub.done) : state === "act" ? (actDateStr ? `In Progress — ${actDateStr}` : sub.act) : sub.wait}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {additionalFeesCents > 0 && !isPaid && (
              <div className="border-t border-[var(--brd)]/30 pt-6 pb-4 text-body" style={{ color: FOREST }}>
                You have additional charges of {formatCurrency((additionalFeesCents || 0) / 100)} from approved change requests and extra items. Pay below.
              </div>
            )}

            {/* Inventory summary on dashboard */}
            <div className="border-t border-[var(--brd)]/30 pt-6 pb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}12` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  </div>
                  <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Inventory</h3>
                </div>
                {(dashboardInventory?.items?.length ?? 0) > 0 || (dashboardInventory?.extraItems?.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("inv")}
                    className="text-ui font-semibold hover:opacity-80 transition-opacity flex items-center gap-1"
                    style={{ color: GOLD }}
                  >
                    View all
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ) : null}
              </div>
              {dashboardInventory === null ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-ui opacity-60" style={{ color: FOREST }}>Loading inventory...</p>
                </div>
              ) : (dashboardInventory?.items?.length ?? 0) === 0 && (dashboardInventory?.extraItems?.length ?? 0) === 0 ? (
                <div>
                  <p className="text-ui opacity-80" style={{ color: FOREST }}>No inventory items logged yet. Your coordinator will add items as your move is prepared.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("inv")}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-caption font-semibold transition-colors"
                    style={{ borderColor: `${GOLD}50`, color: GOLD }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Extra Item
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-h2-sm font-bold font-hero" style={{ color: GOLD }}>
                      {(dashboardInventory?.items?.length ?? 0) + (dashboardInventory?.extraItems?.length ?? 0)}
                    </span>
                    <span className="text-ui opacity-70" style={{ color: FOREST }}>items on file</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("inv")}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-caption font-semibold transition-colors"
                    style={{ borderColor: `${GOLD}50`, color: GOLD }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Extra Item
                  </button>
                </div>
              )}
            </div>

            {/* Move Details + Your Crew grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[var(--brd)]/30">
              <div>
                <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Move Details</h3>
                <div className="space-y-3">
                  {scheduledDate && (
                    <div>
                      <div className="text-label font-semibold uppercase mb-0.5 opacity-80" style={{ color: FOREST }}>Date & Time</div>
                      <div className="text-body" style={{ color: FOREST }}>
                        {formatMoveDate(scheduledDate)}
                        {arrivalWindow && (
                          <span className="block text-ui mt-0.5 opacity-80" style={{ color: FOREST }}>
                            Crew arrives between {arrivalWindow}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-label font-semibold uppercase mb-0.5 opacity-80" style={{ color: FOREST }}>From</div>
                    <div className="text-body" style={{ color: FOREST }}>{move.from_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-label font-semibold uppercase mb-0.5 opacity-80" style={{ color: FOREST }}>To</div>
                    <div className="text-body" style={{ color: FOREST }}>{move.to_address || move.delivery_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-label font-semibold uppercase mb-0.5 opacity-80" style={{ color: FOREST }}>Total Balance</div>
                    <div className="font-hero text-h3-lg font-bold" style={{ color: GOLD }}>{formatCurrency(totalBalance)}</div>
                    {totalBalance > 0 && <div className="text-label opacity-60" style={{ color: FOREST }}>+{formatCurrency(calcHST(totalBalance))} HST</div>}
                  </div>
                  {totalBalance > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setPaymentModalOpen(true)}
                        className="w-full rounded-lg font-semibold text-body py-3 px-4 transition-colors hover:opacity-90"
                        style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                      >
                        Make Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">
                  Your Crew ({crewMembers.length})
                </h3>
                {crewMembers.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {crewMembers.map((name: string, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#C19A6B] flex items-center justify-center text-caption font-bold text-white shrink-0">
                            {(name || "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-body font-bold" style={{ color: FOREST }}>{name}</div>
                            <div className="text-caption opacity-80" style={{ color: FOREST }}>{crewRoles[i] || "Team member"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#E0E0E0]">
                      <div className="text-body font-bold" style={{ color: FOREST }}>Coordinator</div>
                      <a href={`tel:${normalizePhone(YUGO_PHONE)}`} className="inline-flex items-center gap-2 text-body mt-0.5 transition-colors hover:opacity-80" style={{ color: FOREST }} onMouseOver={(e) => { e.currentTarget.style.color = GOLD; }} onMouseOut={(e) => { e.currentTarget.style.color = FOREST; }}>
                        <YugoLogo size={14} variant="gold" onLightBackground />
                        <span>{formatPhone(YUGO_PHONE)}</span>
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-ui opacity-80" style={{ color: FOREST }}>
                    Your crew will be assigned as your move is confirmed. Contact us with any questions.
                  </div>
                )}
              </div>
            </div>

            {changeSubmitted && (
              <div className="border-t border-[var(--brd)]/30 pt-6">
                <div className="text-body font-semibold" style={{ color: FOREST }}>Change request submitted</div>
                <div className="text-ui mt-0.5 opacity-80" style={{ color: FOREST }}>Your coordinator will reach out within 10 minutes.</div>
              </div>
            )}

            {/* Request a Change - hide when move is completed */}
            {!isCompleted && (
              <div className="border-t border-[var(--brd)]/30 pt-6">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(true)}
                  className="w-full rounded-xl border-2 border-dashed py-4 text-ui font-semibold transition-colors flex items-center justify-center gap-2 bg-white"
                  style={{ borderColor: `${FOREST}30`, color: FOREST }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = `${FOREST}30`; e.currentTarget.style.color = FOREST; }}
                >
                  Request a Change
                </button>
              </div>
            )}
            {isCompleted && (
              <p className="text-ui opacity-80" style={{ color: FOREST }}>Change requests are closed for completed moves.</p>
            )}
          </div>
        )}

        {activeTab === "track" && (
          <div className="space-y-5">
            {isCompleted ? (
              <div className="rounded-xl border bg-white p-6 sm:p-8 text-center" style={{ borderColor: `${FOREST}20` }}>
                <h2 className="font-hero text-h2-sm font-semibold" style={{ color: WINE }}>Your move is complete</h2>
                <p className="mt-2 text-body opacity-80" style={{ color: FOREST }}>Thank you for choosing us. We hope your move went smoothly.</p>
                <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href="https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg font-semibold text-ui py-2.5 px-5 transition-colors hover:opacity-90 border-2"
                    style={{ backgroundColor: GOLD, color: "#1A1A1A", borderColor: GOLD }}
                  >
                    Leave a Review
                  </a>
                  <button
                    type="button"
                    onClick={() => setTipModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg font-semibold text-ui py-2.5 px-5 transition-colors hover:opacity-90 border-2"
                    style={{ borderColor: FOREST, color: FOREST, backgroundColor: "transparent" }}
                  >
                    Leave a Tip
                  </button>
                </div>
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
            <TrackInventory moveId={move.id} token={token} moveComplete={isCompleted} />
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
          <div className="pt-6 border-t border-[var(--brd)]/30">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Messages with your coordinator</h3>
            <div className="space-y-1.5 text-body mb-4" style={{ color: FOREST }}>
              <p>Phone: <a href={`tel:${normalizePhone(YUGO_PHONE)}`} className="hover:underline font-medium" style={{ color: GOLD }}>{formatPhone(YUGO_PHONE)}</a></p>
              <p>Email: <a href={`mailto:${YUGO_EMAIL}`} className="hover:underline font-medium" style={{ color: GOLD }}>{YUGO_EMAIL}</a></p>
            </div>
            <TrackMessageThread moveId={move.id} token={token} moveStatus={statusVal} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-10 px-4 text-center" style={{ backgroundColor: CREAM }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <YugoLogo size={16} variant="gold" onLightBackground />
        </div>
        <p className="text-caption mb-2 opacity-60" style={{ color: FOREST }}>
          Premium Moving · Toronto &amp; GTA
        </p>
        <p className="text-label opacity-50" style={{ color: FOREST }}>
          <Link href="/privacy" className="hover:underline font-medium" style={{ color: GOLD }}>Privacy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:underline font-medium" style={{ color: GOLD }}>Terms</Link>
          <span className="mx-2">·</span>
          <a href={`mailto:${YUGO_EMAIL}`} className="hover:underline font-medium" style={{ color: GOLD }}>{YUGO_EMAIL}</a>
        </p>
      </footer>

      {/* Tip Modal */}
      {tipModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => !tipSubmitting && setTipModalOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border-2 shadow-xl bg-white overflow-hidden"
            style={{ borderColor: `${FOREST}20` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8" style={{ backgroundColor: CREAM }}>
              <h3 className="font-hero text-h2-sm font-semibold text-center" style={{ color: WINE }}>
                Leave a Tip
              </h3>
              <p className="mt-2 text-center text-ui opacity-90" style={{ color: FOREST }}>
                Thank your crew. This will be charged to the card on your file.
              </p>
              <div className="mt-6">
                <p className="text-label font-bold uppercase tracking-wider mb-3 opacity-80" style={{ color: FOREST }}>
                  Amount
                </p>
                <div className="flex flex-wrap gap-2">
                  {[20, 50, 100].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setTipPreset(d); setTipCustomDollars(""); }}
                      className="rounded-xl border-2 px-4 py-2.5 text-title font-semibold transition-all"
                      style={{
                        borderColor: tipPreset === d ? GOLD : `${FOREST}30`,
                        color: tipPreset === d ? WINE : FOREST,
                        backgroundColor: tipPreset === d ? `${GOLD}25` : "transparent",
                      }}
                    >
                      ${d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setTipPreset(null); setTipCustomDollars(""); }}
                    className="rounded-xl border-2 px-4 py-2.5 text-title font-semibold transition-all"
                    style={{
                      borderColor: tipPreset === null ? GOLD : `${FOREST}30`,
                      color: tipPreset === null ? WINE : FOREST,
                      backgroundColor: tipPreset === null ? `${GOLD}25` : "transparent",
                    }}
                  >
                    Custom
                  </button>
                </div>
                {tipPreset === null && (
                  <div className="mt-3">
                    <label className="sr-only">Custom amount ($)</label>
                    <div className="flex items-center rounded-xl border-2 px-4 py-2.5" style={{ borderColor: `${FOREST}30` }}>
                      <span className="text-title font-semibold mr-2" style={{ color: FOREST }}>$</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Enter amount"
                        value={tipCustomDollars}
                        onChange={(e) => setTipCustomDollars(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="flex-1 bg-transparent text-title font-semibold outline-none min-w-0"
                        style={{ color: FOREST }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => !tipSubmitting && setTipModalOpen(false)}
                  className="flex-1 rounded-xl border-2 py-3 text-body font-semibold transition-colors"
                  style={{ borderColor: `${FOREST}30`, color: FOREST }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTipSubmit}
                  disabled={tipSubmitting || tipAmountCents < 100}
                  className="flex-1 rounded-xl py-3 text-body font-bold transition-colors disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                >
                  {tipSubmitting ? "Processing…" : `Pay ${formatCurrency(tipAmountCents / 100)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-5" style={{ borderColor: `${FOREST}20` }}>
            <h3 className="mb-3 text-h3 font-bold font-heading" style={{ color: WINE }}>Request a Change</h3>
            <p className="mb-4 text-ui leading-relaxed opacity-80" style={{ color: FOREST }}>
              Submit a change request. Your coordinator will review and confirm.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-label font-bold uppercase opacity-80" style={{ color: FOREST }}>Type of Change</label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-ui outline-none focus:ring-2"
                  style={{ borderColor: `${FOREST}25`, backgroundColor: CREAM, color: FOREST }}
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {changeType === "Change destination address" && (
                <div style={{ borderColor: `${FOREST}25`, backgroundColor: CREAM, color: FOREST }}>
                  <AddressAutocomplete
                    value={changeAddress}
                    onRawChange={setChangeAddress}
                    onChange={(r) => setChangeAddress(r.fullAddress)}
                    placeholder="Enter new destination address"
                    label="New Address"
                    className="w-full rounded-lg border px-3 py-2 text-ui outline-none focus:ring-2"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-label font-bold uppercase opacity-80" style={{ color: FOREST }}>
                  {changeType === "Change destination address" ? "Additional details (optional)" : "Details"}
                </label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  placeholder={changeType === "Change destination address" ? "e.g. Access code, special instructions..." : "Describe what you need changed..."}
                  rows={changeType === "Change destination address" ? 2 : 4}
                  className="w-full resize-y rounded-lg border px-3 py-2 text-ui placeholder:opacity-60 outline-none focus:ring-2"
                  style={{ borderColor: `${FOREST}25`, backgroundColor: CREAM, color: FOREST }}
                />
              </div>
              <div>
                <label className="mb-2 block text-label font-bold uppercase opacity-80" style={{ color: FOREST }}>Urgency</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-ui opacity-80" style={{ color: FOREST }}>
                    <input type="radio" name="urgency" checked={!changeUrgent} onChange={() => setChangeUrgent(false)} className="accent-[#B8962E]" />
                    Normal
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-ui opacity-80" style={{ color: FOREST }}>
                    <input type="radio" name="urgency" checked={changeUrgent} onChange={() => setChangeUrgent(true)} className="accent-[#B8962E]" />
                    Urgent
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="flex-1 rounded-lg border py-2.5 text-ui font-semibold transition-colors"
                  style={{ borderColor: `${FOREST}25`, color: FOREST }}
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
                  className="flex-1 rounded-lg py-2.5 text-ui font-bold disabled:opacity-50 transition-colors hover:opacity-90"
                  style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                >
                  {changeSubmitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Payment modal with inline card form */}
      {paymentModalOpen && (
        <>
          <Script src={squareScriptUrl} strategy="afterInteractive" onLoad={() => setSqSdkReady(true)} onError={() => setSqError("Payment script failed to load.")} />
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPaymentModalOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto safe-area-bottom">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-h3 font-bold" style={{ color: FOREST }}>Pay Balance</h2>
                  <button type="button" onClick={() => setPaymentModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F0F0F0] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: `${FOREST}15`, backgroundColor: `${CREAM}` }}>
                  <div className="flex justify-between text-body mb-1.5" style={{ color: FOREST }}>
                    <span className="opacity-70">Move balance</span>
                    <span className="font-semibold">{formatCurrency(totalBalance)}</span>
                  </div>
                  <div className="flex justify-between text-body mb-1.5" style={{ color: FOREST }}>
                    <span className="opacity-70">HST (13%)</span>
                    <span className="font-semibold">{formatCurrency(calcHST(totalBalance))}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between text-title font-bold" style={{ borderColor: `${FOREST}15`, color: GOLD }}>
                    <span>Total</span>
                    <span>{formatCurrency(totalBalance + calcHST(totalBalance))}</span>
                  </div>
                </div>

                <div className="mb-1.5">
                  <div className="text-section font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>Card Details</div>
                  <div className="rounded-xl border-2 p-3.5 transition-colors" style={{ borderColor: sqCardReady ? GOLD : `${FOREST}15`, backgroundColor: CREAM }}>
                    <div id="sq-track-card" style={{ minHeight: 80 }} />
                    {!sqSdkReady && !sqError && (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${GOLD}30`, borderTopColor: GOLD }} />
                        <span className="ml-2 text-caption opacity-60" style={{ color: FOREST }}>Loading…</span>
                      </div>
                    )}
                  </div>
                </div>

                {sqError && (
                  <div className="px-3 py-2 rounded-lg text-caption font-medium mb-3" style={{ backgroundColor: "rgba(209,67,67,0.08)", color: "#D14343", border: "1px solid rgba(209,67,67,0.2)" }}>
                    {sqError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInlinePayment}
                  disabled={!sqCardReady || sqProcessing}
                  className="w-full py-3 rounded-xl text-body font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                  style={{ backgroundColor: sqCardReady && !sqProcessing ? GOLD : `${GOLD}60`, color: "#1A1A1A" }}
                >
                  {sqProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(0,0,0,0.2)", borderTopColor: "#0D0D0D" }} />
                      Processing…
                    </span>
                  ) : (
                    `Pay ${formatCurrency(totalBalance + calcHST(totalBalance))}`
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="text-label opacity-50" style={{ color: FOREST }}>Secured by Square · 256-bit encryption</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
