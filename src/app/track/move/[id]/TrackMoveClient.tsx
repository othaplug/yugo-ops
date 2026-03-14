"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { getMoveCode, formatJobId } from "@/lib/move-code";
import TrackInventory from "./TrackInventory";
import TrackPhotos from "./TrackPhotos";
import TrackDocuments from "./TrackDocuments";
import TrackLiveMap from "./TrackLiveMap";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import StageProgressBar from "@/components/StageProgressBar";
import { useToast } from "@/app/admin/components/Toast";
import {
  MOVE_STATUS_INDEX,
  LIVE_TRACKING_STAGES,
  getStatusLabel,
} from "@/lib/move-status";
import { formatMoveDate, parseDateOnly } from "@/lib/date-format";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { formatPhone, normalizePhone } from "@/lib/phone";
import YugoLogo from "@/components/YugoLogo";
import TipScreen from "@/components/tracking/TipScreen";
import ClientSettingsMenu from "./ClientSettingsMenu";
import TrackingAgreementModal from "./TrackingAgreementModal";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";

function formatPerkOffer(offerType: string, discountValue: number | null): string {
  if (offerType === "percentage_off" && discountValue) return `${discountValue}% off`;
  if (offerType === "dollar_off" && discountValue) return `$${discountValue} off`;
  if (offerType === "free_service") return "Free service";
  if (offerType === "consultation") return "Free consultation";
  if (offerType === "priority_access") return "Priority booking";
  return "Special offer";
}

function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  const parts = addr.split(",").map((s) => s.trim());
  // Keep street + city only: "507 King St E, Toronto, Ontario M5A 1M3, Canada" → "507 King St E, Toronto"
  return parts.slice(0, 2).join(", ");
}

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

type TabKey = "dash" | "track" | "inv" | "files";

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

  type Perk = {
    id: string;
    title: string;
    description: string | null;
    offer_type: string;
    discount_value: number | null;
    redemption_code: string | null;
    redemption_url: string | null;
    valid_until: string | null;
    partner_id: string | null;
  };
  type ClientReferral = {
    id: string;
    referral_code: string;
    referrer_credit: number;
    referred_discount: number;
    status: string;
    used_at: string | null;
    created_at: string;
  };
  const [perks, setPerks] = useState<Perk[]>([]);
  const [referral, setReferral] = useState<ClientReferral | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [showMoveDetails, setShowMoveDetails] = useState(false);
  const [detailsSubTab, setDetailsSubTab] = useState<"details" | "photos" | "docs" | "inv">("details");

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
      .catch((err) => { console.error("Failed to load move inventory:", err); });
    return () => { cancelled = true; };
  }, [move.id, token]);

  // Fetch perks + referral code for completed moves
  useEffect(() => {
    const isComplete = move.status === "completed" || move.status === "delivered";
    if (!isComplete) return;
    let cancelled = false;
    fetch(`/api/track/moves/${move.id}/perks-referral?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.perks) setPerks(data.perks);
        if (data?.referral) setReferral(data.referral);
      })
      .catch((err) => { console.error("Failed to load perks/referral:", err); });
    return () => { cancelled = true; };
  }, [move.id, move.status, token]);

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
      }).catch((err) => { console.error("Failed to record tip prompt shown:", err); });
    }
  }, [tippingEnabled, move.status, move.tip_charged_at, move.tip_skipped_at, move.tip_prompt_shown_at, move.square_card_id, move.id, token]);

  // Also trigger tip screen when liveStage TRANSITIONS to completed (not on initial load)
  const prevLiveStage = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevLiveStage.current;
    prevLiveStage.current = liveStage;
    if (!tippingEnabled) return;
    // Only fire when the stage actually changes TO "completed", not on mount
    if (liveStage !== "completed" || prev === liveStage || prev === null) return;
    const alreadyTipped = !!move.tip_charged_at;
    const alreadySkipped = !!move.tip_skipped_at;
    const tipPromptShown = !!move.tip_prompt_shown_at;
    const hasCard = !!move.square_card_id;
    if (!alreadyTipped && !alreadySkipped && !tipPromptShown && hasCard) {
      setTimeout(() => setShowTipScreen(true), 2000);
    }
  }, [tippingEnabled, liveStage, move.tip_charged_at, move.tip_skipped_at, move.tip_prompt_shown_at, move.square_card_id]);

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
      .catch((err) => { console.error("Failed to record payment after Square redirect:", err); });
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
          const eta = data.eta_current_minutes ?? data.etaMinutes;
          if (eta != null) setLiveEtaMinutes(eta);
          else setLiveEtaMinutes(null);
        }
      } catch (err) {
        console.error("Failed to poll move crew status:", err);
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [move.id, token]);

  const moveCode = getMoveCode(move);
  const displayCode = formatJobId(moveCode, "move");

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
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


  const [liveScheduledDate, setLiveScheduledDate] = useState<string | null>(move.scheduled_date || null);
  const [liveArrivalWindow, setLiveArrivalWindow] = useState<string | null>(move.arrival_window || null);
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(move.eta_current_minutes ?? null);
  const scheduledDate = liveScheduledDate ? (parseDateOnly(liveScheduledDate) ?? new Date(liveScheduledDate)) : null;
  const arrivalWindow = liveArrivalWindow ?? move.arrival_window ?? null;
  const daysUntil = scheduledDate ? Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000) : null;
  const isPaid = move.status === "paid" || !!move.payment_marked_paid || !!move.balance_paid_at || paymentRecorded || showPaymentSuccess;
  const baseBalance = isPaid ? 0 : Number(move.balance_amount || 0);
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
    { key: "files", label: "Files" },
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
          <h1 className="font-hero text-[26px] sm:text-[30px] font-semibold mb-2" style={{ color: WINE }}>Your move is complete</h1>
          <p className="text-[13px] mb-6 opacity-80" style={{ color: FOREST }}>
            This tracking link has expired. If you need documents or support, please contact us.
          </p>
          <a
            href={`tel:${normalizePhone(YUGO_PHONE)}`}
            className="inline-block rounded-lg font-semibold text-[12px] py-2.5 px-4 transition-colors hover:opacity-90"
            style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
          >
            Contact us
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans flex flex-col" data-theme="light" style={{ backgroundColor: CREAM, color: FOREST }}>
      <TrackingAgreementModal />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ backgroundColor: `${WINE}F5`, borderColor: `${WINE}80` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <YugoLogo size={20} variant="gold" />
            <span
              className="text-[7px] font-medium px-1 py-[1px] rounded tracking-[1px] uppercase leading-none opacity-50"
              style={{ color: GOLD, letterSpacing: "1px" }}
            >
              BETA
            </span>
          </div>
          <ClientSettingsMenu
            moveId={move.id}
            clientName={move.client_name || ""}
            clientEmail={move.client_email || ""}
            clientPhone={move.client_phone || ""}
            valuationTier={move.tier_selected || move.service_tier || "released"}
          />
        </div>
      </header>

      <main className="flex-1 max-w-[800px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-6 min-w-0 w-full pb-8">
        {showPaymentSuccess && (
          <div className="mb-5 text-center py-6 animate-fade-up">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3" style={{ backgroundColor: `${GOLD}20` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="text-[13px] font-semibold" style={{ color: WINE }}>Payment received</h2>
            <p className="text-[11px] mt-1 opacity-60" style={{ color: FOREST }}>
              Thank you. See you on move day.
            </p>
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="mt-4 rounded-md font-semibold text-[11px] py-2 px-4 transition-colors hover:opacity-90"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              Continue
            </button>
          </div>
        )}
        {fromNotify && !showPaymentSuccess && showNotifyBanner && (
          <div className="mb-4 text-[11px] font-medium opacity-60 transition-opacity" style={{ color: FOREST }}>
            Your move status was recently updated.
          </div>
        )}
        {/* Client header */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium mb-0.5 opacity-50" style={{ color: FOREST }}>
              {greeting}
            </p>
            <h1 className="font-hero text-[26px] sm:text-[28px] leading-tight font-semibold tracking-tight truncate" style={{ color: WINE }}>
              {move.client_name || "Your Move"}
            </h1>
            <p className="text-[11px] mt-0.5 font-sans opacity-40 flex items-center gap-1.5" style={{ color: FOREST }}>
              {displayCode}
              {(move.tier || move.service_tier) && (
                <span
                  className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${GOLD}18`, color: GOLD, opacity: 1 }}
                >
                  {move.tier || move.service_tier}
                </span>
              )}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0" style={{ backgroundColor: `${GOLD}15`, color: WINE }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} aria-hidden />
            {getStatusLabel(statusVal)}
          </span>
        </div>

        {/* Countdown / hero — hidden for completed moves; perks hub renders instead */}
        {!isCompleted && (<div className="py-3 sm:py-5 mb-2">
          {isCompleted ? (
            <div className="text-center">
              <div className="font-hero text-[26px] sm:text-[30px] leading-tight font-semibold" style={{ color: WINE }}>
                Move Complete
              </div>
              <div className="mt-4 flex items-center justify-center gap-2.5">
                <a
                  href={process.env.NEXT_PUBLIC_REVIEW_URL || "https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full font-semibold text-[11px] py-2 px-4 transition-all hover:opacity-90 active:scale-95 tracking-wide shadow-sm"
                  style={{ backgroundColor: FOREST, color: CREAM }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Leave a Review
                </a>
                {tippingEnabled && !move.tip_charged_at && (
                  <button
                    type="button"
                    onClick={() => setShowTipScreen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full font-semibold text-[11px] py-2 px-4 transition-all hover:opacity-90 active:scale-95 tracking-wide"
                    style={{ backgroundColor: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}35` }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Tip Crew
                  </button>
                )}
              </div>
            </div>
          ) : daysUntil === 0 ? (
            <>
              <div className="text-center">
                <div className="font-hero text-[30px] md:text-[34px] leading-tight font-semibold" style={{ color: GOLD }}>Today&apos;s the day</div>
                <div className="mt-1 text-[11px] font-sans opacity-60" style={{ color: FOREST }}>
                  {isInProgress && liveEtaMinutes != null && liveEtaMinutes > 0
                    ? `Your crew is ${liveEtaMinutes} minutes away`
                    : isInProgress && liveStage != null
                      ? LIVE_TRACKING_STAGES.find((s) => s.key === liveStage)?.label ?? "In progress"
                      : arrivalWindow
                        ? `Arrival: ${arrivalWindow}`
                        : "Your crew is on the way"}
                </div>
              </div>
              {scheduledDate && (
                <div className="mt-5">
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
              <div className="font-hero text-[24px] sm:text-[26px] leading-tight font-semibold" style={{ color: WINE }}>
                Move day has passed
              </div>
              <p className="mt-1 text-[11px] font-sans opacity-60" style={{ color: FOREST }}>
                Your move will be marked complete soon.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="font-hero text-[56px] sm:text-[64px] leading-none font-semibold tracking-tight" style={{ color: GOLD }}>
                {daysUntil ?? "—"}
              </div>
              <div className="mt-1 text-[11px] font-sans opacity-60" style={{ color: FOREST }}>days until move day</div>
            </div>
          )}
        </div>)}

        {/* ═══ COMPLETED: Permanent Perks Hub ═══════════════════════════════════════
            Shown instead of the countdown + tabs for all completed moves.
            This page never expires — clients revisiting years later see their perks. */}
        {isCompleted && (
          <div className="space-y-5 mt-1">

            {/* Tip your crew banner */}
            {tippingEnabled && !move.tip_charged_at && (
              <button
                type="button"
                onClick={() => setShowTipScreen(true)}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border transition-all hover:opacity-80 active:scale-[0.99]"
                style={{ borderColor: `${GOLD}28`, backgroundColor: `${GOLD}08` }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}18` }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] font-semibold" style={{ color: FOREST }}>Tip your crew</div>
                    <div className="text-[10px] opacity-50" style={{ color: FOREST }}>100% goes directly to your movers</div>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}

            {/* ── Compact move summary bar (collapsible) ── */}
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${FOREST}15` }}>
              <button
                type="button"
                onClick={() => setShowMoveDetails(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:opacity-80"
                style={{ backgroundColor: `${FOREST}04` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold" style={{ color: FOREST }}>
                      {move.client_name || "Your Move"}
                    </span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
                    >
                      Completed ✓
                    </span>
                  </div>
                  <div className="text-[10px] opacity-50 mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: FOREST }}>
                    <span>{displayCode}</span>
                    {scheduledDate && <><span>·</span><span>{formatMoveDate(scheduledDate)}</span></>}
                    {move.from_address && (
                      <><span>·</span><span className="truncate max-w-[200px]">{shortAddress(move.from_address)} → {shortAddress(move.to_address || move.delivery_address)}</span></>
                    )}
                  </div>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: 0.4, transition: "transform 0.2s", transform: showMoveDetails ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showMoveDetails && (
                <div className="border-t px-4 pb-5 pt-3" style={{ borderColor: `${FOREST}10` }}>
                  {/* Sub-tab nav */}
                  <div className="flex gap-4 mb-4 border-b pb-2" style={{ borderColor: `${FOREST}08` }}>
                    {(["details", "photos", "docs", "inv"] as const).map((t) => {
                      const label = t === "inv" ? "Inventory" : t === "docs" ? "Documents" : t.charAt(0).toUpperCase() + t.slice(1);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDetailsSubTab(t)}
                          className="text-[11px] font-semibold pb-1.5 border-b-[1.5px] transition-all"
                          style={{
                            borderColor: detailsSubTab === t ? GOLD : "transparent",
                            color: detailsSubTab === t ? GOLD : FOREST,
                            opacity: detailsSubTab === t ? 1 : 0.4,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Details */}
                  {detailsSubTab === "details" && (
                    <div className="space-y-4">
                      <div className="flex gap-3 items-stretch">
                        <div className="flex flex-col items-center pt-1 shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                          <div className="w-px flex-1 my-1" style={{ background: `linear-gradient(to bottom, ${GOLD}70, ${GOLD}20)` }} />
                          <div className="w-1.5 h-1.5 rounded-sm rotate-45" style={{ backgroundColor: `${GOLD}90` }} />
                        </div>
                        <div className="flex flex-col gap-3 min-w-0 flex-1">
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-0.5" style={{ color: FOREST }}>From</div>
                            <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{shortAddress(move.from_address)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-0.5" style={{ color: FOREST }}>To</div>
                            <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{shortAddress(move.to_address || move.delivery_address)}</div>
                          </div>
                        </div>
                      </div>
                      {crewMembers.length > 0 && (
                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-2" style={{ color: FOREST }}>Your Crew</div>
                          <div className="flex flex-wrap gap-2.5">
                            {crewMembers.map((name: string, i: number) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}>
                                  {(name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-[11px] font-medium" style={{ color: FOREST }}>{name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <a
                          href={process.env.NEXT_PUBLIC_REVIEW_URL || "https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full font-semibold text-[11px] py-2 px-3.5 transition-all hover:opacity-90"
                          style={{ backgroundColor: FOREST, color: CREAM }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          Leave a Review
                        </a>
                        <a
                          href={`tel:${normalizePhone(YUGO_PHONE)}`}
                          className="inline-flex items-center gap-1.5 rounded-full font-semibold text-[11px] py-2 px-3.5 transition-all hover:opacity-70"
                          style={{ backgroundColor: `${FOREST}10`, color: FOREST }}
                        >
                          {formatPhone(YUGO_PHONE)}
                        </a>
                      </div>
                    </div>
                  )}

                  {detailsSubTab === "photos" && (
                    <div className="mt-1"><TrackPhotos moveId={move.id} token={token} moveComplete={true} /></div>
                  )}
                  {detailsSubTab === "docs" && (
                    <div className="mt-1"><TrackDocuments moveId={move.id} token={token} refreshTrigger={paymentRecorded} /></div>
                  )}
                  {detailsSubTab === "inv" && (
                    <div className="mt-1"><TrackInventory moveId={move.id} token={token} moveComplete={true} /></div>
                  )}
                </div>
              )}
            </div>

            {/* ── Active Partner Perks ── */}
            {perks.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3" style={{ color: FOREST }}>
                  Your Yugo Perks
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {perks.map((perk) => (
                    <div
                      key={perk.id}
                      className="rounded-2xl border p-4 flex flex-col gap-1.5"
                      style={{ borderColor: `${GOLD}28`, backgroundColor: `${GOLD}06` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-semibold leading-snug" style={{ color: WINE }}>{perk.title}</span>
                        <span
                          className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
                        >
                          {formatPerkOffer(perk.offer_type, perk.discount_value)}
                        </span>
                      </div>
                      {perk.description && (
                        <p className="text-[11px] opacity-70 leading-snug" style={{ color: FOREST }}>{perk.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {perk.redemption_code && (
                          <span
                            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border"
                            style={{ borderColor: `${FOREST}25`, color: FOREST, backgroundColor: `${FOREST}06` }}
                          >
                            {perk.redemption_code}
                          </span>
                        )}
                        {perk.redemption_url && (
                          <a
                            href={perk.redemption_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
                            style={{ color: GOLD }}
                            onClick={() => {
                              fetch("/api/perks/redeem", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ perk_id: perk.id, client_email: move.client_email, move_id: move.id }),
                              }).catch(() => {});
                            }}
                          >
                            Redeem →
                          </a>
                        )}
                        {perk.valid_until && (
                          <span className="text-[9px] opacity-40 ml-auto" style={{ color: FOREST }}>
                            Expires {new Date(perk.valid_until).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Refer a Friend ── */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3" style={{ color: FOREST }}>
                Refer a Friend
              </div>
              {!referral ? (
                <div className="rounded-2xl border p-4 text-center" style={{ borderColor: `${FOREST}15`, backgroundColor: `${FOREST}03` }}>
                  <p className="text-[12px] opacity-50 leading-relaxed" style={{ color: FOREST }}>
                    {isCompleted
                      ? "Your referral code is being prepared — check back soon."
                      : "Your referral code is on its way — check back shortly after your move completes."}
                  </p>
                </div>
              ) : referral.status !== "active" ? (
                <div className="rounded-2xl border p-4 text-center" style={{ borderColor: `${FOREST}15`, backgroundColor: `${FOREST}03` }}>
                  <p className="text-[12px] opacity-60 leading-relaxed" style={{ color: FOREST }}>
                    Your referral code has expired.{" "}
                    <a href={`mailto:${YUGO_EMAIL}`} className="underline" style={{ color: GOLD }}>Contact us</a>{" "}
                    for a new one.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: `${FOREST}20`, backgroundColor: `${FOREST}04` }}>
                  <p className="text-[12px] leading-relaxed mb-4" style={{ color: FOREST }}>
                    Share your code and your friend gets{" "}
                    <span className="font-semibold" style={{ color: WINE }}>${referral.referred_discount} off</span>{" "}
                    their first Yugo move. When they book, you earn a{" "}
                    <span className="font-semibold" style={{ color: WINE }}>${referral.referrer_credit} credit</span>.
                  </p>
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 mb-3"
                    style={{ borderColor: `${GOLD}35`, backgroundColor: `${GOLD}08` }}
                  >
                    <span className="font-mono text-[14px] font-bold tracking-widest" style={{ color: WINE }}>
                      {referral.referral_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(referral.referral_code).then(() => {
                          setReferralCopied(true);
                          setTimeout(() => setReferralCopied(false), 2000);
                        });
                      }}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-95"
                      style={{ backgroundColor: referralCopied ? `${FOREST}15` : GOLD, color: referralCopied ? FOREST : "#1A1A1A" }}
                    >
                      {referralCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `I just moved with Yugo — they were amazing! Use my code ${referral.referral_code} to get $${referral.referred_discount} off your move. Book at yugomoves.com`;
                        if (navigator.share) { navigator.share({ text: msg }).catch(() => {}); }
                        else { navigator.clipboard.writeText(msg); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000); }
                      }}
                      className="flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-3.5 py-2 transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: WINE, color: CREAM }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Share with a friend
                    </button>
                    <a
                      href={`sms:?body=${encodeURIComponent(`Moving soon? Use my Yugo referral code ${referral.referral_code} for $${referral.referred_discount} off. Book at yugomoves.com`)}`}
                      className="flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-3.5 py-2 transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      Send via SMS
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* ── Need Yugo Again? ── */}
            <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: `${FOREST}18`, backgroundColor: `${FOREST}03` }}>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1.5" style={{ color: FOREST }}>Need Yugo again?</div>
              <h3 className="font-hero text-[18px] sm:text-[20px] font-semibold mb-4 leading-tight" style={{ color: WINE }}>
                Moving again? We&apos;ve got you.
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { label: "Book a Move", sub: "Local or long distance", href: "https://yugoplus.co" },
                  { label: "Single Item", sub: "Sofa, piano, art piece", href: "https://yugoplus.co" },
                  { label: "White Glove Service", sub: "Premium packing & placement", href: "https://yugoplus.co" },
                ].map(({ label, sub, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="flex flex-col rounded-xl border px-4 py-3 transition-all hover:opacity-80 active:scale-[0.99]"
                    style={{ borderColor: `${FOREST}20` }}
                  >
                    <span className="text-[12px] font-semibold" style={{ color: FOREST }}>{label}</span>
                    <span className="text-[10px] opacity-50 mt-0.5" style={{ color: FOREST }}>{sub}</span>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tabs (hidden for completed moves — perks hub is the permanent view) */}
        {!isCompleted && (
        <div className="relative mb-4">
          <div
            className="flex gap-0 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth sm:justify-center"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`shrink-0 px-3.5 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-[1.5px] transition-colors ${
                  activeTab === t.key
                    ? "border-[#B8962E] opacity-100"
                    : "border-transparent opacity-40 hover:opacity-60"
                }`}
                style={{ color: activeTab === t.key ? GOLD : FOREST }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ backgroundColor: `${FOREST}12` }} />
        </div>
        )}

        {/* Tab content */}
        {activeTab === "dash" && !isCompleted && (
          <div>
            {additionalFeesCents > 0 && !isPaid && (
              <div className="pb-4 text-[11px] opacity-70" style={{ color: FOREST }}>
                Additional charges of {formatCurrency((additionalFeesCents || 0) / 100)} from approved changes.
              </div>
            )}

            {/* Move Details */}
            <div className="space-y-4">
              {scheduledDate && (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50" style={{ color: FOREST }}>Date</div>
                    <div className="text-[13px] font-medium mt-0.5" style={{ color: FOREST }}>
                      {formatMoveDate(scheduledDate)}
                    </div>
                    {arrivalWindow && (
                      <div className="text-[11px] mt-0.5 opacity-50" style={{ color: FOREST }}>
                        Arrival: {arrivalWindow}
                      </div>
                    )}
                  </div>
                  {(dashboardInventory?.items?.length ?? 0) + (dashboardInventory?.extraItems?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("inv")}
                      className="text-[11px] font-semibold opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 mt-1"
                      style={{ color: GOLD }}
                    >
                      {(dashboardInventory?.items?.length ?? 0) + (dashboardInventory?.extraItems?.length ?? 0)} items
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  )}
                </div>
              )}

              <style>{`
                @keyframes slideInFrom {
                  from { opacity: 0; transform: translateY(-6px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideInTo {
                  from { opacity: 0; transform: translateY(6px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes drawLine {
                  from { transform: scaleY(0); opacity: 0; }
                  to   { transform: scaleY(1); opacity: 1; }
                }
                .addr-from { animation: slideInFrom 0.45s cubic-bezier(0.22,1,0.36,1) both; }
                .addr-line { animation: drawLine 0.35s ease 0.2s both; transform-origin: top; }
                .addr-to   { animation: slideInTo 0.45s cubic-bezier(0.22,1,0.36,1) 0.3s both; }
              `}</style>
              <div className="flex gap-3 items-stretch">
                {/* Connector spine */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: GOLD }} />
                  <div
                    className="addr-line w-px flex-1 my-1"
                    style={{ background: `linear-gradient(to bottom, ${GOLD}70, ${GOLD}20)` }}
                  />
                  <div className="w-1.5 h-1.5 rounded-sm rotate-45" style={{ backgroundColor: `${GOLD}90` }} />
                </div>
                {/* Address text */}
                <div className="flex flex-col gap-3 min-w-0 flex-1">
                  <div className="addr-from min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-40" style={{ color: FOREST }}>From</div>
                    <div className="text-[13px] font-medium mt-0.5 leading-snug" style={{ color: FOREST }}>
                      {shortAddress(move.from_address)}
                    </div>
                  </div>
                  <div className="addr-to min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-40" style={{ color: FOREST }}>To</div>
                    <div className="text-[13px] font-medium mt-0.5 leading-snug" style={{ color: FOREST }}>
                      {shortAddress(move.to_address || move.delivery_address)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50" style={{ color: FOREST }}>Balance Due</div>
                  <div className="font-hero text-[18px] font-bold mt-0.5" style={{ color: totalBalance > 0 ? GOLD : FOREST }}>
                    {formatCurrency(totalBalance)}
                  </div>
                  {totalBalance > 0 ? (
                    <div className="text-[10px] opacity-50" style={{ color: FOREST }}>+{formatCurrency(calcHST(totalBalance))} HST</div>
                  ) : (
                    <div className="text-[10px] opacity-50" style={{ color: FOREST }}>Fully paid — thank you!</div>
                  )}
                </div>
                {totalBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(true)}
                    className="rounded-full font-semibold text-[11px] py-2 px-5 transition-all hover:opacity-90 active:scale-95 shrink-0 tracking-wide shadow-sm"
                    style={{ backgroundColor: GOLD, color: "#1A1A1A", boxShadow: `0 2px 12px ${GOLD}40` }}
                  >
                    Pay Now
                  </button>
                )}
              </div>
            </div>

            {/* Crew */}
            {crewMembers.length > 0 && (
              <div className="border-t border-[var(--brd)]/20 pt-5 mt-6">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-3" style={{ color: FOREST }}>Your Crew</div>
                <div className="flex flex-wrap gap-3">
                  {crewMembers.map((name: string, i: number) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                      >
                        {(name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-[12px] font-semibold" style={{ color: FOREST }}>{name}</span>
                        <span className="text-[10px] opacity-50 ml-1.5" style={{ color: FOREST }}>{crewRoles[i] || "Team member"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coordinator */}
            <div className="border-t border-[var(--brd)]/20 pt-4 mt-5">
              <a href={`tel:${normalizePhone(YUGO_PHONE)}`} className="inline-flex items-center gap-2 text-[11px] transition-opacity hover:opacity-70" style={{ color: FOREST }}>
                <YugoLogo size={12} variant="gold" onLightBackground />
                <span className="font-medium">{formatPhone(YUGO_PHONE)}</span>
                <span className="opacity-40">·</span>
                <span className="opacity-40">Coordinator</span>
              </a>
            </div>

            {changeSubmitted && (
              <div className="border-t border-[var(--brd)]/20 pt-4 mt-4">
                <div className="text-[12px] font-semibold" style={{ color: FOREST }}>Change request submitted</div>
                <div className="text-[11px] mt-0.5 opacity-50" style={{ color: FOREST }}>Your coordinator will follow up shortly.</div>
              </div>
            )}

            {!isCompleted && (
              <div className="pt-5 mt-3">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(true)}
                  className="text-[11px] font-semibold opacity-40 hover:opacity-70 transition-opacity flex items-center gap-1.5"
                  style={{ color: FOREST }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Request a Change
                </button>
              </div>
            )}

            {/* ── Perks & Referral (completed moves only) ── */}
            {isCompleted && (perks.length > 0 || referral) && (
              <div className="border-t border-[var(--brd)]/20 pt-6 mt-6 space-y-6">

                {/* Partner Perks */}
                {perks.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3" style={{ color: FOREST }}>
                      Your Yugo Perks
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {perks.map((perk) => (
                        <div
                          key={perk.id}
                          className="rounded-2xl border p-4 flex flex-col gap-1.5"
                          style={{ borderColor: `${GOLD}28`, backgroundColor: `${GOLD}06` }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[12px] font-semibold leading-snug" style={{ color: WINE }}>
                              {perk.title}
                            </span>
                            <span
                              className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
                            >
                              {formatPerkOffer(perk.offer_type, perk.discount_value)}
                            </span>
                          </div>
                          {perk.description && (
                            <p className="text-[11px] opacity-70 leading-snug" style={{ color: FOREST }}>
                              {perk.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {perk.redemption_code && (
                              <span
                                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border"
                                style={{ borderColor: `${FOREST}25`, color: FOREST, backgroundColor: `${FOREST}06` }}
                              >
                                {perk.redemption_code}
                              </span>
                            )}
                            {perk.redemption_url && (
                              <a
                                href={perk.redemption_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
                                style={{ color: GOLD }}
                              >
                                Redeem →
                              </a>
                            )}
                            {perk.valid_until && (
                              <span className="text-[9px] opacity-40 ml-auto" style={{ color: FOREST }}>
                                Expires {new Date(perk.valid_until).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refer a Friend */}
                {referral && referral.status === "active" && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3" style={{ color: FOREST }}>
                      Refer a Friend
                    </div>
                    <div
                      className="rounded-2xl border p-4 sm:p-5"
                      style={{ borderColor: `${FOREST}20`, backgroundColor: `${FOREST}04` }}
                    >
                      <p className="text-[12px] leading-relaxed mb-4" style={{ color: FOREST }}>
                        Share your unique code and your friend gets{" "}
                        <span className="font-semibold" style={{ color: WINE }}>
                          ${referral.referred_discount} off
                        </span>{" "}
                        their first Yugo move. When they book, you earn a{" "}
                        <span className="font-semibold" style={{ color: WINE }}>
                          ${referral.referrer_credit} credit
                        </span>
                        .
                      </p>
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 mb-3"
                        style={{ borderColor: `${GOLD}35`, backgroundColor: `${GOLD}08` }}
                      >
                        <span className="font-mono text-[14px] font-bold tracking-widest" style={{ color: WINE }}>
                          {referral.referral_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(referral.referral_code).then(() => {
                              setReferralCopied(true);
                              setTimeout(() => setReferralCopied(false), 2000);
                            });
                          }}
                          className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-95"
                          style={{
                            backgroundColor: referralCopied ? `${FOREST}15` : GOLD,
                            color: referralCopied ? FOREST : "#1A1A1A",
                          }}
                        >
                          {referralCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const msg = `I just moved with Yugo — they were amazing! Use my code ${referral.referral_code} to get $${referral.referred_discount} off your move. Book at yugomoves.com`;
                            if (navigator.share) {
                              navigator.share({ text: msg }).catch(() => {});
                            } else {
                              navigator.clipboard.writeText(msg);
                              setReferralCopied(true);
                              setTimeout(() => setReferralCopied(false), 2000);
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-3.5 py-2 transition-all hover:opacity-90 active:scale-95"
                          style={{ backgroundColor: WINE, color: CREAM }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                          </svg>
                          Share with a friend
                        </button>
                        <a
                          href={`sms:?body=${encodeURIComponent(`Moving soon? Use my Yugo referral code ${referral.referral_code} for $${referral.referred_discount} off. Book at yugomoves.com`)}`}
                          className="flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-3.5 py-2 transition-all hover:opacity-90 active:scale-95"
                          style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                          </svg>
                          Send via SMS
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "track" && (
          <div>
            {isCompleted ? (
              <p className="text-center text-[11px] opacity-50 py-8" style={{ color: FOREST }}>Tracking is no longer active for this move.</p>
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

        {activeTab === "files" && (
          <div className="mb-6 space-y-6">
            <TrackPhotos moveId={move.id} token={token} moveComplete={isCompleted} />
            <TrackDocuments moveId={move.id} token={token} refreshTrigger={paymentRecorded} />
          </div>
        )}

      </main>

      <footer className="py-3 px-4 text-center border-t" style={{ backgroundColor: CREAM, borderColor: `${FOREST}10` }}>
        <div className="flex items-center justify-center gap-1 mb-0.5">
          <YugoLogo size={10} variant="gold" onLightBackground />
        </div>
        <p className="text-[6px] opacity-25" style={{ color: FOREST }}>
          The Art of Moving &nbsp;·&nbsp;
          <Link href="/privacy" className="hover:underline" style={{ color: FOREST }}>Privacy</Link>
          &nbsp;·&nbsp;
          <Link href="/terms" className="hover:underline" style={{ color: FOREST }}>Terms</Link>
        </p>
      </footer>

      {/* Tip Modal */}
      {tipModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-white/30 p-4" onClick={() => !tipSubmitting && setTipModalOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border-2 shadow-xl bg-white overflow-hidden"
            style={{ borderColor: `${FOREST}20` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8" style={{ backgroundColor: CREAM }}>
              <h3 className="font-hero text-[22px] font-semibold text-center" style={{ color: WINE }}>
                Leave a Tip
              </h3>
              <p className="mt-2 text-center text-[12px] opacity-90" style={{ color: FOREST }}>
                Thank your crew. This will be charged to the card on your file.
              </p>
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3 opacity-80" style={{ color: FOREST }}>
                  Amount
                </p>
                <div className="flex flex-wrap gap-2">
                  {[20, 50, 100].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setTipPreset(d); setTipCustomDollars(""); }}
                      className="rounded-xl border-2 px-4 py-2.5 text-[14px] font-semibold transition-all"
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
                    className="rounded-xl border-2 px-4 py-2.5 text-[14px] font-semibold transition-all"
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
                      <span className="text-[14px] font-semibold mr-2" style={{ color: FOREST }}>$</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Enter amount"
                        value={tipCustomDollars}
                        onChange={(e) => setTipCustomDollars(e.target.value.replace(/[^0-9.]/g, ""))}
                        className="flex-1 bg-transparent text-[14px] font-semibold outline-none min-w-0"
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
                  className="flex-1 rounded-xl border-2 py-3 text-[13px] font-semibold transition-colors"
                  style={{ borderColor: `${FOREST}30`, color: FOREST }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTipSubmit}
                  disabled={tipSubmitting || tipAmountCents < 100}
                  className="flex-1 rounded-xl py-3 text-[13px] font-bold transition-colors disabled:opacity-50 hover:opacity-90"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-white/30 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-5" style={{ borderColor: `${FOREST}20` }}>
            <h3 className="mb-3 text-[16px] font-bold font-heading" style={{ color: WINE }}>Request a Change</h3>
            <p className="mb-4 text-[12px] leading-relaxed opacity-80" style={{ color: FOREST }}>
              Submit a change request. Your coordinator will review and confirm.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase opacity-80" style={{ color: FOREST }}>Type of Change</label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-2"
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
                    className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none focus:ring-2"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase opacity-80" style={{ color: FOREST }}>
                  {changeType === "Change destination address" ? "Additional details (optional)" : "Details"}
                </label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  placeholder={changeType === "Change destination address" ? "e.g. Access code, special instructions..." : "Describe what you need changed..."}
                  rows={changeType === "Change destination address" ? 2 : 4}
                  className="w-full resize-y rounded-lg border px-3 py-2 text-[12px] placeholder:opacity-60 outline-none focus:ring-2"
                  style={{ borderColor: `${FOREST}25`, backgroundColor: CREAM, color: FOREST }}
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase opacity-80" style={{ color: FOREST }}>Urgency</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] opacity-80" style={{ color: FOREST }}>
                    <input type="radio" name="urgency" checked={!changeUrgent} onChange={() => setChangeUrgent(false)} className="accent-[#B8962E]" />
                    Normal
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] opacity-80" style={{ color: FOREST }}>
                    <input type="radio" name="urgency" checked={changeUrgent} onChange={() => setChangeUrgent(true)} className="accent-[#B8962E]" />
                    Urgent
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="flex-1 rounded-lg border py-2.5 text-[12px] font-semibold transition-colors"
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
                  className="flex-1 rounded-lg py-2.5 text-[12px] font-bold disabled:opacity-50 transition-colors hover:opacity-90"
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
                  <h2 className="text-[16px] font-bold" style={{ color: FOREST }}>Pay Balance</h2>
                  <button type="button" onClick={() => setPaymentModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F0F0F0] transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: `${FOREST}15`, backgroundColor: `${CREAM}` }}>
                  <div className="flex justify-between text-[13px] mb-1.5" style={{ color: FOREST }}>
                    <span className="opacity-70">Move balance</span>
                    <span className="font-semibold">{formatCurrency(totalBalance)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] mb-1.5" style={{ color: FOREST }}>
                    <span className="opacity-70">HST (13%)</span>
                    <span className="font-semibold">{formatCurrency(calcHST(totalBalance))}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between text-[14px] font-bold" style={{ borderColor: `${FOREST}15`, color: GOLD }}>
                    <span>Total</span>
                    <span>{formatCurrency(totalBalance + calcHST(totalBalance))}</span>
                  </div>
                </div>

                <div className="mb-1.5">
                  <div className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>Card Details</div>
                  <div className="rounded-xl border-2 p-3.5 transition-colors" style={{ borderColor: sqCardReady ? GOLD : `${FOREST}15`, backgroundColor: CREAM }}>
                    <div id="sq-track-card" style={{ minHeight: 80 }} />
                    {!sqSdkReady && !sqError && (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${GOLD}30`, borderTopColor: GOLD }} />
                        <span className="ml-2 text-[11px] opacity-60" style={{ color: FOREST }}>Loading…</span>
                      </div>
                    )}
                  </div>
                </div>

                {sqError && (
                  <div className="px-3 py-2 rounded-lg text-[11px] font-medium mb-3" style={{ backgroundColor: "rgba(209,67,67,0.08)", color: "#D14343", border: "1px solid rgba(209,67,67,0.2)" }}>
                    {sqError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInlinePayment}
                  disabled={!sqCardReady || sqProcessing}
                  className="w-full py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
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
                  <span className="text-[10px] opacity-50" style={{ color: FOREST }}>Secured by Square · 256-bit encryption</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
