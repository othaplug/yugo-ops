"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import YugoLogo from "@/components/YugoLogo";
import YugoMarketingFooter from "@/components/YugoMarketingFooter";
import { WINE, FOREST, CREAM } from "@/lib/client-theme";
import {
  FOREST_BODY,
  FOREST_MUTED,
  QUOTE_EYEBROW_CLASS,
  QUOTE_PANEL_RECEIPT,
  QUOTE_SECTION_H2_CLASS,
} from "@/app/quote/[quoteId]/quote-shared";
import {
  addressWithoutPostalSuffix,
  formatAddressForDisplay,
  toTitleCase,
} from "@/lib/format-text";
import { normalizeDeliveryItem } from "@/lib/delivery-items";
import { shouldRevealCrewNamesOnMoveTrack } from "@/lib/track-crew-visibility";
import {
  CaretDown,
  CaretRight,
  Check,
  CornersIn,
  CornersOut,
  GoogleLogo,
  Phone,
  Star,
  User,
} from "@phosphor-icons/react";

const DeliveryTrackMap = dynamic(() => import("./DeliveryTrackMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[240px] flex items-center justify-center bg-[#FAF7F2] text-[#4F4B47] text-[12px]">
      Loading map…
    </div>
  ),
});

/** Full 5 stages (two-leg delivery). Used for progress %, ETA logic, and admin/partner. */
const DELIVERY_STAGES_FULL = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route_to_destination",
  "arrived_at_destination",
  "completed",
] as const;

/** Legacy stage → normalized stage for backward compatibility */
function normalizeDeliveryStage(stage: string | null): string | null {
  if (!stage) return null;
  const legacy: Record<string, string> = {
    en_route: "en_route_to_pickup",
    arrived: "arrived_at_pickup",
    delivering: "en_route_to_destination",
  };
  return legacy[stage] || stage;
}

/** Client-facing labels for all 5 stages */
const CLIENT_STAGE_LABELS: Record<string, string> = {
  en_route_to_pickup: "En route to pick up",
  arrived_at_pickup: "En route to pick up",
  en_route_to_destination: "On the way to you",
  arrived_at_destination: "Delivering",
  completed: "Complete",
  en_route: "En route to pick up",
  arrived: "En route to pick up",
  delivering: "Delivering",
};

/** 4 separate client steps: pick up → on the way to you → delivering → complete */
const CLIENT_MAIN_STEPS = [
  "En route to pick up",
  "On the way to you",
  "Delivering",
  "Complete",
] as const;

/** Map normalized stage to main step index (0–3) for 4-step progress */
function getClientMainStepIndex(normalized: string | null): number {
  if (!normalized) return 0;
  if (normalized === "en_route_to_pickup" || normalized === "arrived_at_pickup")
    return 0;
  if (normalized === "en_route_to_destination") return 1;
  if (normalized === "arrived_at_destination") return 2;
  if (normalized === "completed") return 3;
  return 0;
}

type Coord = { lat: number; lng: number };
type CrewPos = {
  current_lat: number;
  current_lng: number;
  name?: string;
} | null;
type StepCompletedAtTuple = [
  string | null,
  string | null,
  string | null,
  string | null,
];

const TRACK_TZ = "America/Toronto";

function formatStepCompletedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    timeZone: TRACK_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STYLE_ID = "track-delivery-animations";

/** Quote cream-body style: rules between sections instead of stacked white cards */
const TRACK_SECTION_DIVIDE = "divide-y divide-[#2C3E2D]/14";

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes routePulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
    @keyframes stepPing { 0% { transform: scale(1); opacity: 0.7; } 70% { transform: scale(2.2); opacity: 0; } 100% { transform: scale(2.2); opacity: 0; } }
    @keyframes stepBounceIn { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
    .anim-slide-up { animation: fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
    .anim-delay-1 { animation-delay: 0.08s; }
    .anim-delay-2 { animation-delay: 0.16s; }
    .anim-delay-3 { animation-delay: 0.24s; }
    .anim-delay-4 { animation-delay: 0.32s; }
    .anim-delay-5 { animation-delay: 0.40s; }
    .route-dot-pulse { animation: routePulse 1.8s ease-in-out infinite; }
    .step-ping { animation: stepPing 2s cubic-bezier(0,0,0.2,1) infinite; }
    .step-bounce-in { animation: stepBounceIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
  `;
  document.head.appendChild(style);
}

function PostDeliveryRating({
  deliveryId,
  token,
  googleReviewUrl,
}: {
  deliveryId: string;
  token: string;
  googleReviewUrl?: string | null;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  useEffect(() => {
    fetch(
      `/api/track/delivery/${deliveryId}/rating?token=${encodeURIComponent(token)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.satisfaction_rating) {
          setExistingRating(d.satisfaction_rating);
          setRating(d.satisfaction_rating);
          setSubmitted(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load existing delivery rating:", err);
      });
  }, [deliveryId, token]);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/track/delivery/${deliveryId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (res.ok) setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit delivery rating:", err);
    }
    setSubmitting(false);
  };

  if (submitted) {
    const finalRating = rating || existingRating || 0;
    return (
      <div className="text-center py-4">
        <div className="flex justify-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={22}
              color={WINE}
              weight={n <= finalRating ? "fill" : "regular"}
              aria-hidden
            />
          ))}
        </div>
        <p className="text-[13px] font-semibold" style={{ color: FOREST }}>
          Thank you for your feedback!
        </p>
        {finalRating >= 5 && googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 mt-4 px-5 py-3 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-80"
            style={{
              backgroundColor: WINE,
              color: CREAM,
            }}
          >
            <GoogleLogo size={14} className="shrink-0" color={CREAM} aria-hidden />
            Google review
            <CaretRight size={14} className="shrink-0" color={CREAM} aria-hidden />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3
        className={`${QUOTE_SECTION_H2_CLASS} text-[1.25rem]`}
        style={{ color: WINE }}
      >
        Rate your delivery
      </h3>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={32}
              color={WINE}
              weight={rating != null && n <= rating ? "fill" : "regular"}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)…"
        className="w-full p-3 rounded-none border text-[13px] outline-none resize-none"
        style={{ borderColor: `${FOREST}22`, color: FOREST }}
        rows={2}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className="w-full py-3.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ backgroundColor: FOREST }}
      >
        {submitting ? "Submitting…" : "Submit feedback"}
      </button>
    </div>
  );
}

export default function TrackDeliveryClient({
  delivery,
  token,
  initialPickup,
  initialDropoff,
  googleReviewUrl,
  b2bAudience = null,
  b2bCoBrand = null,
  b2bPodImageUrl = null,
  b2bItemSummary = null,
  b2bCrewSize = null,
  b2bAssembly = false,
  b2bDebrisRemoval = false,
  companyContactEmail = process.env.NEXT_PUBLIC_YUGO_EMAIL || "support@helloyugo.com",
}: {
  delivery: any;
  token: string;
  initialPickup?: { lat: number; lng: number } | null;
  initialDropoff?: { lat: number; lng: number } | null;
  googleReviewUrl?: string | null;
  /** Public B2B one-off tracking (no partner portal). */
  b2bAudience?: "business" | "recipient" | null;
  b2bCoBrand?: string | null;
  b2bPodImageUrl?: string | null;
  b2bItemSummary?: string | null;
  b2bCrewSize?: number | null;
  b2bAssembly?: boolean;
  b2bDebrisRemoval?: boolean;
  companyContactEmail?: string;
}) {
  const [liveStage, setLiveStage] = useState<string | null>(
    delivery.stage || null,
  );
  const [crewLoc, setCrewLoc] = useState<CrewPos>(null);
  const [crewName, setCrewName] = useState<string | null>(null);
  const [crewPhone, setCrewPhone] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);
  const defaultCenter = initialDropoff ||
    initialPickup || { lat: 43.665, lng: -79.385 };
  const [center, setCenter] = useState<Coord>(defaultCenter);
  const [pickup, setPickup] = useState<Coord | null>(initialPickup || null);
  const [dropoff, setDropoff] = useState<Coord | null>(initialDropoff || null);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(
    delivery.eta_current_minutes ?? null,
  );
  const [stepCompletedAt, setStepCompletedAt] =
    useState<StepCompletedAtTuple | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const prevTrackingRef = useRef(false);

  useEffect(() => {
    injectStyles();
  }, []);

  // Auto-expand when tracking becomes active
  useEffect(() => {
    if (hasActiveTracking && !prevTrackingRef.current) {
      setMapExpanded(true);
    }
    prevTrackingRef.current = hasActiveTracking;
  }, [hasActiveTracking]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/track/delivery/${delivery.id}/crew-status?token=${encodeURIComponent(token)}`,
        );
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data.liveStage != null) setLiveStage(data.liveStage);
        if (data.crew) setCrewLoc(data.crew);
        else setCrewLoc(null);
        setCrewName(
          typeof data.crewName === "string" && data.crewName.trim()
            ? data.crewName.trim()
            : null,
        );
        if (data.crewPhone) setCrewPhone(data.crewPhone);
        if (data.dispatchPhone) setDispatchPhone(data.dispatchPhone);
        if (data.center?.lat != null) setCenter(data.center);
        if (data.pickup) setPickup(data.pickup);
        if (data.dropoff) setDropoff(data.dropoff);
        setHasActiveTracking(!!data.hasActiveTracking);
        if (data.eta_current_minutes != null)
          setLiveEtaMinutes(data.eta_current_minutes);
        else setLiveEtaMinutes(null);
        if (
          Array.isArray(data.stepCompletedAt) &&
          data.stepCompletedAt.length === 4
        ) {
          setStepCompletedAt(data.stepCompletedAt as StepCompletedAtTuple);
        }
      } catch (err) {
        console.error("Failed to poll delivery crew status:", err);
      }
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [delivery.id, token]);

  const itemsCount = Array.isArray(delivery.items) ? delivery.items.length : 0;
  const normalizedStage = normalizeDeliveryStage(liveStage);
  const statusVal =
    normalizedStage === "completed" ? "delivered" : delivery.status;
  const isInProgress =
    !!normalizedStage &&
    normalizedStage !== "completed" &&
    DELIVERY_STAGES_FULL.includes(
      normalizedStage as (typeof DELIVERY_STAGES_FULL)[number],
    );
  const isCompleted =
    statusVal === "delivered" ||
    statusVal === "completed" ||
    normalizedStage === "completed";

  const clientMainStepIdx = getClientMainStepIndex(normalizedStage);

  const PICKUP_STAGES = [
    "en_route_to_pickup",
    "arrived_at_pickup",
    "en_route",
    "on_route",
    "arrived",
    "arrived_on_site",
  ];
  const isPrePickup =
    PICKUP_STAGES.includes(normalizedStage || "") ||
    PICKUP_STAGES.includes(liveStage || "") ||
    !(normalizedStage ?? "").trim();
  const etaTarget = isPrePickup && pickup ? pickup : dropoff;
  const haversineEta =
    crewLoc && etaTarget && isInProgress
      ? Math.max(
          1,
          Math.round(
            (haversineKm(
              crewLoc.current_lat,
              crewLoc.current_lng,
              etaTarget.lat,
              etaTarget.lng,
            ) /
              30) *
              60,
          ),
        )
      : null;
  const displayEta =
    liveEtaMinutes != null && liveEtaMinutes > 0
      ? liveEtaMinutes
      : haversineEta;

  const scheduledDate = delivery.scheduled_date
    ? new Date(delivery.scheduled_date + "T00:00:00").toLocaleDateString(
        "en-US",
        {
          timeZone: "America/Toronto",
          weekday: "long",
          month: "long",
          day: "numeric",
        },
      )
    : null;

  const hasMapCoords = !!(pickup || dropoff) || !!crewLoc;
  const crewHasStarted = hasActiveTracking;
  const deliveryCrewAssigned = !!delivery.crew_id;
  const deliveryRevealCrewNames = shouldRevealCrewNamesOnMoveTrack({
    crewAssigned: deliveryCrewAssigned,
    scheduledDate: delivery.scheduled_date ?? null,
    isInProgress: isInProgress || crewHasStarted,
    isCompleted,
  });
  const displayDeliveryCrewName =
    deliveryRevealCrewNames && crewName ? crewName : null;
  const timeWindow = delivery.delivery_window || delivery.time_slot || null;
  const pickupAddr = delivery.pickup_address || delivery.from_address;
  const dropoffAddr = delivery.delivery_address || delivery.to_address;

  /* ── Fullscreen map overlay ── */
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FAF7F2]">
        {crewHasStarted && liveStage && (
          <div
            className="absolute top-4 left-4 z-20 rounded-none bg-white/95 backdrop-blur-sm border px-4 py-3 flex items-center gap-3 shadow-lg"
            style={{ borderColor: `${FOREST}22` }}
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
            </span>
            <div>
              <div className="text-[13px] font-bold" style={{ color: FOREST }}>
                {normalizedStage
                  ? CLIENT_STAGE_LABELS[normalizedStage] ||
                    CLIENT_MAIN_STEPS[clientMainStepIdx]
                  : toTitleCase(liveStage || "")}
              </div>
              <div className="text-[11px] opacity-70" style={{ color: FOREST }}>
                {displayEta != null ? (
                  `~${displayEta} min away`
                ) : displayDeliveryCrewName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <User
                      size={14}
                      weight="duotone"
                      className="shrink-0 opacity-90"
                      color={FOREST}
                      aria-hidden
                    />
                    {`Crew: ${displayDeliveryCrewName}`}
                  </span>
                ) : (
                  "Your crew is on the way"
                )}
              </div>
            </div>
          </div>
        )}
        {/* Minimize / close button, prominent pill */}
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 rounded-none bg-white/95 backdrop-blur-sm border shadow-lg transition-all active:scale-[0.99] hover:bg-white"
          style={{ borderColor: `${FOREST}22`, color: FOREST }}
        >
          <CornersIn size={16} className="text-current shrink-0" aria-hidden />
          <span className="text-[12px] font-bold">Minimize</span>
        </button>

        {hasMapCoords ? (
          <DeliveryTrackMap
            center={center}
            crew={crewLoc}
            pickup={pickup}
            dropoff={dropoff}
            liveStage={liveStage}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[13px] text-[#4F4B47]">
              No map data available
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans min-w-0 max-w-[100vw] overflow-x-hidden"
      style={{ backgroundColor: CREAM, color: FOREST }}
      data-theme="light"
    >
      {/* ── CONTENT ── */}
      <div className="flex-1 max-w-[520px] w-full mx-auto px-4 sm:px-5 py-5 md:py-6">
        {/* Logo */}
        <div className="mb-4 anim-slide-up">
          <Link href="/tracking">
            <YugoLogo size={18} variant="wine" />
          </Link>
        </div>

        {/* Header */}
        <div className="mb-5 anim-slide-up anim-delay-1">
          <p
            className={`${QUOTE_EYEBROW_CLASS} mb-1.5`}
            style={{ color: FOREST_MUTED }}
          >
            {b2bAudience === "recipient" && b2bCoBrand
              ? `${b2bCoBrand} · Yugo`
              : b2bAudience === "business"
                ? "Your delivery from Yugo"
                : "Delivery Tracking"}
          </p>
          <h1
            className={`${QUOTE_SECTION_H2_CLASS} font-semibold`}
            style={{ color: WINE }}
          >
            {b2bAudience === "recipient" && b2bCoBrand
              ? `Your ${b2bCoBrand} delivery`
              : delivery.customer_name || "Your Delivery"}
          </h1>
          {b2bItemSummary ? (
            <p
              className="text-[13px] mt-2 font-medium leading-relaxed"
              style={{ color: FOREST_BODY }}
            >
              Item: {b2bItemSummary}
            </p>
          ) : null}
          {b2bAudience ? (
            <p
              className="text-[12px] mt-3 font-semibold"
              style={{ color: FOREST }}
            >
              <span
                className={`${QUOTE_EYEBROW_CLASS} mr-2`}
                style={{ color: FOREST_MUTED }}
              >
                Status
              </span>
              {(() => {
                const st = (delivery.status || "")
                  .toLowerCase()
                  .replace(/-/g, "_");
                if (isCompleted || st === "delivered") return "Delivered";
                if (st === "confirmed" || st === "scheduled")
                  return "Confirmed";
                if (st === "pending" || st === "pending_approval")
                  return "Pending";
                if (isInProgress || st === "in_progress") {
                  if (
                    normalizedStage === "en_route_to_pickup" ||
                    normalizedStage === "arrived_at_pickup"
                  )
                    return "Dispatched";
                  return "In transit";
                }
                return "Confirmed";
              })()}
            </p>
          ) : null}
          {b2bAudience && b2bCrewSize != null && b2bCrewSize > 0 ? (
            <p className="text-[12px] mt-1" style={{ color: FOREST_MUTED }}>
              Crew: {b2bCrewSize} mover{b2bCrewSize !== 1 ? "s" : ""}
            </p>
          ) : null}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="font-mono text-[11px] px-2 py-0.5 rounded-none border"
              style={{
                color: FOREST_MUTED,
                borderColor: `${FOREST}18`,
                backgroundColor: `${FOREST}05`,
              }}
            >
              {delivery.delivery_number}
            </span>
            {isInProgress && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#22C55E]/12 text-[#22C55E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                LIVE
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#22C55E]/12 text-[#22C55E]">
                Complete
              </span>
            )}
          </div>
        </div>

        <div className={TRACK_SECTION_DIVIDE}>
          {/* ── Progress (completed steps show check; upcoming steps are empty nodes) ── */}
          {(isInProgress || isCompleted) && (
            <div className="py-5 anim-slide-up anim-delay-2">
              {/* Progress bar with stage nodes (no title row, stage labels are under each node; "Complete" badge is in header) */}
              {/* Each node is fixed 64 px wide so the absolute track can be anchored at left/right: 32 (= half node width) */}
              <div className="relative" style={{ paddingBottom: 30 }}>
                {/* Track */}
                <div
                  className="absolute rounded-full"
                  style={{
                    top: 12.5,
                    left: 32,
                    right: 32,
                    height: 5,
                    backgroundColor: `${FOREST}10`,
                    zIndex: 0,
                  }}
                />
                <div
                  className="absolute rounded-full transition-all duration-700 ease-out"
                  style={{
                    top: 12.5,
                    left: 32,
                    height: 5,
                    width: `calc(${isCompleted ? 1 : clientMainStepIdx / (CLIENT_MAIN_STEPS.length - 1)} * (100% - 64px))`,
                    background: `linear-gradient(90deg, ${WINE}, ${FOREST})`,
                    zIndex: 1,
                  }}
                />
                {/* Stage nodes */}
                <div
                  className="flex justify-between items-start"
                  style={{ position: "relative", zIndex: 2 }}
                >
                  {CLIENT_MAIN_STEPS.map((label, i) => {
                    const isPast = clientMainStepIdx > i || isCompleted;
                    const isCurrent = clientMainStepIdx === i && !isCompleted;
                    const doneAt = stepCompletedAt?.[i];
                    const doneTimeLabel = doneAt
                      ? formatStepCompletedTime(doneAt)
                      : "";
                    return (
                      <div
                        key={label}
                        className="flex flex-col items-center"
                        style={{ width: 64 }}
                      >
                        <div className="relative">
                          {isCurrent && (
                            <span
                              className="step-ping absolute inset-0 rounded-full"
                              style={{ backgroundColor: WINE, opacity: 0.25 }}
                            />
                          )}
                          <div
                            className={`flex items-center justify-center rounded-full transition-all duration-500 ${isPast ? "step-bounce-in" : ""}`}
                            style={{
                              width: 30,
                              height: 30,
                              backgroundColor: isPast
                                ? FOREST
                                : isCurrent
                                  ? WINE
                                  : CREAM,
                              border:
                                !isPast && !isCurrent
                                  ? `1.5px solid ${FOREST}22`
                                  : isCurrent
                                    ? `1.5px solid ${WINE}`
                                    : "none",
                              boxShadow: isCurrent
                                ? `0 0 0 3px ${WINE}22`
                                : undefined,
                            }}
                          >
                            {isPast ? (
                              <Check
                                weight="bold"
                                size={12}
                                color="#fff"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                        </div>
                        <div
                          className="mt-2 text-center leading-tight font-semibold"
                          style={{
                            fontSize: 9.5,
                            maxWidth: 76,
                            color: isCurrent
                              ? WINE
                              : isPast
                                ? FOREST
                                : FOREST_MUTED,
                          }}
                        >
                          {label}
                          {isPast && doneTimeLabel ? (
                            <div
                              className="font-normal tabular-nums mt-0.5"
                              style={{
                                fontSize: 8.5,
                                color: `${FOREST}52`,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {doneTimeLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Route (vertical timeline: P / dashed / D, forest) ── */}
          {pickupAddr || dropoffAddr ? (
            <div className="py-5 anim-slide-up anim-delay-3 flex flex-col gap-5 min-w-0">
              {pickupAddr ? (
                <div className="flex gap-3.5 min-w-0">
                  <div
                    className="w-7 flex justify-center shrink-0 pt-0.5"
                    aria-hidden
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold tracking-[0.04em] text-white"
                      style={{ backgroundColor: FOREST }}
                    >
                      P
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`${QUOTE_EYEBROW_CLASS} mb-0.5`}
                      style={{ color: FOREST }}
                    >
                      Pickup
                    </div>
                    <div
                      className="text-[13px] font-bold leading-snug"
                      style={{ color: FOREST }}
                    >
                      {addressWithoutPostalSuffix(
                        formatAddressForDisplay(pickupAddr),
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              {pickupAddr && dropoffAddr ? (
                <div className="flex gap-3.5 min-w-0 -my-1" aria-hidden>
                  <div className="w-7 flex justify-center shrink-0">
                    <div
                      className="w-0 border-l-2 border-dashed min-h-[28px]"
                      style={{ borderColor: FOREST }}
                    />
                  </div>
                  <div className="flex-1 min-w-0" />
                </div>
              ) : null}
              {dropoffAddr ? (
                <div className="flex gap-3.5 min-w-0">
                  <div
                    className="w-7 flex justify-center shrink-0 pt-0.5"
                    aria-hidden
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold tracking-[0.04em] text-white"
                      style={{ backgroundColor: FOREST }}
                    >
                      D
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`${QUOTE_EYEBROW_CLASS} mb-0.5`}
                      style={{ color: FOREST }}
                    >
                      Delivery
                    </div>
                    <div
                      className="text-[13px] font-bold leading-snug"
                      style={{ color: FOREST }}
                    >
                      {addressWithoutPostalSuffix(
                        formatAddressForDisplay(dropoffAddr),
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ── Schedule & status (receipt-style panel, quote-aligned) ── */}
          <div className="py-5 anim-slide-up anim-delay-3">
            <div className={QUOTE_PANEL_RECEIPT}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="min-w-0">
                  <span
                    className={QUOTE_EYEBROW_CLASS}
                    style={{ color: FOREST_MUTED }}
                  >
                    Date
                  </span>
                  <p
                    className="text-[13px] font-semibold mt-1 leading-snug"
                    style={{ color: FOREST }}
                  >
                    {scheduledDate || delivery.scheduled_date || "TBD"}
                  </p>
                </div>
                <div className="min-w-0">
                  <span
                    className={QUOTE_EYEBROW_CLASS}
                    style={{ color: FOREST_MUTED }}
                  >
                    Window
                  </span>
                  <p
                    className="text-[13px] font-semibold mt-1 leading-snug"
                    style={{ color: FOREST }}
                  >
                    {timeWindow || "Flexible"}
                  </p>
                </div>
                <div className="min-w-0">
                  <span
                    className={QUOTE_EYEBROW_CLASS}
                    style={{ color: FOREST_MUTED }}
                  >
                    Items
                  </span>
                  <p
                    className="text-[13px] font-semibold mt-1 leading-snug"
                    style={{ color: FOREST }}
                  >
                    {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="min-w-0">
                  <span
                    className={QUOTE_EYEBROW_CLASS}
                    style={{ color: FOREST_MUTED }}
                  >
                    {displayEta != null ? "ETA" : "Status"}
                  </span>
                  <p
                    className="text-[13px] font-semibold mt-1 leading-snug"
                    style={{ color: displayEta != null ? WINE : FOREST }}
                  >
                    {displayEta != null
                      ? `~${displayEta} min`
                      : isCompleted
                        ? "Complete"
                        : isInProgress
                          ? CLIENT_STAGE_LABELS[normalizedStage || ""] ||
                            CLIENT_MAIN_STEPS[clientMainStepIdx] ||
                            "In Progress"
                          : "Scheduled"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Crew ── */}
          <div className="py-5 anim-slide-up anim-delay-4">
            <div className="flex items-center gap-3.5">
              <div className="flex-1 min-w-0">
                {displayDeliveryCrewName ? (
                  <div className="flex items-start gap-2.5 min-w-0">
                    <User
                      size={20}
                      weight="duotone"
                      className="shrink-0 mt-0.5"
                      color={FOREST}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div
                        className="text-[14px] font-semibold"
                        style={{ color: FOREST }}
                      >
                        {displayDeliveryCrewName}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: FOREST_MUTED }}
                      >
                        Your delivery crew
                      </div>
                    </div>
                  </div>
                ) : deliveryCrewAssigned ? (
                  <>
                    <div
                      className="text-[14px] font-semibold"
                      style={{ color: FOREST }}
                    >
                      Crew assigned
                    </div>
                    <div
                      className="text-[11px] leading-snug"
                      style={{ color: FOREST_MUTED }}
                    >
                      Names are shared within three days of your delivery.
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className="text-[14px] font-semibold"
                      style={{ color: FOREST }}
                    >
                      Crew not assigned yet
                    </div>
                    <div
                      className="text-[11px] leading-snug"
                      style={{ color: FOREST_MUTED }}
                    >
                      Your coordinator will confirm your team here.
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(crewPhone || dispatchPhone) && (
                  <a
                    href={`tel:${(crewPhone || dispatchPhone || "").replace(/[^\d+]/g, "")}`}
                    className="shrink-0 inline-flex items-center gap-1.5 py-2 px-3 rounded-none border text-[11px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-80"
                    style={{ borderColor: FOREST, color: FOREST }}
                  >
                    <Phone
                      size={12}
                      className="text-current shrink-0"
                      aria-hidden
                    />
                    {crewPhone ? "Call" : "Dispatch"}
                  </a>
                )}
                {crewHasStarted ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#22C55E]/10 text-[#22C55E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    LIVE
                  </span>
                ) : deliveryCrewAssigned ? (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${FOREST}08`,
                      color: `${FOREST}70`,
                    }}
                  >
                    Assigned
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Item List ── */}
          {itemsCount > 0 &&
            (() => {
              const grouped: Record<string, Map<string, number>> = {};
              const rawList = Array.isArray(delivery.items)
                ? delivery.items
                : [];
              rawList.forEach((raw: unknown) => {
                const { room, name, qty } = normalizeDeliveryItem(raw);
                const trimmed = name.trim();
                if (!trimmed) return;
                const r = room.trim() || "Items";
                if (!grouped[r]) grouped[r] = new Map();
                const m = grouped[r];
                const prev = m.get(trimmed) ?? 0;
                m.set(trimmed, prev + Math.max(1, qty));
              });
              const rooms = Object.keys(grouped).sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: "base" }),
              );
              const GENERIC_ROOM = "Items";

              return (
                <div className="py-5 anim-slide-up anim-delay-4">
                  <div className="mb-4">
                    <span
                      className={QUOTE_EYEBROW_CLASS}
                      style={{ color: FOREST_MUTED }}
                    >
                      Items
                    </span>
                  </div>
                  <div className="divide-y divide-[#2C3E2D]/12">
                    {rooms.map((room) => (
                      <div key={room} className="py-3.5 first:pt-0 last:pb-0">
                        {room !== GENERIC_ROOM ? (
                          <div
                            className={`${QUOTE_EYEBROW_CLASS} mb-2`}
                            style={{ color: WINE }}
                          >
                            {room}
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          {Array.from(grouped[room].entries())
                            .sort(([a], [b]) =>
                              a.localeCompare(b, undefined, {
                                sensitivity: "base",
                              }),
                            )
                            .map(([itemName, totalQty]) => {
                              const label = `${itemName} ×${totalQty}`;
                              return (
                                <div
                                  key={itemName}
                                  className="flex items-center gap-3"
                                >
                                  <div
                                    className="w-1 h-1 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: `${FOREST}25`,
                                    }}
                                  />
                                  <span
                                    className="text-[13px] font-medium"
                                    style={{ color: FOREST }}
                                  >
                                    {label}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          {b2bAudience ? (
            <div className="py-5 anim-slide-up anim-delay-3">
              <div
                className={`${QUOTE_EYEBROW_CLASS} mb-3`}
                style={{ color: FOREST_MUTED }}
              >
                Service includes
              </div>
              <ul className="space-y-2 text-[13px]" style={{ color: FOREST }}>
                {[
                  "Professional delivery crew",
                  "Protective wrapping",
                  "Move inside and placement",
                  "Floor protection",
                  ...(b2bAssembly ? ["Assembly"] : []),
                  ...(b2bDebrisRemoval ? ["Debris removal"] : []),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span
                      className="w-1 h-1 rounded-full shrink-0 mt-2"
                      style={{ backgroundColor: `${FOREST}28` }}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p
                className="text-[12px] mt-4 font-semibold"
                style={{ color: FOREST }}
              >
                Questions?{" "}
                <a
                  href="tel:+16473704525"
                  className="underline underline-offset-2"
                  style={{ color: WINE }}
                >
                  (647) 370-4525
                </a>
              </p>
            </div>
          ) : null}

          {/* ── Live map (single framed module; section rule from parent divide) ── */}
          {!isCompleted && (
            <div className="py-5 anim-slide-up anim-delay-4">
              <div
                className={`overflow-hidden border border-[#2C3E2D]/16 transition-colors duration-300 ${crewHasStarted ? "border-[#22C55E]/35" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setMapExpanded((v) => !v)}
                  className="w-full text-left transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
                >
                  {/* Mini map preview strip when collapsed */}
                  {!mapExpanded && (
                    <div className="relative h-[56px] bg-[#E8E4DF] overflow-hidden">
                      <div
                        className="absolute inset-0"
                        style={{
                          filter: "blur(2px) saturate(0.92)",
                        }}
                      >
                        {hasMapCoords && (
                          <DeliveryTrackMap
                            center={center}
                            crew={crewLoc}
                            pickup={pickup}
                            dropoff={dropoff}
                            liveStage={liveStage}
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                        {crewHasStarted ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-[#22C55E]/35 text-[11px] font-bold bg-white/95 backdrop-blur-sm shadow-lg"
                            style={{ color: "#22C55E" }}
                          >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
                            </span>
                            Tap to view live map
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-white/30 text-[11px] font-semibold bg-white/90 backdrop-blur-sm shadow-lg"
                            style={{ color: FOREST }}
                          >
                            Tap to preview route
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-center justify-between px-3 sm:px-4 py-3.5 bg-white/40 ${!mapExpanded ? "border-t border-[#2C3E2D]/10" : ""}`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div
                        className="text-[14px] font-semibold flex items-center gap-2"
                        style={{ color: FOREST }}
                      >
                        Live Tracking
                        {crewHasStarted && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none border border-[#22C55E]/25 text-[9px] font-bold bg-[#22C55E]/10 text-[#22C55E]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[12px] leading-snug"
                        style={{ color: FOREST_MUTED }}
                      >
                        {crewHasStarted ? (
                          displayEta != null ? (
                            `~${displayEta} min away`
                          ) : displayDeliveryCrewName ? (
                            <span className="inline-flex items-center gap-1.5">
                              <User
                                size={14}
                                weight="duotone"
                                className="shrink-0"
                                color={FOREST_MUTED}
                                aria-hidden
                              />
                              {`${displayDeliveryCrewName} is en route`}
                            </span>
                          ) : (
                            "Crew is on the way"
                          )
                        ) : scheduledDate ? (
                          scheduledDate
                        ) : (
                          "Activates when your crew begins"
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!mapExpanded && (
                        <span
                          className={`${QUOTE_EYEBROW_CLASS} hidden sm:inline`}
                          style={{ color: FOREST_MUTED }}
                        >
                          {crewHasStarted ? "View" : "Preview"}
                        </span>
                      )}
                      <div
                        className="w-7 h-7 rounded-none border flex items-center justify-center transition-all duration-300"
                        style={{
                          borderColor: mapExpanded
                            ? `${FOREST}25`
                            : `${FOREST}18`,
                          backgroundColor: mapExpanded
                            ? `${FOREST}08`
                            : `${FOREST}05`,
                        }}
                      >
                        <CaretDown
                          size={14}
                          color={FOREST}
                          className="transition-transform duration-300"
                          style={{
                            transform: mapExpanded
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            opacity: mapExpanded ? 0.5 : 0.8,
                          }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Collapsible map body */}
                <div
                  className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
                  style={{
                    maxHeight: mapExpanded ? 340 : 0,
                    opacity: mapExpanded ? 1 : 0,
                  }}
                >
                  <div className="relative h-[300px] bg-[#EDE9E4]">
                    {/* Map layer, blurred when crew hasn't started */}
                    <div
                      className="absolute inset-0 transition-[filter] duration-700"
                      style={{
                        filter: crewHasStarted
                          ? "none"
                          : "blur(5px) saturate(0.88)",
                      }}
                    >
                      {hasMapCoords ? (
                        <DeliveryTrackMap
                          center={center}
                          crew={crewLoc}
                          pickup={pickup}
                          dropoff={dropoff}
                          liveStage={liveStage}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[13px] font-semibold text-[#4F4B47]">
                            Map loading…
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Waiting overlay when crew hasn't started, z-[1000] above Leaflet */}
                    {!crewHasStarted && (
                      <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-white/75 backdrop-blur-sm px-4 text-center">
                        <span className="text-[13px] font-semibold text-[#1A1816] tracking-tight">
                          Waiting for crew
                        </span>
                        <span className="text-[11px] text-[#4F4B47] mt-0.5">
                          {timeWindow
                            ? `Window: ${timeWindow}`
                            : "Map goes live when crew starts the job"}
                        </span>
                      </div>
                    )}

                    {/* Live status badge inside map when active, z-[1000] so it sits above Leaflet map panes */}
                    {crewHasStarted && liveStage && (
                      <div
                        className="absolute top-3 left-3 z-[1000] rounded-none bg-white/95 backdrop-blur-sm border px-3 py-2 flex items-center gap-2 shadow-lg"
                        style={{ borderColor: `${FOREST}22` }}
                      >
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
                        </span>
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: FOREST }}
                        >
                          {normalizedStage
                            ? CLIENT_STAGE_LABELS[normalizedStage]
                            : toTitleCase(liveStage || "")}
                        </span>
                      </div>
                    )}

                    {/* Fullscreen button, z-[1000] so it sits above Leaflet map panes */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFullscreen(true);
                      }}
                      className="absolute bottom-3 right-3 z-[1000] inline-flex items-center gap-1.5 px-3 py-2 rounded-none bg-white/95 backdrop-blur-sm border shadow-lg transition-opacity hover:opacity-90 active:scale-[0.99]"
                      style={{ borderColor: `${FOREST}22`, color: FOREST }}
                    >
                      <CornersOut
                        size={13}
                        className="text-current shrink-0"
                        aria-hidden
                      />
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em]">
                        Expand
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isCompleted && b2bPodImageUrl ? (
            <div className="py-5 anim-slide-up anim-delay-5 space-y-3">
              <div
                className={QUOTE_EYEBROW_CLASS}
                style={{ color: FOREST_MUTED }}
              >
                Delivery photo
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b2bPodImageUrl}
                alt="Proof of delivery"
                className="w-full max-h-[280px] object-cover border border-[#2C3E2D]/16"
              />
            </div>
          ) : null}

          {/* Post-delivery rating */}
          {isCompleted && (
            <div className="py-5 anim-slide-up anim-delay-5">
              <PostDeliveryRating
                deliveryId={delivery.id}
                token={token}
                googleReviewUrl={googleReviewUrl}
              />
            </div>
          )}

          {/* Track another */}
          <div className="py-5 text-center anim-slide-up anim-delay-5">
            <Link
              href="/tracking"
              className="inline-flex items-center justify-center gap-2 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70 mx-auto"
              style={{ color: FOREST }}
            >
              Track another delivery
              <CaretRight size={14} className="shrink-0" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Sticky Footer ── */}
      <footer className="shrink-0 py-3.5 text-center border-t border-[#2C3E2D]/10">
        <YugoMarketingFooter
          contactEmail={companyContactEmail}
          logoVariant="wine"
          onLightBackground
          logoSize={14}
          mutedColor={FOREST_MUTED}
          linkColor={FOREST}
        />
      </footer>
    </div>
  );
}
