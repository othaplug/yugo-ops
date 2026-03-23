"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { getDisplayLabel } from "@/lib/displayLabels";
import { SafeText } from "@/components/SafeText";
import { formatMoveDate, parseDateOnly } from "@/lib/date-format";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { formatAccessForDisplay } from "@/lib/format-text";
import { formatPhone, normalizePhone } from "@/lib/phone";
import YugoLogo from "@/components/YugoLogo";
import TipConfirmation from "@/components/tracking/TipConfirmation";
import ExperienceRatingSection from "@/components/tracking/ExperienceRatingSection";
import ClientSettingsMenu from "./ClientSettingsMenu";
import TrackingAgreementModal from "./TrackingAgreementModal";
import InventoryChangeRequestModal from "@/components/tracking/InventoryChangeRequestModal";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { WINE, FOREST, GOLD } from "@/lib/client-theme";
import {
  ArrowsClockwise,
  CaretDown,
  Check,
  Phone,
  ShareNetwork,
  ChatCircle,
  CaretRight,
  Plus,
  HandHeart,
  X,
  Lock,
  Copy,
  Warning,
  Receipt,
  UsersThree,
  ArrowsCounterClockwise,
} from "@phosphor-icons/react";
import PreMoveChecklist from "@/components/tracking/PreMoveChecklist";
import LiveMoveTimeline from "@/components/tracking/LiveMoveTimeline";
import ClientRoomPhotoCapture from "@/components/tracking/ClientRoomPhotoCapture";

function formatPerkOffer(offerType: string, discountValue: number | null): string {
  if (offerType === "percentage_off" && discountValue) return `${discountValue}% off`;
  if (offerType === "dollar_off" && discountValue) return `$${discountValue} off`;
  if (offerType === "free_service") return "Free service";
  if (offerType === "consultation") return "Free consultation";
  if (offerType === "priority_access") return "Priority booking";
  return "Special offer";
}

function formatPerkExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const PERK_CARD_THEMES = [
  { bg: "linear-gradient(135deg, #2B1855 0%, #4C2D8F 100%)", stamp: "#4C2D8F" },
  { bg: "linear-gradient(135deg, #7A0E1A 0%, #B01A26 100%)", stamp: "#B01A26" },
  { bg: "linear-gradient(135deg, #7A3300 0%, #C05A10 100%)", stamp: "#C05A10" },
  { bg: "linear-gradient(135deg, #0A2E1A 0%, #1A5C34 100%)", stamp: "#1A5C34" },
  { bg: "linear-gradient(135deg, #0F2340 0%, #1A3D70 100%)", stamp: "#1A3D70" },
];

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
type SquarePayments = { card: (opts?: object) => Promise<SquareCard> };

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
  showTipPrompt = false,
  tipData = null,
  crewSize = 2,
  inventoryChangeFeatureOn = false,
  inventoryChangeItemWeights = [],
  inventoryChangeEligible = false,
  inventoryChangeReason = "",
  inventoryChangePending = null,
  inventoryChangePerScoreRate = 35,
  inventoryChangeMaxItems = 10,
  latestInventoryAdjustmentPayment = null,
  crewChangeRequest = null,
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
  showTipPrompt?: boolean;
  tipData?: { amount: number } | null;
  crewSize?: number;
  inventoryChangeFeatureOn?: boolean;
  inventoryChangeItemWeights?: { slug: string; item_name: string; weight_score: number; active?: boolean }[];
  inventoryChangeEligible?: boolean;
  inventoryChangeReason?: string;
  inventoryChangePending?: { id: string; status: string; submitted_at: string } | null;
  inventoryChangePerScoreRate?: number;
  inventoryChangeMaxItems?: number;
  latestInventoryAdjustmentPayment?: {
    id: string;
    additional_deposit_required: number;
    reviewed_at?: string | null;
  } | null;
  crewChangeRequest?: {
    id: string;
    status: string;
    submitted_at: string;
    auto_calculated_delta: number;
    items_added: unknown[];
    items_removed: unknown[];
    items_matched: number;
    items_missing: number;
    items_extra: number;
    original_subtotal: number;
    new_subtotal: number;
    client_response: string | null;
  } | null;
}) {
  const router = useRouter();
  const params = useParams();
  const urlSlug = typeof params?.id === "string" ? params.id : "";
  const [activeTab, setActiveTab] = useState<TabKey>("dash");
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(paymentSuccess);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeType, setChangeType] = useState(CHANGE_TYPES[0]);
  const [changeDesc, setChangeDesc] = useState("");
  const [changeAddress, setChangeAddress] = useState("");
  const [changeUrgent, setChangeUrgent] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeSubmitted, setChangeSubmitted] = useState(false);
  const [inventoryChangeModalOpen, setInventoryChangeModalOpen] = useState(false);

  // Crew change request state (move-day walkthrough)
  const [crewCrApprovalState, setCrewCrApprovalState] = useState<"idle" | "approving" | "approved" | "declined" | "approved_pending_payment">("idle");
  const [crewCrError, setCrewCrError] = useState<string | null>(null);

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
    organizations?: { name: string } | null;
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
  const [showMoveDetails, setShowMoveDetails] = useState(true);
  const [detailsSubTab, setDetailsSubTab] = useState<"details" | "photos_docs" | "inv">("details");

  const refreshMoveData = useCallback(async () => {
    await router.refresh();
  }, [router]);
  const { containerRef: pullRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: refreshMoveData,
  });

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

  // 3-state tip logic: first_visit | tipped | can_tip_later | not_applicable
  type TipState = "first_visit" | "tipped" | "can_tip_later" | "not_applicable";
  const initialTipState = (() => {
    if (!tippingEnabled) return "not_applicable" as TipState;
    const isComplete = move.status === "completed" || move.status === "delivered";
    if (!isComplete || !move.square_card_id) return "not_applicable" as TipState;
    if (tipData) return "tipped" as TipState;
    if (showTipPrompt) return "first_visit" as TipState;
    return "can_tip_later" as TipState;
  })();
  const [tipState, setTipState] = useState<TipState>(initialTipState);
  const [confirmedTipAmount, setConfirmedTipAmount] = useState<number>(tipData?.amount ?? 0);
  const [tipSectionPercent, setTipSectionPercent] = useState<number>(10);
  const [tipSectionCustom, setTipSectionCustom] = useState("");
  const [tipSectionShowCustom, setTipSectionShowCustom] = useState(false);
  const [tipSectionSubmitting, setTipSectionSubmitting] = useState(false);
  const [tipSectionError, setTipSectionError] = useState<string | null>(null);

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
  const indicativeSettled =
    move.status === "paid" || !!move.payment_marked_paid || !!move.balance_paid_at || paymentRecorded || showPaymentSuccess;
  const baseBalance = Number(move.balance_amount || 0);
  const feesDollars =
    baseBalance > 0 ? 0 : indicativeSettled ? 0 : (additionalFeesCents || 0) / 100;
  const totalBalance = baseBalance + feesDollars;
  const outstandingInventoryAdj =
    !!latestInventoryAdjustmentPayment &&
    baseBalance > 0 &&
    Math.abs(Number(latestInventoryAdjustmentPayment.additional_deposit_required) - baseBalance) <= 0.05;
  const hasCardOnFile = !!move.square_card_id;
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [sqSdkReady, setSqSdkReady] = useState(false);
  const [sqCardReady, setSqCardReady] = useState(false);
  const [sqProcessing, setSqProcessing] = useState(false);
  const [sqError, setSqError] = useState<string | null>(null);
  const [chargingSavedCard, setChargingSavedCard] = useState(false);
  const [balanceChargeError, setBalanceChargeError] = useState<string | null>(null);
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
      router.refresh();
    } catch (e) {
      setSqError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setSqProcessing(false);
    }
  };

  const handlePayWithSavedCard = async () => {
    if (chargingSavedCard) return;
    setChargingSavedCard(true);
    setBalanceChargeError(null);
    try {
      const res = await fetch(
        `/api/track/moves/${move.id}/pay-balance-card?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data as { success?: boolean }).success) {
        setBalanceChargeError(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Payment failed. Please try again.",
        );
        return;
      }
      setPaymentRecorded(true);
      toast("Payment successful!", "check");
      router.refresh();
    } catch (e) {
      setBalanceChargeError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setChargingSavedCard(false);
    }
  };

  const useSandbox = process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX === "true";
  const squareScriptUrl = useSandbox ? SQUARE_SDK_SANDBOX : SQUARE_SDK_PRODUCTION;

  const serviceType = (move.service_type || move.move_type || "residential") as string;
  const isB2BOneOff = serviceType === "b2b_oneoff" || serviceType === "b2b_delivery";
  const isSingleItem = serviceType === "single_item";
  const tabs: { key: TabKey; label: string }[] = [
    { key: "dash", label: "Dashboard" },
    { key: "track" as TabKey, label: "Live Tracking" },
    ...(isSingleItem ? [] : [{ key: "inv" as TabKey, label: "Inventory" }]),
    { key: "files", label: "Files" },
  ];

  const moveTotal = Number(move.amount || move.estimate || 0);

  // B2B one-off: no client tracking page — managed through partner portal
  if (isB2BOneOff) {
    return (
      <div className="min-h-screen font-sans flex items-center justify-center px-4" data-theme="light" style={{ backgroundColor: "#FAF7F2", color: FOREST }}>
        <div className="max-w-md w-full text-center">
          <h1 className="font-hero text-[26px] sm:text-[30px] font-semibold mb-2" style={{ color: WINE }}>Partner-Managed Delivery</h1>
          <p className="text-[13px] mb-6 opacity-80" style={{ color: FOREST }}>
            This delivery is managed through your partner portal.
          </p>
          <Link
            href="/partner"
            className="inline-block rounded-lg font-semibold text-[12px] py-2.5 px-4 transition-colors hover:opacity-90"
            style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
          >
            Go to Partner Portal
          </Link>
        </div>
      </div>
    );
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen font-sans flex items-center justify-center px-4" data-theme="light" style={{ backgroundColor: "#FAF7F2", color: FOREST }}>
        <div className="max-w-md w-full text-center">
          <h1 className="font-hero text-[26px] sm:text-[30px] font-semibold mb-2" style={{ color: WINE }}>Your move is complete</h1>
          <p className="text-[13px] mb-6 opacity-80" style={{ color: FOREST }}>
            This tracking link has expired. If you need documents or support, please contact us.
          </p>
          <a
            href={`tel:${normalizePhone(YUGO_PHONE)}`}
            className="inline-block rounded-lg font-semibold text-[12px] py-2.5 px-4 transition-colors hover:opacity-90"
            style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
          >
            Contact us
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden font-sans" data-theme="light" style={{ backgroundColor: "#FAF7F2", color: FOREST }}>
      <TrackingAgreementModal />
      {/* Header — outside scroll container; always visible on mobile */}
      <header className="shrink-0 z-50 border-b" style={{ backgroundColor: WINE, borderColor: `${WINE}80` }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
          <div className="flex items-center gap-2">
            <YugoLogo size={20} variant="gold" />
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
      <div ref={pullRef as React.RefObject<HTMLDivElement>} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[100] flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-transform"
            style={{
              top: 52,
              transform: `translate(-50%, ${pullDistance}px)`,
              backgroundColor: "#FFFDF8",
              border: `1px solid ${GOLD}40`,
            }}
            aria-live="polite"
          >
            {refreshing ? (
              <span className="spinner w-4 h-4" style={{ borderColor: `${GOLD}40`, borderTopColor: GOLD }} />
            ) : (
              <ArrowsClockwise
                size={16}
                color={GOLD}
                style={{ transform: `rotate(${(pullDistance / 72) * 180}deg)`, transition: "transform 0.1s" }}
                aria-hidden
              />
            )}
          </div>
        )}
      <main className="flex-1 max-w-[800px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-6 min-w-0 w-full pb-8">
        {showPaymentSuccess && (
          <div className="mb-5 text-center py-6 animate-fade-up">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3" style={{ backgroundColor: `${GOLD}20` }}>
              <Check size={18} color={GOLD} weight="bold" />
            </div>
            <h2 className="text-[13px] font-semibold" style={{ color: WINE }}>Payment received</h2>
            <p className="text-[11px] mt-1 opacity-60" style={{ color: FOREST }}>
              Thank you. See you on move day.
            </p>
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="mt-4 rounded-md font-semibold text-[11px] py-2 px-4 transition-colors hover:opacity-90"
              style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
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

        {/* ── Move-Day Crew Change Request Banner ── */}
        {crewChangeRequest && crewCrApprovalState === "idle" && (
          <CrewChangeRequestBanner
            request={crewChangeRequest}
            moveId={move.id}
            token={token}
            hasCardOnFile={!!move.square_card_id}
            onApproved={(state) => {
              setCrewCrApprovalState(state);
              router.refresh();
            }}
            onDeclined={() => {
              setCrewCrApprovalState("declined");
              router.refresh();
            }}
            error={crewCrError}
            onError={setCrewCrError}
          />
        )}
        {crewCrApprovalState === "approved" && (
          <div className="mb-5 rounded-2xl border border-[#22C55E]/30 bg-[#22C55E]/6 px-4 py-3 flex items-start gap-2.5">
            <Check size={16} weight="bold" className="shrink-0 mt-0.5 text-[#22C55E]" />
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "#22C55E" }}>Approved — payment processed</p>
              <p className="text-[11px] opacity-70 mt-0.5" style={{ color: FOREST }}>Your crew has been notified to load the extra items.</p>
            </div>
          </div>
        )}
        {crewCrApprovalState === "approved_pending_payment" && (
          <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/6 px-4 py-3">
            <p className="text-[12px] font-semibold text-amber-600">Approved — pending payment</p>
            <p className="text-[11px] text-amber-700/70 mt-0.5">Add a card below to authorize the charge, or contact your coordinator.</p>
          </div>
        )}
        {crewCrApprovalState === "declined" && (
          <div className="mb-5 rounded-2xl border border-[var(--brd)]/40 bg-[var(--bg)]/60 px-4 py-3">
            <p className="text-[12px] font-medium" style={{ color: FOREST, opacity: 0.6 }}>Extra items declined — your crew will proceed with the original list only.</p>
          </div>
        )}

        {/* Client header */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h1 className="font-hero text-[26px] sm:text-[28px] leading-tight font-semibold tracking-tight truncate" style={{ color: WINE }}>
              {greeting}, {move.client_name?.split(" ")[0] || move.client_name || "Your Move"}
            </h1>
            <p className="text-[11px] mt-0.5 font-sans opacity-40 flex items-center gap-1.5" style={{ color: FOREST }}>
              {displayCode}
              {(() => {
                const isOffice = serviceType === "office_move";
                const isWhiteGlove = serviceType === "white_glove";
                const isSpecialty = serviceType === "specialty";
                const label = isOffice
                  ? "Commercial Move"
                  : isWhiteGlove
                    ? "White Glove Service"
                    : isSpecialty
                      ? "Specialty Move"
                      : getDisplayLabel(
                          (move.tier_selected || move.tier || move.service_tier || "")
                            .toLowerCase()
                            .trim()
                            .replace(/\s+/g, "_"),
                          "tier",
                        ) || null;
                return label ? (
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${GOLD}18`, color: GOLD, opacity: 1 }}
                  >
                    {label}
                  </span>
                ) : null;
              })()}
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

            {tipState === "tipped" && (
              <TipConfirmation amount={confirmedTipAmount} />
            )}

            {/* ── How was your experience? (5-star → Google review or feedback) ── */}
            <ExperienceRatingSection moveId={move.id} token={token} />

            {/* ── Compact move summary bar (collapsible) ── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${FOREST}18`,
                background: `linear-gradient(155deg, #f5f1ea 0%, #ede8de 100%)`,
                boxShadow: "0 4px 20px rgba(44, 62, 45, 0.08), 0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              {/* Top accent stripe */}
              <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${WINE} 0%, ${GOLD} 100%)` }} />

              {/* Header toggle */}
              <button
                type="button"
                onClick={() => setShowMoveDetails(v => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left transition-opacity hover:opacity-80"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${FOREST}10`, boxShadow: `inset 0 0 0 1px ${FOREST}18` }}
                  >
                    <Receipt size={18} weight="duotone" color={FOREST} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold mb-0.5" style={{ color: FOREST }}>Move Details</div>
                    <div className="text-[10px] flex items-center gap-1.5 flex-wrap" style={{ color: `${FOREST}55` }}>
                      <span>{displayCode}</span>
                      {scheduledDate && <><span>·</span><span>{formatMoveDate(scheduledDate)}</span></>}
                    </div>
                  </div>
                </div>
                <CaretDown
                  size={14}
                  color={FOREST}
                  style={{ opacity: 0.35, transition: "transform 0.2s", transform: showMoveDetails ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
                  aria-hidden
                />
              </button>

              {showMoveDetails && (
                <div
                  className="px-4 sm:px-5 pb-5 pt-0"
                  style={{ borderTop: `1px solid ${FOREST}10` }}
                >
                  {/* Sub-tab nav */}
                  <div className="flex gap-5 pt-3 mb-4 border-b" style={{ borderColor: `${FOREST}10` }}>
                    {(["details", "photos_docs", ...(isSingleItem ? [] : ["inv"])] as ("details" | "photos_docs" | "inv")[]).map((t) => {
                      const label = t === "inv" ? "Inventory" : t === "photos_docs" ? "Photos & Docs" : "Details";
                      const active = detailsSubTab === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDetailsSubTab(t)}
                          className="text-[11px] font-semibold pb-2.5 border-b-[2px] transition-all -mb-px"
                          style={{
                            borderColor: active ? GOLD : "transparent",
                            color: active ? GOLD : FOREST,
                            opacity: active ? 1 : 0.4,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Details tab */}
                  {detailsSubTab === "details" && (
                    <div className="space-y-4">
                      {isSingleItem && (move as { item_description?: string | null }).item_description && (
                        <div className="pb-3 border-b" style={{ borderColor: `${FOREST}10` }}>
                          <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: `${FOREST}55` }}>Item</div>
                          <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>
                            <SafeText fallback="Item details are unavailable here. Check your confirmation email.">
                              {(move as { item_description?: string | null }).item_description ?? ""}
                            </SafeText>
                          </div>
                        </div>
                      )}
                      {(serviceType === "white_glove" || serviceType === "specialty") && (
                        <div className="pb-3 border-b" style={{ borderColor: `${FOREST}10` }}>
                          <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: `${FOREST}55` }}>Service included</div>
                          <p className="text-[11px] leading-relaxed" style={{ color: `${FOREST}90` }}>
                            White glove handling, custom crating when needed, and specialty care for high-value items.
                          </p>
                        </div>
                      )}

                      {/* Balance row */}
                      <div
                        className="rounded-xl px-3.5 py-2.5"
                        style={{ backgroundColor: totalBalance > 0 ? `${GOLD}10` : `${FOREST}08`, border: `1px solid ${totalBalance > 0 ? GOLD : FOREST}18` }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: `${FOREST}70` }}>Total balance</span>
                          <span className="text-[15px] font-bold" style={{ color: totalBalance > 0 ? GOLD : FOREST }}>
                            {totalBalance > 0 ? formatCurrency(totalBalance) : "Paid ✓"}
                          </span>
                        </div>
                        {isCompleted && totalBalance > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${GOLD}20` }}>
                            {hasCardOnFile && (
                              <button
                                type="button"
                                onClick={() => void handlePayWithSavedCard()}
                                disabled={chargingSavedCard}
                                className="rounded-full font-semibold text-[11px] py-1.5 px-4 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                                style={{ backgroundColor: GOLD, color: "#FAF7F2", boxShadow: `0 2px 8px ${GOLD}40` }}
                              >
                                {chargingSavedCard ? "Processing…" : "Pay Now"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setSqError(null); setPaymentModalOpen(true); }}
                              className="rounded-full font-semibold text-[11px] py-1.5 px-4 transition-all border hover:opacity-90 active:scale-95"
                              style={{ borderColor: `${FOREST}25`, color: FOREST, backgroundColor: "transparent" }}
                            >
                              {hasCardOnFile ? "Use a different card" : "Pay with card"}
                            </button>
                          </div>
                        )}
                        {balanceChargeError && isCompleted && (
                          <p className="text-[10px] mt-2 font-medium" style={{ color: "#D14343" }}>{balanceChargeError}</p>
                        )}
                      </div>

                      {/* From / To */}
                      <div className="flex gap-3 items-stretch">
                        <div className="flex flex-col items-center pt-1.5 shrink-0">
                          <div className="w-2 h-2 rounded-full border-[1.5px]" style={{ borderColor: GOLD, backgroundColor: `${GOLD}30` }} />
                          <div className="w-px flex-1 my-1.5" style={{ background: `linear-gradient(to bottom, ${GOLD}60, ${GOLD}18)` }} />
                          <div className="w-2 h-2 rounded-sm rotate-45 border-[1.5px]" style={{ borderColor: `${WINE}80`, backgroundColor: `${WINE}18` }} />
                        </div>
                        <div className="flex flex-col gap-3.5 min-w-0 flex-1">
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: `${FOREST}50` }}>From</div>
                            <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{shortAddress(move.from_address)}</div>
                            {(move as { from_access?: string | null }).from_access && formatAccessForDisplay((move as { from_access?: string | null }).from_access) && (
                              <div className="text-[10px] mt-0.5" style={{ color: `${FOREST}65` }}>Access: {formatAccessForDisplay((move as { from_access?: string | null }).from_access)}</div>
                            )}
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: `${FOREST}50` }}>To</div>
                            <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{shortAddress(move.to_address || move.delivery_address)}</div>
                            {(move as { to_access?: string | null }).to_access && formatAccessForDisplay((move as { to_access?: string | null }).to_access) && (
                              <div className="text-[10px] mt-0.5" style={{ color: `${FOREST}65` }}>Access: {formatAccessForDisplay((move as { to_access?: string | null }).to_access)}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Crew */}
                      {crewMembers.length > 0 && (
                        <div className="pt-1 border-t" style={{ borderColor: `${FOREST}10` }}>
                          <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: `${FOREST}50` }}>Your Crew</div>
                          <div className="flex flex-wrap gap-2">
                            {crewMembers.map((name: string, i: number) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                                style={{ backgroundColor: `${FOREST}08`, border: `1px solid ${FOREST}12` }}
                              >
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                  style={{ background: `linear-gradient(135deg, ${GOLD}, #8B7332)` }}
                                >
                                  {(name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-[11px] font-medium" style={{ color: FOREST }}>{name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Call Us */}
                      <div className="pt-1">
                        <a
                          href={`tel:${normalizePhone(YUGO_PHONE)}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
                          style={{ color: FOREST }}
                        >
                          <Phone size={12} className="text-current" aria-hidden />
                          Call Us
                        </a>
                      </div>
                    </div>
                  )}

                  {detailsSubTab === "photos_docs" && (
                    <div className="space-y-6 mt-1">
                      <TrackPhotos moveId={move.id} token={token} moveComplete={true} />
                      <TrackDocuments moveId={move.id} token={token} refreshTrigger={paymentRecorded} />
                    </div>
                  )}
                  {detailsSubTab === "inv" && !isSingleItem && (
                    <div className="mt-1"><TrackInventory moveId={move.id} token={token} moveComplete={true} /></div>
                  )}
                </div>
              )}
            </div>

            {/* ── Your offers (hero): perks + referral (hidden for single_item, business copy for office) ── */}
            {!isSingleItem && (
            <div className="space-y-5">
              <h2 className="font-hero text-[20px] sm:text-[22px] font-semibold leading-tight" style={{ color: WINE }}>
                Your offers
              </h2>
              {perks.length > 0 && serviceType !== "office_move" ? (
                <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scroll-smooth snap-x snap-mandatory">
                  {perks.map((perk, idx) => {
                    const theme = PERK_CARD_THEMES[idx % PERK_CARD_THEMES.length];
                    return (
                      <div
                        key={perk.id}
                        className="rounded-2xl overflow-hidden shrink-0 w-[310px] max-w-[88vw] snap-start flex flex-col relative"
                        style={{ background: theme.bg, minHeight: "140px" }}
                      >
                        {/* Top-right: Yugo+ Exclusive badge (Wine Rack style) */}
                        <div className="absolute top-0 right-0 bg-white rounded-bl-xl px-2.5 py-1 flex items-center gap-1.5">
                          <YugoLogo size={10} variant="black" onLightBackground hidePlus />
                          <span className="text-[9px] font-bold text-black">Exclusive</span>
                        </div>
                        {/* Content */}
                        <div className="flex-1 px-4 py-3.5 pt-8 flex flex-col justify-between min-w-0">
                          <div>
                            {perk.organizations?.name && (
                              <div className="text-[9px] font-semibold text-white/60 mb-1">
                                From <SafeText fallback="our partner">{perk.organizations.name}</SafeText>
                              </div>
                            )}
                            <div className="text-[13px] font-bold text-white leading-tight line-clamp-2">
                              <SafeText fallback="Partner offer">{perk.title}</SafeText>
                            </div>
                            <div className="text-[10px] text-white/80 mt-1 leading-snug line-clamp-3">
                              <SafeText fallback="Exclusive offer for Yugo movers. Terms apply.">
                                {perk.description ?? "Exclusive offer for Yugo movers. Terms apply."}
                              </SafeText>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {perk.redemption_code && (
                              <span className="text-[9px] font-mono font-bold text-white/90 bg-white/15 border border-white/25 px-1.5 py-0.5 rounded">
                                Code: <SafeText fallback="—">{perk.redemption_code}</SafeText>
                              </span>
                            )}
                            {perk.valid_until && (
                              <span className="text-[9px] text-white/45">Ends {formatPerkExpiry(perk.valid_until)}</span>
                            )}
                            {perk.redemption_url ? (
                              <a
                                href={perk.redemption_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  fetch("/api/perks/redeem", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ perk_id: perk.id, client_email: move.client_email, move_id: move.id }),
                                  }).catch(() => {});
                                }}
                                className="ml-auto shrink-0 bg-white text-[10px] font-bold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                                style={{ color: theme.stamp }}
                              >
                                {perk.redemption_code ? "Order now" : "Redeem"}
                              </a>
                            ) : perk.redemption_code ? (
                              <button
                                type="button"
                                aria-label="Copy perk code"
                                onClick={() => navigator.clipboard.writeText(perk.redemption_code!).catch(() => {})}
                                className="ml-auto shrink-0 w-9 h-9 inline-flex items-center justify-center bg-white rounded-full border border-white/30 hover:opacity-90 transition-opacity"
                                style={{ color: theme.stamp }}
                              >
                                <Copy size={16} weight="regular" className="text-current" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : serviceType !== "office_move" ? (
                <p className="text-[11px] opacity-70 rounded-2xl border p-4" style={{ color: FOREST, borderColor: `${FOREST}15`, backgroundColor: `${FOREST}04` }}>
                  No active perks right now. Check back later for partner offers.
                </p>
              ) : null}

              {/* Referral card */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "#FFFDF8",
                  border: `1px solid ${GOLD}40`,
                  boxShadow: `0 2px 12px rgba(0,0,0,0.06)`,
                }}
              >
                {/* Gold accent stripe */}
                <div
                  className="h-[3px] w-full"
                  style={{ background: `linear-gradient(90deg, ${GOLD}80 0%, ${GOLD} 50%, ${GOLD}80 100%)` }}
                />

                <div className="px-5 pt-4 pb-5 sm:px-6">
                  {/* Icon + eyebrow + headline */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: `${GOLD}18`,
                        boxShadow: `inset 0 0 0 1px ${GOLD}35`,
                      }}
                    >
                      <UsersThree size={22} weight="duotone" color={GOLD} aria-hidden />
                    </div>
                    <div className="pt-0.5">
                      <div
                        className="text-[9px] font-bold uppercase tracking-[0.14em] mb-1"
                        style={{ color: GOLD }}
                      >
                        {serviceType === "office_move" ? "Refer another business" : "Refer a friend & earn cash"}
                      </div>
                      <p className="text-[14px] font-semibold leading-snug mb-1" style={{ color: FOREST }}>
                        {serviceType === "office_move"
                          ? "Know a business that's moving?"
                          : "Give a friend a discount. Get cash back."}
                      </p>
                      <p className="text-[11px] leading-relaxed" style={{ color: `${FOREST}80` }}>
                        {serviceType === "office_move"
                          ? "Refer them to Yugo and earn a $200 credit on your next move."
                          : "Share your code — your friend saves, you earn credit when they book."}
                      </p>
                    </div>
                  </div>

                  {!referral ? (
                    <p
                      className="text-[11px] leading-relaxed rounded-xl px-4 py-3"
                      style={{ color: `${FOREST}60`, backgroundColor: `${FOREST}06`, border: `1px solid ${FOREST}12` }}
                    >
                      {isCompleted
                        ? "Your referral code is being prepared — check back in a moment."
                        : "Your referral code will appear here once your move is complete."}
                    </p>
                  ) : referral.status !== "active" ? (
                    <p
                      className="text-[11px] leading-relaxed rounded-xl px-4 py-3"
                      style={{ color: `${FOREST}60`, backgroundColor: `${FOREST}06`, border: `1px solid ${FOREST}12` }}
                    >
                      Your referral code has expired.{" "}
                      <a href={`mailto:${YUGO_EMAIL}`} className="underline" style={{ color: GOLD }}>Contact us</a>{" "}
                      for a new one.
                    </p>
                  ) : (
                    <>
                      {/* Value prop inline */}
                      <p className="text-[12px] leading-relaxed mb-4" style={{ color: `${FOREST}85` }}>
                        Your friend gets{" "}
                        <span className="font-semibold" style={{ color: GOLD }}>${referral.referred_discount} off</span>
                        {" "}their first Yugo move. You earn a{" "}
                        <span className="font-semibold" style={{ color: WINE }}>${referral.referrer_credit} credit</span>
                        {" "}when they book.
                      </p>

                      {/* Code + actions row */}
                      <div
                        className="flex items-center gap-0 rounded-xl mb-3 overflow-hidden"
                        style={{ border: `1px solid ${GOLD}50` }}
                      >
                        {/* Code display */}
                        <div
                          className="flex-1 px-3.5 py-2"
                          style={{ backgroundColor: `${GOLD}0c` }}
                        >
                          <span className="font-mono text-[12px] font-bold tracking-[0.18em]" style={{ color: FOREST }}>
                            {referral.referral_code}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="w-px self-stretch" style={{ backgroundColor: `${GOLD}50` }} />

                        {/* Copy */}
                        <button
                          type="button"
                          aria-label={referralCopied ? "Copied" : "Copy referral code"}
                          onClick={() => {
                            navigator.clipboard.writeText(referral.referral_code).then(() => {
                              setReferralCopied(true);
                              setTimeout(() => setReferralCopied(false), 2000);
                            });
                          }}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
                          style={{
                            backgroundColor: referralCopied ? `${GOLD}18` : "white",
                            color: referralCopied ? GOLD : `${FOREST}80`,
                          }}
                        >
                          {referralCopied
                            ? <><Check size={12} weight="bold" aria-hidden /> Copied</>
                            : <><Copy size={12} weight="regular" aria-hidden /> Copy</>}
                        </button>

                        {/* Divider */}
                        <div className="w-px self-stretch" style={{ backgroundColor: `${GOLD}50` }} />

                        {/* Share */}
                        <button
                          type="button"
                          aria-label="Share referral code"
                          onClick={() => {
                            const msg = `I just moved with Yugo — they were amazing! Use my code ${referral.referral_code} to get $${referral.referred_discount} off your move. Book at yugomoves.com`;
                            if (navigator.share) { navigator.share({ text: msg }).catch(() => {}); }
                            else { navigator.clipboard.writeText(msg); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000); }
                          }}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
                          style={{ backgroundColor: "white", color: WINE }}
                        >
                          <ShareNetwork size={13} weight="bold" aria-hidden />
                          Share
                        </button>

                        {/* Divider */}
                        <div className="w-px self-stretch" style={{ backgroundColor: `${GOLD}50` }} />

                        {/* SMS */}
                        <a
                          href={`sms:?body=${encodeURIComponent(`Moving soon? Use my YUGO referral code ${referral.referral_code} for $${referral.referred_discount} off. Book at yugomoves.com`)}`}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95"
                          style={{ backgroundColor: "white", color: `${FOREST}90` }}
                        >
                          <ChatCircle size={13} weight="bold" aria-hidden />
                          SMS
                        </a>
                      </div>

                      <p className="text-[10px]" style={{ color: `${FOREST}55` }}>
                        Terms and conditions apply.{" "}
                        <Link href="/terms" className="underline hover:opacity-80" style={{ color: GOLD }}>
                          Read more.
                        </Link>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* ── Need Yugo Again? (service-type + tier-smart CTAs) ── */}
            {(() => {
              const isOffice = serviceType === "office_move";
              const raw = (move.tier_selected || move.tier || move.service_tier || "").toLowerCase().trim().replace(/\s+/g, "_");
              const tier = (raw === "essentials" || raw === "curated") ? "essential" : raw === "premier" ? "signature" : raw;
              let ctas: { label: string; sub: string; href: string }[];
              let title = "Moving again? We've got you.";
              let heading = "Need Yugo again?";
              if (isOffice) {
                heading = "Planning another office move?";
                title = "Get a quote for your next relocation.";
                ctas = [{ label: "Get a Quote", sub: "Office relocation or commercial move", href: "https://yugoplus.co" }];
              } else if (isSingleItem) {
                heading = "Need to move more?";
                title = "Book a full move or another single item.";
                ctas = [
                  { label: "Book a Full Move", sub: "Local or long distance", href: "https://yugoplus.co" },
                  { label: "Another Single Item", sub: "Sofa, piano, art piece", href: "https://yugoplus.co" },
                ];
              } else {
                ctas =
                  tier === "essential"
                    ? [
                        { label: "Upgrade to Signature", sub: "Full protection, nothing left to chance", href: "https://yugoplus.co" },
                        { label: "Single Item Delivery", sub: "Sofa, piano, art piece — we deliver one item too", href: "https://yugoplus.co" },
                      ]
                    : tier === "signature"
                      ? [
                          { label: "Go Estate Next Time", sub: "White glove & dedicated coordinator", href: "https://yugoplus.co" },
                          { label: "Single Item Delivery", sub: "One piece? We&apos;ve got you", href: "https://yugoplus.co" },
                        ]
                      : tier === "estate"
                        ? [
                            { label: "Book again", sub: "Local or long distance", href: "https://yugoplus.co" },
                            { label: "Refer a friend", sub: "Give $50, get $50", href: "https://yugoplus.co" },
                          ]
                        : [
                            { label: "Book a Move", sub: "Local or long distance", href: "https://yugoplus.co" },
                            { label: "Single Item", sub: "Sofa, piano, art piece", href: "https://yugoplus.co" },
                            { label: "White Glove Service", sub: "Premium packing & placement", href: "https://yugoplus.co" },
                          ];
              }
              return (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: `1px solid ${FOREST}22`,
                    background: `linear-gradient(155deg, #f5f1ea 0%, #ede8de 100%)`,
                    boxShadow: "0 8px 32px rgba(44, 62, 45, 0.10), 0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* Top stripe */}
                  <div
                    className="h-1 w-full"
                    style={{ background: `linear-gradient(90deg, ${WINE} 0%, ${GOLD} 100%)` }}
                  />

                  <div className="px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
                    {/* Icon + eyebrow + headline */}
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: `${WINE}12`, boxShadow: `inset 0 0 0 1px ${WINE}22` }}
                      >
                        <ArrowsCounterClockwise size={22} weight="duotone" color={WINE} aria-hidden />
                      </div>
                      <div className="pt-0.5">
                        <div
                          className="text-[9px] font-bold uppercase tracking-[0.13em] mb-1"
                          style={{ color: `${FOREST}80` }}
                        >
                          {heading}
                        </div>
                        <h3
                          className="font-hero text-[19px] sm:text-[21px] font-semibold leading-snug"
                          style={{ color: WINE }}
                        >
                          {title}
                        </h3>
                      </div>
                    </div>

                    {/* CTA cards */}
                    <div className={`grid gap-2 ${ctas.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
                      {ctas.map(({ label, sub, href }) => (
                        <a
                          key={label}
                          href={href}
                          className="group flex items-center justify-between gap-2 rounded-xl px-4 py-3 transition-all hover:scale-[1.015] hover:shadow-md active:scale-[0.99]"
                          style={{
                            background: "rgba(255, 255, 255, 0.72)",
                            border: `1px solid ${FOREST}18`,
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          <div className="min-w-0">
                            <span className="block text-[12px] font-semibold leading-tight" style={{ color: FOREST }}>{label}</span>
                            <span className="block text-[10px] mt-0.5 leading-tight" style={{ color: `${FOREST}70` }}>{sub}</span>
                          </div>
                          <CaretRight
                            size={13}
                            weight="bold"
                            className="shrink-0 transition-transform group-hover:translate-x-0.5"
                            style={{ color: `${WINE}80` }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Tip Your Crew Card ── */}
            {tippingEnabled && (tipState === "first_visit" || tipState === "can_tip_later") && (() => {
              const tipAmounts = ([10, 20, 30] as const).map((pct) => ({
                pct,
                dollars: moveTotal > 0 ? Math.round((moveTotal * pct) / 100 * 100) / 100 : pct === 10 ? 5 : pct === 20 ? 10 : 20,
              }));
              const submitTipAmount = async (amount: number) => {
                if (amount < 5) { setTipSectionError("Minimum tip is $5.00"); return; }
                setTipSectionError(null);
                setTipSectionSubmitting(true);
                try {
                  const res = await fetch("/api/tips/charge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ moveId: move.id, slug: urlSlug || undefined, amount, token }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) { setTipSectionError((data as { error?: string }).error || "Could not process tip."); return; }
                  setConfirmedTipAmount(amount);
                  setTipState("tipped");
                } catch { setTipSectionError("Something went wrong."); }
                finally { setTipSectionSubmitting(false); }
              };
              return (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    border: `1px solid ${GOLD}40`,
                    background: `linear-gradient(165deg, ${WINE} 0%, #3a1422 38%, #1a0c12 100%)`,
                    boxShadow: `0 16px 48px rgba(92, 26, 51, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)`,
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex items-start gap-3 px-4 pt-4 pb-3"
                    style={{ borderBottom: `1px solid rgba(255, 255, 255, 0.08)` }}
                  >
                    <div
                      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: `${GOLD}24`,
                        boxShadow: `inset 0 0 0 1px ${GOLD}45`,
                      }}
                    >
                      <HandHeart size={22} weight="duotone" color={GOLD} aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="block text-[15px] font-semibold tracking-tight text-white">
                        Tip Your Crew
                      </span>
                      <span
                        className="mt-0.5 block text-[11px] leading-snug"
                        style={{ color: "rgba(255, 255, 255, 0.52)" }}
                      >
                        A thank-you that goes straight to the people who moved you.
                      </span>
                    </div>
                  </div>

                  {/* Amount pills */}
                  <div className="px-4 pt-4 pb-1">
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      {tipAmounts.map(({ dollars }) => (
                        <button
                          key={dollars}
                          type="button"
                          disabled={tipSectionSubmitting}
                          onClick={() => {
                            setTipSectionShowCustom(false);
                            setTipSectionCustom("");
                            setTipSectionError(null);
                            submitTipAmount(dollars);
                          }}
                          className="min-w-[4.5rem] flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 border"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.07)",
                            color: "#fff",
                            borderColor: `${GOLD}35`,
                          }}
                        >
                          {formatCurrency(dollars)}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={tipSectionSubmitting}
                        onClick={() => { setTipSectionShowCustom(true); setTipSectionError(null); }}
                        className="shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 border"
                        style={{
                          backgroundColor: tipSectionShowCustom ? `${GOLD}28` : "rgba(255, 255, 255, 0.05)",
                          color: tipSectionShowCustom ? "#fff" : "rgba(255, 255, 255, 0.65)",
                          borderColor: tipSectionShowCustom ? `${GOLD}70` : `${GOLD}30`,
                        }}
                      >
                        Custom
                      </button>
                    </div>
                  </div>

                  {/* Custom input */}
                  {tipSectionShowCustom && (
                    <div className="px-4 pt-2 pb-1">
                      <div
                        className="flex items-center rounded-xl px-3 gap-1"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.25)",
                          border: `1px solid ${GOLD}50`,
                          boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
                        }}
                      >
                        <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>$</span>
                        <input
                          type="number"
                          min={5}
                          step={1}
                          placeholder="Enter amount"
                          value={tipSectionCustom}
                          onChange={(e) => { setTipSectionCustom(e.target.value.replace(/[^0-9.]/g, "")); setTipSectionError(null); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = parseFloat(tipSectionCustom) || 0;
                              submitTipAmount(v);
                            }
                          }}
                          className="flex-1 bg-transparent text-[13px] font-medium outline-none py-2.5 placeholder:opacity-25"
                          style={{ color: "#fff" }}
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={tipSectionSubmitting || (parseFloat(tipSectionCustom) || 0) < 5}
                          onClick={() => submitTipAmount(parseFloat(tipSectionCustom) || 0)}
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-opacity disabled:opacity-30"
                          style={{ color: GOLD }}
                        >
                          {tipSectionSubmitting ? "…" : "Send"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submitting / error state */}
                  {tipSectionSubmitting && !tipSectionError && (
                    <p className="px-4 pt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Processing…
                    </p>
                  )}
                  {tipSectionError && (
                    <p className="px-4 pt-2 text-[11px] text-red-400">{tipSectionError}</p>
                  )}

                  {/* Footer */}
                  <p
                    className="px-4 pt-3 pb-4 text-[10px] font-medium tracking-wide uppercase"
                    style={{ color: `${GOLD}cc`, letterSpacing: "0.06em" }}
                  >
                    100% goes directly to your crew
                  </p>
                </div>
              );
            })()}

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
            {additionalFeesCents > 0 && !indicativeSettled && baseBalance <= 0 && (
              <div className="pb-4 text-[11px] opacity-70" style={{ color: FOREST }}>
                Additional charges of {formatCurrency((additionalFeesCents || 0) / 100)} from approved changes.
              </div>
            )}

            {/* ── Event Phases (shown when move is part of an event booking) ── */}
            {move.event_name && (
              <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: "#7C3AED11", border: "1px solid #7C3AED30" }}>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7C3AED" }}>
                  Event · {move.event_name}
                </div>
                <div className="space-y-2">
                  {/* Delivery phase */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: move.event_phase === "delivery" && move.status === "completed" ? "#22C55E22" : move.event_phase === "delivery" ? "#7C3AED22" : "#E5E7EB22",
                        border: `1.5px solid ${move.event_phase === "delivery" && move.status === "completed" ? "#22C55E" : move.event_phase === "delivery" ? "#7C3AED" : "#9CA3AF"}`,
                      }}
                    >
                      {move.event_phase === "delivery" && move.status === "completed" ? (
                        <Check size={10} color="#22C55E" weight="bold" />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ background: move.event_phase === "delivery" ? "#7C3AED" : "#9CA3AF" }} />
                      )}
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: FOREST }}>
                        Delivery — {move.event_phase === "delivery" ? (move.scheduled_date ? new Date(move.scheduled_date + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "TBD") : "Deliver to venue"}
                      </div>
                      {move.event_phase !== "delivery" && (
                        <div className="text-[10px] opacity-50" style={{ color: FOREST }}>Items transported to venue</div>
                      )}
                      {move.event_phase === "delivery" && (
                        <div className="text-[10px] font-medium" style={{ color: move.status === "completed" ? "#22C55E" : "#7C3AED" }}>
                          {move.status === "completed" ? "Completed" : "This booking"}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Return phase indicator */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: move.event_phase === "return" && move.status === "completed" ? "#22C55E22" : move.event_phase === "return" ? "#05966922" : "#E5E7EB22",
                        border: `1.5px solid ${move.event_phase === "return" && move.status === "completed" ? "#22C55E" : move.event_phase === "return" ? "#059669" : "#9CA3AF"}`,
                      }}
                    >
                      {move.event_phase === "return" && move.status === "completed" ? (
                        <Check size={10} color="#22C55E" weight="bold" />
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ background: move.event_phase === "return" ? "#059669" : "#9CA3AF" }} />
                      )}
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: FOREST }}>
                        Return — {move.event_phase === "return" ? (move.scheduled_date ? new Date(move.scheduled_date + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "TBD") : "Teardown & return"}
                      </div>
                      {move.event_phase !== "return" && (
                        <div className="text-[10px] opacity-50" style={{ color: FOREST }}>Items returned from venue</div>
                      )}
                      {move.event_phase === "return" && (
                        <div className="text-[10px] font-medium" style={{ color: move.status === "completed" ? "#22C55E" : "#059669" }}>
                          {move.status === "completed" ? "Completed" : "Upcoming"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
                      <CaretRight size={10} weight="regular" className="text-current" />
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

              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-start justify-between gap-4">
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
                </div>
                {totalBalance > 0 && outstandingInventoryAdj && hasCardOnFile && (
                  <p className="text-[11px] leading-relaxed opacity-85" style={{ color: FOREST }}>
                    Inventory update approved. Additional charge: {formatCurrency(totalBalance)} + {formatCurrency(calcHST(totalBalance))} HST.
                  </p>
                )}
                {totalBalance > 0 && outstandingInventoryAdj && !hasCardOnFile && (
                  <p className="text-[11px] leading-relaxed opacity-85" style={{ color: FOREST }}>
                    Additional charge: {formatCurrency(totalBalance)} + {formatCurrency(calcHST(totalBalance))} HST. Add a card below to authorize the charge, or contact your coordinator.
                  </p>
                )}
                {balanceChargeError && (
                  <div
                    className="text-[11px] font-medium px-3 py-2 rounded-lg"
                    style={{ backgroundColor: "rgba(209,67,67,0.08)", color: "#D14343", border: "1px solid rgba(209,67,67,0.2)" }}
                  >
                    {balanceChargeError}
                  </div>
                )}
                {totalBalance > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    {hasCardOnFile && (
                      <button
                        type="button"
                        onClick={() => void handlePayWithSavedCard()}
                        disabled={chargingSavedCard}
                        className="rounded-full font-semibold text-[11px] py-2 px-5 transition-all hover:opacity-90 active:scale-95 shrink-0 tracking-wide shadow-sm disabled:opacity-50"
                        style={{ backgroundColor: GOLD, color: "#FAF7F2", boxShadow: `0 2px 12px ${GOLD}40` }}
                      >
                        {chargingSavedCard ? "Processing…" : "Pay Now"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSqError(null);
                        setPaymentModalOpen(true);
                      }}
                      className={`rounded-full font-semibold text-[11px] py-2 px-5 transition-all border ${
                        hasCardOnFile ? "opacity-90 hover:opacity-100" : ""
                      }`}
                      style={
                        hasCardOnFile
                          ? { borderColor: `${FOREST}25`, color: FOREST, backgroundColor: "transparent" }
                          : { backgroundColor: GOLD, color: "#FAF7F2", borderColor: "transparent", boxShadow: `0 2px 12px ${GOLD}40` }
                      }
                    >
                      {hasCardOnFile ? "Use a different card" : "Add Card"}
                    </button>
                  </div>
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

            {/* ── Pre-Move Checklist (72hr window, non-completed moves) ── */}
            {!isCompleted && daysUntil != null && daysUntil >= 0 && daysUntil <= 3 && !isInProgress && (
              <div className="mt-5">
                <PreMoveChecklist
                  moveId={move.id}
                  token={token}
                  initialChecked={(move.pre_move_checklist as Record<string, boolean>) || {}}
                  crewName={crewMembers.length > 0 ? crewMembers.slice(0, 2).join(" & ") : undefined}
                  arrivalWindow={arrivalWindow || undefined}
                  moveDateStr={move.scheduled_date || undefined}
                />
              </div>
            )}

            {/* ── Client Room Photo Capture (3-day window, pre-move) ── */}
            {!isCompleted && daysUntil != null && daysUntil >= 0 && daysUntil <= 5 && !isInProgress && (
              <div className="mt-5">
                <ClientRoomPhotoCapture
                  moveId={move.id}
                  token={token}
                  initialPhotos={(move.client_room_photos as Record<string, { url: string; uploadedAt: string }>) || {}}
                />
              </div>
            )}

            {/* ── Live Move Timeline (move day or in-progress) ── */}
            {!isCompleted && (daysUntil === 0 || isInProgress) && (
              <div className="mt-5">
                <LiveMoveTimeline
                  moveId={move.id}
                  token={token}
                  currentStatus={move.status || ""}
                />
              </div>
            )}

            {!isCompleted && (
              <div className="pt-5 mt-3 space-y-3">
                {inventoryChangeFeatureOn && inventoryChangeItemWeights.length > 0 && (
                  <>
                    {inventoryChangePending ? (
                      <div
                        className="rounded-xl border px-4 py-3"
                        style={{ borderColor: `${GOLD}35`, backgroundColor: `${GOLD}08` }}
                      >
                        <div className="text-[11px] font-bold" style={{ color: WINE }}>
                          Inventory change pending review
                        </div>
                        <p className="text-[10px] mt-1 opacity-70 leading-snug" style={{ color: FOREST }}>
                          Your coordinator will confirm pricing and truck fit. You&apos;ll get an email when it&apos;s decided.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div
                          className="rounded-xl border px-4 py-3"
                          style={{
                            borderColor: inventoryChangeEligible ? `${GOLD}30` : `${FOREST}12`,
                            backgroundColor: inventoryChangeEligible ? `${GOLD}06` : `${FOREST}04`,
                            opacity: inventoryChangeEligible ? 1 : 0.75,
                          }}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
                            Need to update your inventory?
                          </div>
                          <p className="text-[11px] leading-relaxed opacity-80 mb-3" style={{ color: FOREST }}>
                            Add or remove items before your move. Changes are reviewed by your coordinator.
                          </p>
                          <button
                            type="button"
                            disabled={!inventoryChangeEligible}
                            onClick={() => inventoryChangeEligible && setInventoryChangeModalOpen(true)}
                            className="w-full sm:w-auto rounded-full font-semibold text-[11px] py-2.5 px-5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
                          >
                            Request inventory change
                          </button>
                          {!inventoryChangeEligible && inventoryChangeReason && (
                            <p className="text-[10px] mt-2 opacity-55 leading-snug" style={{ color: FOREST }}>
                              {inventoryChangeReason}
                            </p>
                          )}
                        </div>
                        <InventoryChangeRequestModal
                          open={inventoryChangeModalOpen}
                          onClose={() => setInventoryChangeModalOpen(false)}
                          moveId={move.id}
                          token={token}
                          itemWeights={inventoryChangeItemWeights}
                          inventoryLines={(dashboardInventory?.items ?? []).map((i: { id: string; item_name?: string }) => ({
                            id: i.id,
                            item_name: i.item_name || "Item",
                          }))}
                          currentSubtotal={Number(move.amount) || 0}
                          perScoreRate={inventoryChangePerScoreRate}
                          maxLines={inventoryChangeMaxItems}
                          onSubmitted={() => {
                            toast("Change request sent. We'll email you when it's reviewed.", "check");
                            router.refresh();
                          }}
                        />
                      </>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(true)}
                  className="text-[11px] font-semibold opacity-40 hover:opacity-70 transition-opacity flex items-center gap-1.5"
                  style={{ color: FOREST }}
                >
                  <Plus size={10} weight="regular" className="text-current" />
                  {inventoryChangeFeatureOn && inventoryChangeItemWeights.length > 0
                    ? "Other change request"
                    : "Request a Change"}
                </button>
              </div>
            )}

            {/* ── Perks & Referral (completed moves only) ── */}
            {isCompleted && (
              <div className="border-t border-[var(--brd)]/20 pt-6 mt-6 space-y-6">

                {/* Your offers (hero): perks + referral */}
                <div className="space-y-5">
                  <h2 className="font-hero text-[20px] sm:text-[22px] font-semibold leading-tight" style={{ color: WINE }}>
                    Your offers
                  </h2>
                  {perks.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1 scroll-smooth snap-x snap-mandatory">
                      {perks.map((perk, idx) => {
                        const theme = PERK_CARD_THEMES[idx % PERK_CARD_THEMES.length];
                        return (
                          <div
                            key={perk.id}
                            className="rounded-2xl overflow-hidden shrink-0 w-[310px] max-w-[88vw] snap-start flex flex-col relative"
                            style={{ background: theme.bg, minHeight: "140px" }}
                          >
                            {/* Top-right: Yugo+ Exclusive badge (Wine Rack style) */}
                            <div className="absolute top-0 right-0 bg-white rounded-bl-xl px-2.5 py-1 flex items-center gap-1.5">
                              <YugoLogo size={10} variant="black" onLightBackground hidePlus />
                              <span className="text-[9px] font-bold text-black">Exclusive</span>
                            </div>
                            {/* Content */}
                            <div className="flex-1 px-4 py-3.5 pt-8 flex flex-col justify-between min-w-0">
                              <div>
                                {perk.organizations?.name && (
                                  <div className="text-[9px] font-semibold text-white/60 mb-1">
                                    From <SafeText fallback="our partner">{perk.organizations.name}</SafeText>
                                  </div>
                                )}
                                <div className="text-[13px] font-bold text-white leading-tight line-clamp-2">
                                  <SafeText fallback="Partner offer">{perk.title}</SafeText>
                                </div>
                                <div className="text-[10px] text-white/80 mt-1 leading-snug line-clamp-3">
                                  <SafeText fallback="Exclusive offer for Yugo movers. Terms apply.">
                                    {perk.description ?? "Exclusive offer for Yugo movers. Terms apply."}
                                  </SafeText>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {perk.redemption_code && (
                                  <span className="text-[9px] font-mono font-bold text-white/90 bg-white/15 border border-white/25 px-1.5 py-0.5 rounded">
                                    Code: <SafeText fallback="—">{perk.redemption_code}</SafeText>
                                  </span>
                                )}
                                {perk.valid_until && (
                                  <span className="text-[9px] text-white/45">Ends {formatPerkExpiry(perk.valid_until)}</span>
                                )}
                                {perk.redemption_url ? (
                                  <a
                                    href={perk.redemption_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      fetch("/api/perks/redeem", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ perk_id: perk.id, client_email: move.client_email, move_id: move.id }),
                                      }).catch(() => {});
                                    }}
                                    className="ml-auto shrink-0 bg-white text-[10px] font-bold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                                    style={{ color: theme.stamp }}
                                  >
                                    {perk.redemption_code ? "Order now" : "Redeem"}
                                  </a>
                                ) : perk.redemption_code ? (
                                  <button
                                    type="button"
                                    aria-label="Copy perk code"
                                    onClick={() => navigator.clipboard.writeText(perk.redemption_code!).catch(() => {})}
                                    className="ml-auto shrink-0 w-9 h-9 inline-flex items-center justify-center bg-white rounded-full border border-white/30 hover:opacity-90 transition-opacity"
                                    style={{ color: theme.stamp }}
                                  >
                                    <Copy size={16} weight="regular" className="text-current" aria-hidden />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] opacity-70 rounded-2xl border p-4" style={{ color: FOREST, borderColor: `${FOREST}15`, backgroundColor: `${FOREST}04` }}>
                      No active perks right now. Check back later for partner offers.
                    </p>
                  )}

                  {/* Refer a friend (under same hero) */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1" style={{ color: FOREST }}>
                      Refer a friend & earn cash
                    </div>
                  <p className="text-[11px] opacity-70 mb-3" style={{ color: FOREST }}>
                    {referral && referral.status === "active"
                      ? `Your friend saves, you earn $${referral.referrer_credit} credit when they book.`
                      : "Share your code — your friend saves, you earn credit when they book."}
                  </p>
                  {!referral ? (
                    <div className="rounded-2xl border p-4 text-center" style={{ borderColor: `${FOREST}15`, backgroundColor: `${FOREST}03` }}>
                      <p className="text-[12px] opacity-50 leading-relaxed" style={{ color: FOREST }}>
                        {isCompleted
                          ? "Your referral code is being prepared — check back in a moment."
                          : "Your referral code will appear here once your move is complete."}
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
                    <div
                      className="rounded-2xl border p-4 sm:p-5"
                      style={{ borderColor: `${FOREST}20`, backgroundColor: `${FOREST}04` }}
                    >
                      <p className="text-[12px] leading-relaxed mb-4" style={{ color: FOREST }}>
                        Share your code — your friend gets{" "}
                        <span className="font-semibold" style={{ color: WINE }}>
                          ${referral.referred_discount} off
                        </span>{" "}
                        their first Yugo move.
                      </p>
                      <div
                        className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 mb-3"
                        style={{ borderColor: `${GOLD}35`, backgroundColor: `${GOLD}08` }}
                      >
                        <span className="font-mono text-[var(--text-base)] font-bold tracking-widest" style={{ color: WINE }}>
                          {referral.referral_code}
                        </span>
                        <button
                          type="button"
                          aria-label={referralCopied ? "Copied" : "Copy referral code"}
                          onClick={() => {
                            navigator.clipboard.writeText(referral.referral_code).then(() => {
                              setReferralCopied(true);
                              setTimeout(() => setReferralCopied(false), 2000);
                            });
                          }}
                          className="shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-xl transition-all active:scale-95"
                          style={{ color: FOREST }}
                        >
                          {referralCopied ? <Check size={18} weight="bold" aria-hidden /> : <Copy size={18} weight="regular" aria-hidden />}
                        </button>
                      </div>
                      <p className="text-[10px] opacity-60 mb-3" style={{ color: FOREST }}>
                        Terms and conditions apply.{" "}
                        <Link href="/terms" className="underline hover:opacity-80" style={{ color: GOLD }}>
                          Click here to read more.
                        </Link>
                      </p>
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
                          style={{ backgroundColor: WINE, color: "#FAF7F2" }}
                        >
                          <ShareNetwork size={11} className="text-current" />
                          Share with a friend
                        </button>
                        <a
                          href={`sms:?body=${encodeURIComponent(`Moving soon? Use my YUGO referral code ${referral.referral_code} for $${referral.referred_discount} off. Book at yugomoves.com`)}`}
                          className="flex items-center gap-1.5 rounded-full text-[10px] font-semibold px-3.5 py-2 transition-all hover:opacity-90 active:scale-95"
                          style={{ backgroundColor: `${FOREST}12`, color: FOREST }}
                        >
                          <ChatCircle size={11} className="text-current" />
                          Send via SMS
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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

      <footer className="py-3 px-4 text-center border-t" style={{ backgroundColor: "#FAF7F2", borderColor: `${FOREST}10` }}>
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

      {/* Change Request Modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center backdrop-blur-md bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-5" style={{ borderColor: `${FOREST}20`, maxHeight: "min(90dvh, 90vh)", overflowY: "auto" }}>
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
                  style={{ borderColor: `${FOREST}25`, backgroundColor: "#FAF7F2", color: FOREST }}
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {changeType === "Change destination address" && (
                <div style={{ borderColor: `${FOREST}25`, backgroundColor: "#FAF7F2", color: FOREST }}>
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
                  style={{ borderColor: `${FOREST}25`, backgroundColor: "#FAF7F2", color: FOREST }}
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
                  style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
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
          <div className="fixed inset-0 z-[var(--z-modal)] flex min-h-0 items-center justify-center p-4 sm:p-5">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPaymentModalOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden overflow-y-auto" style={{ maxHeight: "min(92dvh, 92vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-bold" style={{ color: FOREST }}>Pay Balance</h2>
                  <button type="button" onClick={() => setPaymentModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F0F0F0] transition-colors">
                    <X size={16} weight="regular" color={FOREST} />
                  </button>
                </div>

                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: `${FOREST}15`, backgroundColor: `${"#FAF7F2"}` }}>
                  <div className="flex justify-between text-[13px] mb-1.5" style={{ color: FOREST }}>
                    <span className="opacity-70">Move balance</span>
                    <span className="font-semibold">{formatCurrency(totalBalance)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] mb-1.5" style={{ color: FOREST }}>
                    <span className="opacity-70">HST (13%)</span>
                    <span className="font-semibold">{formatCurrency(calcHST(totalBalance))}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between text-[var(--text-base)] font-bold" style={{ borderColor: `${FOREST}15`, color: GOLD }}>
                    <span>Total</span>
                    <span>{formatCurrency(totalBalance + calcHST(totalBalance))}</span>
                  </div>
                </div>

                <div className="mb-1.5">
                  <div className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: GOLD }}>Card Details</div>
                  <div className="rounded-xl border-2 p-3.5 transition-colors" style={{ borderColor: sqCardReady ? GOLD : `${FOREST}15`, backgroundColor: "#FAF7F2" }}>
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
                    <SafeText fallback="Payment couldn&apos;t be processed. Please refresh and try again.">{sqError}</SafeText>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleInlinePayment}
                  disabled={!sqCardReady || sqProcessing}
                  className="w-full py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                  style={{ backgroundColor: sqCardReady && !sqProcessing ? GOLD : `${GOLD}60`, color: "#FAF7F2" }}
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
                  <Lock size={12} color="#999" />
                  <span className="text-[10px] opacity-50" style={{ color: FOREST }}>Secured by Square · 256-bit encryption</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CrewChangeRequestBanner — shown when crew submits a walkthrough
// change request during move-day pickup.
// ─────────────────────────────────────────────────────────────

type CrewChangeRequestItem = {
  item_name?: string;
  quantity?: number;
  surcharge?: number;
  credit?: number;
};

function CrewChangeRequestBanner({
  request,
  moveId,
  token,
  hasCardOnFile,
  onApproved,
  onDeclined,
  error,
  onError,
}: {
  request: {
    id: string;
    auto_calculated_delta: number;
    items_added: unknown[];
    items_removed: unknown[];
  };
  moveId: string;
  token: string;
  hasCardOnFile: boolean;
  onApproved: (state: "approved" | "approved_pending_payment") => void;
  onDeclined: () => void;
  error: string | null;
  onError: (e: string | null) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [declining, setDeclining] = useState(false);

  const delta = Number(request.auto_calculated_delta) || 0;
  const hst = Math.round(delta * 0.13 * 100) / 100;
  const total = Math.round((delta + hst) * 100) / 100;

  const added = (request.items_added as CrewChangeRequestItem[]).filter((i) => i && i.item_name);
  const removed = (request.items_removed as CrewChangeRequestItem[]).filter((i) => i && (i as { item_name?: string }).item_name);

  const handleApprove = async () => {
    setApproving(true);
    onError(null);
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/crew-change-request/${request.id}/approve?token=${encodeURIComponent(token)}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      onApproved(data.state === "approved_pending_payment" ? "approved_pending_payment" : "approved");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to process approval");
    } finally {
      setApproving(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    onError(null);
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/crew-change-request/${request.id}/decline?token=${encodeURIComponent(token)}`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decline");
      onDeclined();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to decline");
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/6 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-2.5 mb-3">
          <Warning size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold text-amber-800">Inventory Update</p>
            <p className="text-[11px] text-amber-700/70 mt-0.5">Your crew found differences during the walkthrough.</p>
          </div>
        </div>

        {added.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/60 mb-1.5">Items not on quote</p>
            <div className="space-y-1">
              {added.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span className="text-amber-800">{item.item_name}{(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ""}</span>
                  <span className="font-semibold text-amber-700">+${item.surcharge ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {removed.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/60 mb-1.5">Items not found (credit)</p>
            <div className="space-y-1">
              {removed.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span className="text-amber-800">{(item as { item_name?: string }).item_name}{((item as { quantity?: number }).quantity ?? 1) > 1 ? ` ×${(item as { quantity?: number }).quantity}` : ""}</span>
                  <span className="font-semibold text-green-600">-${Math.abs(item.credit ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-amber-400/20 pt-2 mt-1 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-amber-700/70">
            <span>Subtotal change</span>
            <span>{delta >= 0 ? "+" : ""}${delta}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-amber-700/70">
            <span>HST (13%)</span>
            <span>{hst >= 0 ? "+" : "-"}${Math.abs(hst).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] font-bold text-amber-800">
            <span>Additional charge</span>
            <span>{total >= 0 ? `$${total.toFixed(2)}` : `-$${Math.abs(total).toFixed(2)}`}</span>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-[11px] text-red-500">{error}</p>
        )}
      </div>

      <div className="grid grid-cols-2 border-t border-amber-400/20">
        <button
          onClick={handleApprove}
          disabled={approving || declining}
          className="py-3 text-[12px] font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
        >
          {approving
            ? "Processing…"
            : hasCardOnFile
              ? `Approve & Pay $${total.toFixed(2)}`
              : "Approve"}
        </button>
        <button
          onClick={handleDecline}
          disabled={approving || declining}
          className="py-3 text-[12px] font-medium text-amber-700 hover:bg-amber-400/10 disabled:opacity-50 transition-colors"
        >
          {declining ? "…" : "Decline Extras"}
        </button>
      </div>
    </div>
  );
}
