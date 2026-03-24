"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import YugoLogo from "@/components/YugoLogo";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { toTitleCase } from "@/lib/format-text";
import {
  CalendarBlank,
  CaretDown,
  Check,
  Clock,
  CornersIn,
  CornersOut,
  GoogleLogo,
  Lightning,
  MagnifyingGlass,
  MapPin,
  House as HomeDelivery,
  Phone,
  Star,
  Sun,
  Truck,
  User,
} from "@phosphor-icons/react";

const DeliveryTrackMap = dynamic(() => import("./DeliveryTrackMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[240px] flex items-center justify-center bg-[#1A1A1A] text-[#555] text-[12px]">
      Loading map…
    </div>
  ),
});

/** Full 5 stages (two-leg delivery). Used for progress %, ETA logic, and admin/partner. */
const DELIVERY_STAGES_FULL = ["en_route_to_pickup", "arrived_at_pickup", "en_route_to_destination", "arrived_at_destination", "completed"] as const;

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
const CLIENT_MAIN_STEPS = ["En route to pick up", "On the way to you", "Delivering", "Complete"] as const;

function DeliveryProgressStepIcon({ label, isCurrent }: { label: string; isCurrent: boolean }) {
  const dim = `${FOREST}59`;
  const c = isCurrent ? CREAM : dim;
  const size = 12;
  if (label === "En route to pick up") return <MapPin size={size} color={c} aria-hidden />;
  if (label === "On the way to you") return <Truck size={size} color={c} aria-hidden />;
  if (label === "Delivering") return <HomeDelivery size={size} color={c} aria-hidden />;
  if (label === "Complete") return <Check size={size} color={c} aria-hidden />;
  return null;
}

/** Map normalized stage to main step index (0–3) for 4-step progress */
function getClientMainStepIndex(normalized: string | null): number {
  if (!normalized) return 0;
  if (normalized === "en_route_to_pickup" || normalized === "arrived_at_pickup") return 0;
  if (normalized === "en_route_to_destination") return 1;
  if (normalized === "arrived_at_destination") return 2;
  if (normalized === "completed") return 3;
  return 0;
}

type Coord = { lat: number; lng: number };
type CrewPos = { current_lat: number; current_lng: number; name?: string } | null;
type StepCompletedAtTuple = [string | null, string | null, string | null, string | null];

const TRACK_TZ = "America/Toronto";

function formatStepCompletedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { timeZone: TRACK_TZ, hour: "numeric", minute: "2-digit" });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STYLE_ID = "track-delivery-animations";
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

function PostDeliveryRating({ deliveryId, token, googleReviewUrl }: { deliveryId: string; token: string; googleReviewUrl?: string | null }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/track/delivery/${deliveryId}/rating?token=${encodeURIComponent(token)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.satisfaction_rating) {
          setExistingRating(d.satisfaction_rating);
          setRating(d.satisfaction_rating);
          setSubmitted(true);
        }
      })
      .catch((err) => { console.error("Failed to load existing delivery rating:", err); });
  }, [deliveryId, token]);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/track/delivery/${deliveryId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, comment: comment.trim() || null }),
      });
      if (res.ok) setSubmitted(true);
    } catch (err) { console.error("Failed to submit delivery rating:", err); }
    setSubmitting(false);
  };

  if (submitted) {
    const finalRating = rating || existingRating || 0;
    return (
      <div className="text-center py-4">
        <div className="flex justify-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={22} color={GOLD} weight={n <= finalRating ? "fill" : "regular"} aria-hidden />
          ))}
        </div>
        <p className="text-[13px] font-semibold" style={{ color: FOREST }}>Thank you for your feedback!</p>
        {finalRating >= 5 && googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-[12px] font-semibold border transition-all hover:opacity-80"
            style={{ borderColor: `${GOLD}40`, color: GOLD, backgroundColor: `${GOLD}08` }}
          >
            <GoogleLogo size={14} className="shrink-0" aria-hidden />
            Leave a Google Review
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[15px] font-bold" style={{ color: FOREST }}>Rate Your Delivery</h3>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="transition-transform hover:scale-110">
            <Star
              size={32}
              color={GOLD}
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
        className="w-full p-3 rounded-xl border text-[13px] outline-none resize-none"
        style={{ borderColor: `${FOREST}20`, color: FOREST }}
        rows={2}
      />
      <button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className="w-full py-3 rounded-full font-semibold text-[var(--text-base)] text-white disabled:opacity-40 transition-all hover:opacity-90"
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
}: {
  delivery: any;
  token: string;
  initialPickup?: { lat: number; lng: number } | null;
  initialDropoff?: { lat: number; lng: number } | null;
  googleReviewUrl?: string | null;
}) {
  const [liveStage, setLiveStage] = useState<string | null>(delivery.stage || null);
  const [crewLoc, setCrewLoc] = useState<CrewPos>(null);
  const [crewName, setCrewName] = useState<string | null>(null);
  const [crewPhone, setCrewPhone] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);
  const defaultCenter = initialDropoff || initialPickup || { lat: 43.665, lng: -79.385 };
  const [center, setCenter] = useState<Coord>(defaultCenter);
  const [pickup, setPickup] = useState<Coord | null>(initialPickup || null);
  const [dropoff, setDropoff] = useState<Coord | null>(initialDropoff || null);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [liveEtaMinutes, setLiveEtaMinutes] = useState<number | null>(delivery.eta_current_minutes ?? null);
  const [stepCompletedAt, setStepCompletedAt] = useState<StepCompletedAtTuple | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const prevTrackingRef = useRef(false);

  useEffect(() => { injectStyles(); }, []);

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
          `/api/track/delivery/${delivery.id}/crew-status?token=${encodeURIComponent(token)}`
        );
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data.liveStage != null) setLiveStage(data.liveStage);
        if (data.crew) setCrewLoc(data.crew);
        else setCrewLoc(null);
        if (data.crewName) setCrewName(data.crewName);
        if (data.crewPhone) setCrewPhone(data.crewPhone);
        if (data.dispatchPhone) setDispatchPhone(data.dispatchPhone);
        if (data.center?.lat != null) setCenter(data.center);
        if (data.pickup) setPickup(data.pickup);
        if (data.dropoff) setDropoff(data.dropoff);
        setHasActiveTracking(!!data.hasActiveTracking);
        if (data.eta_current_minutes != null) setLiveEtaMinutes(data.eta_current_minutes);
        else setLiveEtaMinutes(null);
        if (Array.isArray(data.stepCompletedAt) && data.stepCompletedAt.length === 4) {
          setStepCompletedAt(data.stepCompletedAt as StepCompletedAtTuple);
        }
      } catch (err) { console.error("Failed to poll delivery crew status:", err); }
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [delivery.id, token]);

  const itemsCount = Array.isArray(delivery.items) ? delivery.items.length : 0;
  const normalizedStage = normalizeDeliveryStage(liveStage);
  const statusVal = normalizedStage === "completed" ? "delivered" : delivery.status;
  const isInProgress = !!normalizedStage && normalizedStage !== "completed" && DELIVERY_STAGES_FULL.includes(normalizedStage as (typeof DELIVERY_STAGES_FULL)[number]);
  const isCompleted = statusVal === "delivered" || statusVal === "completed" || normalizedStage === "completed";

  const clientMainStepIdx = getClientMainStepIndex(normalizedStage);

  const PICKUP_STAGES = ["en_route_to_pickup", "arrived_at_pickup", "en_route", "on_route", "arrived", "arrived_on_site"];
  const isPrePickup = PICKUP_STAGES.includes(normalizedStage || "") || PICKUP_STAGES.includes(liveStage || "") || !(normalizedStage ?? "").trim();
  const etaTarget = isPrePickup && pickup ? pickup : dropoff;
  const haversineEta =
    crewLoc && etaTarget && isInProgress
      ? Math.max(1, Math.round((haversineKm(crewLoc.current_lat, crewLoc.current_lng, etaTarget.lat, etaTarget.lng) / 30) * 60))
      : null;
  const displayEta = (liveEtaMinutes != null && liveEtaMinutes > 0) ? liveEtaMinutes : haversineEta;

  const scheduledDate = delivery.scheduled_date
    ? new Date(delivery.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { timeZone: "America/Toronto", weekday: "long", month: "long", day: "numeric" })
    : null;

  const hasMapCoords = !!(pickup || dropoff) || !!crewLoc;
  const crewHasStarted = hasActiveTracking;
  const timeWindow = delivery.delivery_window || delivery.time_slot || null;
  const pickupAddr = delivery.pickup_address || delivery.from_address;
  const dropoffAddr = delivery.delivery_address || delivery.to_address;

  /* ── Fullscreen map overlay ── */
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1A1A1A]">
        {crewHasStarted && liveStage && (
          <div className="absolute top-4 left-4 z-20 rounded-2xl bg-white/95 backdrop-blur-sm border px-4 py-3 flex items-center gap-3 shadow-2xl" style={{ borderColor: `${FOREST}20` }}>
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
            </span>
            <div>
              <div className="text-[13px] font-bold" style={{ color: FOREST }}>
                {normalizedStage ? CLIENT_STAGE_LABELS[normalizedStage] || CLIENT_MAIN_STEPS[clientMainStepIdx] : toTitleCase(liveStage || "")}
              </div>
              <div className="text-[11px] opacity-70" style={{ color: FOREST }}>
                {displayEta != null ? `~${displayEta} min away` : crewName ? `Crew: ${crewName}` : "Your crew is on the way"}
              </div>
            </div>
          </div>
        )}
        {/* Minimize / close button, prominent pill */}
        <button
          type="button"
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-sm border shadow-2xl transition-all active:scale-95 hover:bg-white"
          style={{ borderColor: `${FOREST}15`, color: FOREST }}
        >
          <CornersIn size={16} className="text-current shrink-0" aria-hidden />
          <span className="text-[12px] font-bold">Minimize</span>
        </button>

        {hasMapCoords ? (
          <DeliveryTrackMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[13px] text-white/60">No map data available</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: CREAM, color: FOREST }} data-theme="light">

      {/* ── CONTENT ── */}
      <div className="flex-1 max-w-[600px] w-full mx-auto px-5 sm:px-6 py-6 md:py-8">

        {/* Logo */}
        <div className="mb-5 anim-slide-up">
          <Link href="/tracking">
            <YugoLogo size={16} variant="gold" />
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 anim-slide-up anim-delay-1">
          <div className="text-[9px] font-bold tracking-[0.18em] uppercase mb-1.5" style={{ color: WINE }}>Delivery Tracking</div>
          <h1 className="font-hero text-[28px] md:text-[32px] leading-tight font-semibold" style={{ color: FOREST }}>
            {delivery.customer_name || "Your Delivery"}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md" style={{ color: `${FOREST}80`, backgroundColor: `${FOREST}08` }}>
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
                <Check weight="bold" size={10} className="text-current shrink-0" aria-hidden />
                Complete
              </span>
            )}
          </div>
        </div>

        {/* ── Gold progress bar with stage icons ── */}
        {(isInProgress || isCompleted) && (
          <div className="mb-7 anim-slide-up anim-delay-2">
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
                  width: `calc(${(isCompleted ? 1 : clientMainStepIdx / (CLIENT_MAIN_STEPS.length - 1))} * (100% - 64px))`,
                  background: `linear-gradient(90deg, ${GOLD}, ${GOLD}CC)`,
                  zIndex: 1,
                }}
              />
              {/* Stage nodes */}
              <div className="flex justify-between items-start" style={{ position: "relative", zIndex: 2 }}>
                {CLIENT_MAIN_STEPS.map((label, i) => {
                  const isPast = clientMainStepIdx > i || isCompleted;
                  const isCurrent = clientMainStepIdx === i && !isCompleted;
                  const doneAt = stepCompletedAt?.[i];
                  const doneTimeLabel = doneAt ? formatStepCompletedTime(doneAt) : "";
                  return (
                    <div key={label} className="flex flex-col items-center" style={{ width: 64 }}>
                      <div className="relative">
                        {isCurrent && (
                          <span
                            className="step-ping absolute inset-0 rounded-full"
                            style={{ backgroundColor: GOLD, opacity: 0.3 }}
                          />
                        )}
                        <div
                          className={`flex items-center justify-center rounded-full transition-all duration-500 ${isPast ? "step-bounce-in" : ""}`}
                          style={{
                            width: 30,
                            height: 30,
                            backgroundColor: isPast || isCurrent ? GOLD : CREAM,
                            border: !isPast && !isCurrent ? `1.5px solid ${FOREST}18` : "none",
                            boxShadow: isCurrent ? `0 0 0 4px ${GOLD}25` : undefined,
                          }}
                        >
                          {isPast ? (
                            <Check weight="bold" size={12} color="#fff" aria-hidden />
                          ) : (
                            <DeliveryProgressStepIcon label={label} isCurrent={isCurrent} />
                          )}
                        </div>
                      </div>
                      <div
                        className="mt-2 text-center leading-tight font-semibold"
                        style={{
                          fontSize: 9.5,
                          maxWidth: 76,
                          color: isCurrent ? GOLD : isPast ? FOREST : `${FOREST}35`,
                        }}
                      >
                        {label}
                        {isPast && doneTimeLabel ? (
                          <div
                            className="font-normal tabular-nums mt-0.5"
                            style={{ fontSize: 8.5, color: `${FOREST}52`, letterSpacing: "0.02em" }}
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

        {/* ── Route: From → To (no card) ── */}
        <div className="mb-5 anim-slide-up anim-delay-3">
          {pickupAddr && (
            <div className="flex items-start gap-3.5 px-5 py-4">
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}12` }}>
                  <Sun size={14} color={GOLD} aria-hidden />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-0.5" style={{ color: `${FOREST}50` }}>Pickup from</div>
                <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{pickupAddr}</div>
              </div>
            </div>
          )}
          {pickupAddr && dropoffAddr && (
            <div className="flex items-center px-5">
              <div className="w-8 flex justify-center shrink-0">
                <div className="flex flex-col items-center gap-[3px]">
                  {[0, 1, 2].map((d) => (
                    <div key={d} className="w-[3px] h-[3px] rounded-full route-dot-pulse" style={{ backgroundColor: `${FOREST}25`, animationDelay: `${d * 0.3}s` }} />
                  ))}
                </div>
              </div>
              <div className="flex-1 h-px ml-3.5" style={{ backgroundColor: `${FOREST}08` }} />
            </div>
          )}
          {dropoffAddr && (
            <div className="flex items-start gap-3.5 px-5 py-4">
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#22C55E12" }}>
                  <MapPin size={14} color="#22C55E" aria-hidden />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-0.5" style={{ color: `${FOREST}50` }}>Deliver to</div>
                <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{dropoffAddr}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Info Grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-5 anim-slide-up anim-delay-3">
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarBlank size={13} color={GOLD} aria-hidden />
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>Date</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
              {scheduledDate || delivery.scheduled_date || "TBD"}
            </div>
          </div>
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Clock size={13} color={GOLD} aria-hidden />
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>Window</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
              {timeWindow || "Flexible"}
            </div>
          </div>
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Truck size={13} color={GOLD} aria-hidden />
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>Items</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
              {itemsCount} item{itemsCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Lightning size={13} color={GOLD} aria-hidden />
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>
                {displayEta != null ? "ETA" : "Status"}
              </span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: displayEta != null ? GOLD : FOREST }}>
              {displayEta != null ? `~${displayEta} min` : isCompleted ? "Complete" : isInProgress ? (CLIENT_STAGE_LABELS[normalizedStage || ""] || CLIENT_MAIN_STEPS[clientMainStepIdx] || "In Progress") : "Scheduled"}
            </div>
          </div>
        </div>

        {/* ── Crew (no card) ── */}
        {crewName && (
          <div className="mb-5 anim-slide-up anim-delay-4">
            <div className="flex items-center gap-3.5 px-0 py-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}12` }}>
                <User size={18} color={GOLD} aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[var(--text-base)] font-semibold" style={{ color: FOREST }}>{crewName}</div>
                <div className="text-[11px]" style={{ color: `${FOREST}70` }}>Your delivery crew</div>
              </div>
              <div className="flex items-center gap-2">
                {(crewPhone || dispatchPhone) && (
                  <a
                    href={`tel:${(crewPhone || dispatchPhone || "").replace(/[^\d+]/g, "")}`}
                    className="shrink-0 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border text-[10px] font-semibold transition-colors"
                    style={{ borderColor: `${GOLD}40`, color: FOREST }}
                  >
                    <Phone size={12} className="text-current shrink-0" aria-hidden />
                    {crewPhone ? "Call" : "Dispatch"}
                  </a>
                )}
                {crewHasStarted ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#22C55E]/10 text-[#22C55E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: `${FOREST}08`, color: `${FOREST}70` }}>
                    Assigned
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Item List ── */}
        {itemsCount > 0 && (() => {
          const grouped: Record<string, string[]> = {};
          (delivery.items as string[]).forEach((raw: string) => {
            const colonIdx = raw.indexOf(":");
            const room = colonIdx > -1 ? raw.slice(0, colonIdx).trim() : "Items";
            const name = colonIdx > -1 ? raw.slice(colonIdx + 1).trim() : raw.trim();
            if (!grouped[room]) grouped[room] = [];
            grouped[room].push(name);
          });
          const rooms = Object.keys(grouped);

          return (
            <div className="rounded-2xl border overflow-hidden mb-5 anim-slide-up anim-delay-4" style={{ borderColor: `${FOREST}08`, backgroundColor: "white" }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: `${FOREST}06` }}>
                <div className="text-[9px] font-bold tracking-[0.16em] uppercase" style={{ color: `${FOREST}40` }}>Items</div>
                <div
                  className="text-[9px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${FOREST}06`, color: `${FOREST}50` }}
                >
                  {itemsCount}
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: `${FOREST}05` }}>
                {rooms.map((room) => (
                  <div key={room} className="px-5 py-3.5">
                    <div
                      className="text-[9px] font-bold tracking-[0.12em] uppercase mb-2.5"
                      style={{ color: GOLD }}
                    >
                      {room}
                    </div>
                    <div className="space-y-2">
                      {grouped[room].map((name, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div
                            className="w-1 h-1 rounded-full shrink-0"
                            style={{ backgroundColor: `${FOREST}25` }}
                          />
                          <span className="text-[13px] font-medium" style={{ color: FOREST }}>
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Live Tracking Card (collapsible with embedded map) ── */}
        {!isCompleted && (
          <div
            className="rounded-2xl border overflow-hidden mb-5 anim-slide-up anim-delay-4 transition-colors duration-300"
            style={{ borderColor: crewHasStarted ? `#22C55E30` : `${GOLD}20`, backgroundColor: "white" }}
          >
            {/* Card header, toggle collapse */}
            <button
              type="button"
              onClick={() => setMapExpanded((v) => !v)}
              className="w-full text-left transition-colors hover:bg-black/[0.015] active:bg-black/[0.03]"
            >
              {/* Mini map preview strip when collapsed */}
              {!mapExpanded && (
                <div className="relative h-[56px] bg-[#1E1E1E] overflow-hidden">
                  <div className="absolute inset-0" style={{ filter: "blur(2px) brightness(0.6) saturate(0.4)" }}>
                    {hasMapCoords && (
                      <DeliveryTrackMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-2 z-10">
                    {crewHasStarted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/95 backdrop-blur-sm shadow-lg" style={{ color: "#22C55E" }}>
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" /></span>
                        Tap to view live map
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm shadow-lg" style={{ color: `${FOREST}90` }}>
                        <MapPin size={12} color={GOLD} aria-hidden />
                        Tap to preview route
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                    style={{ backgroundColor: crewHasStarted ? "#22C55E12" : `${GOLD}12` }}
                  >
                    {crewHasStarted ? (
                      <MapPin size={18} color="#22C55E" aria-hidden />
                    ) : (
                      <Clock size={18} color={GOLD} aria-hidden />
                    )}
                  </div>
                  <div>
                    <div className="text-[var(--text-base)] font-semibold flex items-center gap-2" style={{ color: FOREST }}>
                      Live Tracking
                      {crewHasStarted && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#22C55E]/12 text-[#22C55E]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[12px]" style={{ color: `${FOREST}60` }}>
                      {crewHasStarted
                        ? displayEta != null
                          ? `~${displayEta} min away`
                          : crewName
                            ? `${crewName} is en route`
                            : "Crew is on the way"
                        : scheduledDate
                          ? scheduledDate
                          : "Activates when your crew begins"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!mapExpanded && (
                    <span className="text-[10px] font-semibold hidden sm:inline" style={{ color: `${FOREST}35` }}>
                      {crewHasStarted ? "View" : "Preview"}
                    </span>
                  )}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300"
                    style={{ backgroundColor: mapExpanded ? `${FOREST}08` : `${GOLD}12` }}
                  >
                    <CaretDown
                      size={14}
                      color={mapExpanded ? FOREST : GOLD}
                      className="transition-transform duration-300"
                      style={{ transform: mapExpanded ? "rotate(180deg)" : "rotate(0deg)", opacity: mapExpanded ? 0.5 : 0.8 }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            </button>

            {/* Collapsible map body */}
            <div
              className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
              style={{ maxHeight: mapExpanded ? 340 : 0, opacity: mapExpanded ? 1 : 0 }}
            >
              <div className="relative h-[300px] bg-[#1A1A1A]">
                {/* Map layer, blurred when crew hasn't started */}
                <div
                  className="absolute inset-0 transition-[filter] duration-700"
                  style={{ filter: crewHasStarted ? "none" : "blur(6px) saturate(0.5) brightness(0.7)" }}
                >
                  {hasMapCoords ? (
                    <DeliveryTrackMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: `${GOLD}25` }}>
                        <MapPin size={20} color={GOLD} aria-hidden />
                      </div>
                      <span className="text-[13px] font-semibold text-white/60">Map loading…</span>
                    </div>
                  )}
                </div>

                {/* Waiting overlay when crew hasn't started, z-[1000] above Leaflet */}
                {!crewHasStarted && (
                  <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-black/30">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2.5 border border-white/10" style={{ backgroundColor: `${GOLD}18` }}>
                      <Clock size={22} color={GOLD} aria-hidden />
                    </div>
                    <span className="text-[13px] font-semibold text-white/90 tracking-tight">Waiting for crew</span>
                    <span className="text-[11px] text-white/50 mt-0.5">
                      {timeWindow ? `Window: ${timeWindow}` : "Map goes live when crew starts the job"}
                    </span>
                  </div>
                )}

                {/* Live status badge inside map when active, z-[1000] so it sits above Leaflet map panes */}
                {crewHasStarted && liveStage && (
                  <div className="absolute top-3 left-3 z-[1000] rounded-xl bg-white/95 backdrop-blur-sm border px-3 py-2 flex items-center gap-2 shadow-lg" style={{ borderColor: `${FOREST}15` }}>
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
                    </span>
                    <span className="text-[11px] font-bold" style={{ color: FOREST }}>
                      {normalizedStage ? CLIENT_STAGE_LABELS[normalizedStage] : toTitleCase(liveStage || "")}
                    </span>
                  </div>
                )}

                {/* Fullscreen button, z-[1000] so it sits above Leaflet map panes */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                  className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 backdrop-blur-sm border shadow-lg transition-all hover:scale-105 active:scale-95"
                  style={{ borderColor: `${FOREST}15`, color: FOREST }}
                >
                  <CornersOut size={13} className="text-current shrink-0" aria-hidden />
                  <span className="text-[11px] font-bold">Expand</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Post-delivery rating */}
        {isCompleted && (
          <div className="rounded-2xl border p-5 mb-5 anim-slide-up anim-delay-5" style={{ borderColor: `${FOREST}12`, backgroundColor: "white" }}>
            <PostDeliveryRating deliveryId={delivery.id} token={token} googleReviewUrl={googleReviewUrl} />
          </div>
        )}

        {/* Track another link */}
        <div className="text-center mb-6 anim-slide-up anim-delay-5">
          <Link
            href="/tracking"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity"
            style={{ color: GOLD }}
          >
            <MagnifyingGlass size={12} className="text-current shrink-0" aria-hidden />
            Track another delivery
          </Link>
        </div>
      </div>

      {/* ── Sticky Footer ── */}
      <footer className="shrink-0 py-4 text-center border-t" style={{ borderColor: `${FOREST}08` }}>
        <div className="flex items-center justify-center gap-1.5 opacity-40">
          <span className="text-[10px] font-medium" style={{ color: FOREST }}>Powered by</span>
          <YugoLogo size={13} variant="gold" />
        </div>
      </footer>
    </div>
  );
}
