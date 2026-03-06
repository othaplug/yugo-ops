"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import DeliveryProgressBar from "@/components/DeliveryProgressBar";
import YugoLogo from "@/components/YugoLogo";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { toTitleCase } from "@/lib/format-text";

const DeliveryTrackMap = dynamic(() => import("./DeliveryTrackMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-[#1A1A1A] text-[#555] text-[12px]">
      Loading map…
    </div>
  ),
});

const DELIVERY_STAGES = ["en_route", "arrived", "delivering", "completed"];
const STAGE_LABELS: Record<string, string> = {
  en_route: "On the way",
  arrived: "Arrived at location",
  delivering: "Delivering / Installing",
  completed: "Completed",
};
const STAGE_ICONS: Record<string, string> = {
  en_route: "M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM13 16V6l5 4H1",
  arrived: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z",
  delivering: "M20 7H4a2 2 0 00-2 2v10h20V9a2 2 0 00-2-2zM12 3v4",
  completed: "M20 6L9 17l-5-5",
};

type Coord = { lat: number; lng: number };
type CrewPos = { current_lat: number; current_lng: number; name?: string } | null;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── CSS-in-JS keyframes injected once ── */
const STYLE_ID = "track-delivery-animations";
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes routePulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
    .anim-slide-up { animation: fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
    .anim-delay-1 { animation-delay: 0.08s; }
    .anim-delay-2 { animation-delay: 0.16s; }
    .anim-delay-3 { animation-delay: 0.24s; }
    .anim-delay-4 { animation-delay: 0.32s; }
    .anim-delay-5 { animation-delay: 0.40s; }
    .route-dot-pulse { animation: routePulse 1.8s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

export default function TrackDeliveryClient({
  delivery,
  token,
  initialPickup,
  initialDropoff,
}: {
  delivery: any;
  token: string;
  initialPickup?: { lat: number; lng: number } | null;
  initialDropoff?: { lat: number; lng: number } | null;
}) {
  const [liveStage, setLiveStage] = useState<string | null>(delivery.stage || null);
  const [crewLoc, setCrewLoc] = useState<CrewPos>(null);
  const [crewName, setCrewName] = useState<string | null>(null);
  const defaultCenter = initialDropoff || initialPickup || { lat: 43.665, lng: -79.385 };
  const [center, setCenter] = useState<Coord>(defaultCenter);
  const [pickup, setPickup] = useState<Coord | null>(initialPickup || null);
  const [dropoff, setDropoff] = useState<Coord | null>(initialDropoff || null);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => { injectStyles(); }, []);

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
        if (data.center?.lat != null) setCenter(data.center);
        if (data.pickup) setPickup(data.pickup);
        if (data.dropoff) setDropoff(data.dropoff);
        setHasActiveTracking(!!data.hasActiveTracking);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [delivery.id, token]);

  const itemsCount = Array.isArray(delivery.items) ? delivery.items.length : 0;
  const statusVal = liveStage === "completed" ? "delivered" : delivery.status;
  const isInProgress = ["en_route", "arrived", "delivering"].includes(liveStage || "");
  const isCompleted = statusVal === "delivered" || statusVal === "completed" || liveStage === "completed";

  const stageIdx = DELIVERY_STAGES.indexOf(liveStage || "");
  const progressPercent = isCompleted ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100 : 0;

  const isPrePickup = liveStage === "en_route" || !liveStage;
  const etaTarget = isPrePickup && pickup ? pickup : dropoff;
  const displayEta =
    crewLoc && etaTarget && isInProgress
      ? Math.max(1, Math.round((haversineKm(crewLoc.current_lat, crewLoc.current_lng, etaTarget.lat, etaTarget.lng) / 30) * 60))
      : null;

  const scheduledDate = delivery.scheduled_date
    ? new Date(delivery.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { timeZone: "America/Toronto", weekday: "long", month: "long", day: "numeric" })
    : null;

  const hasMapCoords = !!(pickup || dropoff) || !!crewLoc;
  const crewHasStarted = hasActiveTracking;
  const timeWindow = delivery.delivery_window || delivery.time_slot || null;
  const pickupAddr = delivery.pickup_address || delivery.from_address;
  const dropoffAddr = delivery.delivery_address || delivery.to_address;

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: CREAM, color: FOREST }} data-theme="light">

      {/* ── MAP ── */}
      <div className={`relative ${isFullscreen ? "fixed inset-0 z-50" : "h-[340px] sm:h-[420px]"} bg-[#1A1A1A] shrink-0`}>
        {crewHasStarted && liveStage && (
          <div className="absolute top-4 left-4 z-20 rounded-2xl bg-white/95 backdrop-blur-sm border px-4 py-3 flex items-center gap-3 shadow-2xl anim-slide-up" style={{ borderColor: `${FOREST}20` }}>
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
            </span>
            <div>
              <div className="text-[13px] font-bold" style={{ color: FOREST }}>
                {STAGE_LABELS[liveStage] || toTitleCase(liveStage)}
              </div>
              <div className="text-[11px] opacity-70" style={{ color: FOREST }}>
                {displayEta != null ? `~${displayEta} min away` : crewName ? `Crew: ${crewName}` : "Your crew is on the way"}
              </div>
            </div>
          </div>
        )}

        {crewHasStarted && displayEta != null && (
          <div className="absolute top-4 right-4 z-20 rounded-2xl px-4 py-2.5 shadow-2xl anim-slide-up" style={{ backgroundColor: GOLD }}>
            <div className="text-[22px] font-bold text-[#1A1A1A] leading-none tabular-nums">{displayEta}</div>
            <div className="text-[9px] font-semibold text-[#1A1A1A]/60 uppercase tracking-wider">min</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute bottom-4 right-4 z-20 p-2.5 rounded-xl bg-white/90 backdrop-blur-sm border transition-all hover:scale-105"
          style={{ borderColor: `${FOREST}20`, color: FOREST }}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          )}
        </button>

        {hasMapCoords ? (
          <DeliveryTrackMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: `${GOLD}25` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <span className="text-[13px] font-semibold text-white/80">Map loading…</span>
          </div>
        )}

        {!crewHasStarted && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] flex flex-col items-center justify-center z-10 transition-all duration-700">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 border border-white/10" style={{ backgroundColor: `${GOLD}15` }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-white tracking-tight">Live tracking</span>
            <span className="text-[12px] text-white/60 mt-1">Activates when your crew starts the job</span>
          </div>
        )}
      </div>

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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                Delivered
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(isInProgress || isCompleted) && (
          <div className="mb-6 anim-slide-up anim-delay-2">
            <DeliveryProgressBar
              percent={progressPercent}
              sublabel={`${Math.round(progressPercent)}%`}
              label={liveStage ? STAGE_LABELS[liveStage] || liveStage : isCompleted ? "Completed" : "Tracking…"}
              variant="light"
            />
          </div>
        )}

        {/* Stage timeline — horizontal */}
        {(isInProgress || isCompleted) && (
          <div className="flex items-center gap-0 mb-7 overflow-x-auto pb-1 anim-slide-up anim-delay-2">
            {DELIVERY_STAGES.map((s, i) => {
              const isPast = stageIdx > i || isCompleted;
              const isCurrent = stageIdx === i && !isCompleted;
              return (
                <div key={s} className="flex items-center gap-0 flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border"
                      style={
                        isPast
                          ? { backgroundColor: "#22C55E", color: "white", borderColor: "transparent" }
                          : isCurrent
                            ? { backgroundColor: GOLD, color: "#1A1A1A", borderColor: "transparent", boxShadow: `0 0 0 3px ${GOLD}30` }
                            : { backgroundColor: CREAM, color: `${FOREST}50`, borderColor: `${FOREST}18` }
                      }
                    >
                      {isPast ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : STAGE_ICONS[s] ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={STAGE_ICONS[s]}/></svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div
                      className="text-[9px] mt-1.5 font-semibold whitespace-nowrap"
                      style={{ color: isCurrent ? GOLD : isPast ? "#22C55E" : `${FOREST}50` }}
                    >
                      {STAGE_LABELS[s]}
                    </div>
                  </div>
                  {i < DELIVERY_STAGES.length - 1 && (
                    <div className="w-8 sm:w-12 h-[2px] mx-1.5 mt-[-16px] rounded-full transition-colors" style={{ backgroundColor: isPast ? "#22C55E" : `${FOREST}15` }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Route Card: From → To ── */}
        <div className="rounded-2xl border overflow-hidden mb-5 anim-slide-up anim-delay-3" style={{ borderColor: `${FOREST}12`, backgroundColor: "white" }}>
          {/* Pickup */}
          {pickupAddr && (
            <div className="flex items-start gap-3.5 px-5 py-4">
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}12` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-0.5" style={{ color: `${FOREST}50` }}>Pickup from</div>
                <div className="text-[13px] font-medium leading-snug" style={{ color: FOREST }}>{pickupAddr}</div>
              </div>
            </div>
          )}

          {/* Route connector */}
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

          {/* Dropoff */}
          {dropoffAddr && (
            <div className="flex items-start gap-3.5 px-5 py-4">
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#22C55E12" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
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
          {/* Date */}
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>Date</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
              {scheduledDate || delivery.scheduled_date || "TBD"}
            </div>
          </div>

          {/* Time window */}
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>Window</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
              {timeWindow || "Flexible"}
            </div>
          </div>

          {/* Items */}
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              </svg>
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>Items</span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
              {itemsCount} item{itemsCount !== 1 ? "s" : ""}
            </div>
          </div>

          {/* ETA / Status */}
          <div className="rounded-2xl border px-4 py-3.5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: `${FOREST}50` }}>
                {displayEta != null ? "ETA" : "Status"}
              </span>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: displayEta != null ? GOLD : FOREST }}>
              {displayEta != null ? `~${displayEta} min` : isCompleted ? "Delivered" : isInProgress ? (STAGE_LABELS[liveStage || ""] || "In Progress") : "Scheduled"}
            </div>
          </div>
        </div>

        {/* ── Crew Card ── */}
        {crewName && (
          <div className="rounded-2xl border overflow-hidden mb-5 anim-slide-up anim-delay-4" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="flex items-center gap-3.5 px-5 py-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}12` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: FOREST }}>{crewName}</div>
                <div className="text-[11px]" style={{ color: `${FOREST}70` }}>Your delivery crew</div>
              </div>
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
        )}

        {/* ── Waiting state (no tracking yet) ── */}
        {!crewHasStarted && !isCompleted && (
          <div className="rounded-2xl border px-5 py-5 mb-5 anim-slide-up anim-delay-4" style={{ borderColor: `${GOLD}20`, backgroundColor: `${GOLD}06` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${GOLD}15` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-semibold" style={{ color: FOREST }}>
                  {scheduledDate ? scheduledDate : "Delivery scheduled"}
                </div>
                <div className="text-[12px]" style={{ color: `${FOREST}80` }}>
                  {timeWindow ? `Arrival window: ${timeWindow}` : "Live tracking activates when crew begins"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Item List ── */}
        {itemsCount > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-5 anim-slide-up anim-delay-5" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: `${FOREST}08` }}>
              <div className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: `${FOREST}50` }}>Item list</div>
            </div>
            <ul className="px-5 py-3 space-y-2">
              {(delivery.items as string[]).map((item: string, i: number) => (
                <li key={i} className="flex items-center gap-2.5 text-[13px]" style={{ color: FOREST }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}10` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Track another link */}
        <div className="text-center mb-6 anim-slide-up anim-delay-5">
          <Link
            href="/tracking"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold hover:opacity-80 transition-opacity"
            style={{ color: GOLD }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
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
