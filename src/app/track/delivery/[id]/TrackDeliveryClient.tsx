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

export default function TrackDeliveryClient({
  delivery,
  token,
}: {
  delivery: any;
  token: string;
}) {
  const [liveStage, setLiveStage] = useState<string | null>(delivery.stage || null);
  const [crewLoc, setCrewLoc] = useState<CrewPos>(null);
  const [crewName, setCrewName] = useState<string | null>(null);
  const [center, setCenter] = useState<Coord>({ lat: 43.665, lng: -79.385 });
  const [pickup, setPickup] = useState<Coord | null>(null);
  const [dropoff, setDropoff] = useState<Coord | null>(null);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/track/delivery/${delivery.id}/crew-status?token=${encodeURIComponent(token)}`
        );
        if (!res.ok || cancelled) return;
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
      if (!cancelled) setLoading(false);
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

  const showMap = !loading && (hasActiveTracking || crewLoc || (pickup && dropoff));

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: CREAM, color: FOREST }} data-theme="light">
      {/* Map area — full-width at top when live (stays dark for map contrast) */}
      {showMap && (
        <div className={`relative ${isFullscreen ? "fixed inset-0 z-50" : "h-[340px] sm:h-[420px]"} bg-[#1A1A1A]`}>
          {/* Overlay: stage card */}
          {liveStage && (
            <div className="absolute top-4 left-4 z-20 rounded-xl bg-white/95 backdrop-blur-sm border px-4 py-3 flex items-center gap-3 shadow-xl" style={{ borderColor: `${FOREST}25` }}>
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
              </span>
              <div>
                <div className="text-[13px] font-bold" style={{ color: FOREST }}>
                  {STAGE_LABELS[liveStage] || toTitleCase(liveStage)}
                </div>
                <div className="text-[11px] opacity-80" style={{ color: FOREST }}>
                  {displayEta != null ? `~${displayEta} min away` : crewName ? `Crew: ${crewName}` : "Your crew is on the way"}
                </div>
              </div>
            </div>
          )}

          {/* Overlay: ETA pill */}
          {displayEta != null && (
            <div className="absolute top-4 right-4 z-20 rounded-xl px-4 py-2.5 shadow-xl" style={{ backgroundColor: GOLD }}>
              <div className="text-[20px] font-bold text-[#1A1A1A] leading-none">{displayEta}</div>
              <div className="text-[9px] font-semibold text-[#1A1A1A]/70 uppercase tracking-wider">min</div>
            </div>
          )}

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute bottom-4 right-4 z-20 p-2.5 rounded-xl bg-white/90 backdrop-blur-sm border transition-colors hover:opacity-90"
            style={{ borderColor: `${FOREST}30`, color: FOREST }}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            )}
          </button>

          <DeliveryTrackMap center={center} crew={crewLoc} pickup={pickup} dropoff={dropoff} liveStage={liveStage} />
        </div>
      )}

      <div className="max-w-[560px] mx-auto px-5 py-6 md:py-8">
        {/* Logo */}
        {!showMap && (
          <div className="text-center mb-8">
            <Link href="/tracking">
              <YugoLogo size={22} variant="gold" />
            </Link>
          </div>
        )}
        {showMap && (
          <div className="mb-6 pt-2">
            <Link href="/tracking">
              <YugoLogo size={16} variant="gold" />
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="mb-5">
          <div className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: WINE }}>Delivery Tracking</div>
          <h1 className="text-[20px] md:text-[24px] font-bold leading-tight" style={{ color: FOREST }}>
            {delivery.customer_name || "Your Delivery"}
          </h1>
          <p className="text-[13px] mt-0.5 font-mono opacity-75" style={{ color: FOREST }}>{delivery.delivery_number}</p>
        </div>

        {/* Progress */}
        {(isInProgress || isCompleted) && (
          <div className="mb-5">
            <DeliveryProgressBar
              percent={progressPercent}
              sublabel={`${Math.round(progressPercent)}%`}
              label={liveStage ? STAGE_LABELS[liveStage] || liveStage : isCompleted ? "Completed" : "Tracking…"}
              variant="light"
            />
          </div>
        )}

        {/* Stage steps */}
        {(isInProgress || isCompleted) && (
          <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
            {DELIVERY_STAGES.map((s, i) => {
              const isPast = stageIdx > i || isCompleted;
              const isCurrent = stageIdx === i && !isCompleted;
              return (
                <div key={s} className="flex items-center gap-0 flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border"
                      style={
                        isPast
                          ? { backgroundColor: "#22C55E", color: "white", borderColor: "transparent" }
                          : isCurrent
                            ? { backgroundColor: GOLD, color: "#1A1A1A", borderColor: "transparent", boxShadow: `0 0 0 2px ${GOLD}40` }
                            : { backgroundColor: CREAM, color: `${FOREST}60`, borderColor: `${FOREST}25` }
                      }
                    >
                      {isPast ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div
                      className="text-[9px] mt-1.5 font-semibold whitespace-nowrap"
                      style={{ color: isCurrent ? GOLD : isPast ? "#22C55E" : `${FOREST}60` }}
                    >
                      {STAGE_LABELS[s]}
                    </div>
                  </div>
                  {i < DELIVERY_STAGES.length - 1 && (
                    <div className="w-8 sm:w-12 h-[2px] mx-1 mt-[-16px] rounded-full" style={{ backgroundColor: isPast ? "#22C55E" : `${FOREST}20` }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Waiting state (no tracking yet) */}
        {!showMap && !isCompleted && !loading && (
          <div className="rounded-xl border p-5 mb-5 bg-white" style={{ borderColor: `${FOREST}20` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${GOLD}15` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div className="text-[14px] font-semibold" style={{ color: FOREST }}>
                  {scheduledDate ? `Scheduled for ${scheduledDate}` : "Delivery scheduled"}
                </div>
                <div className="text-[12px] opacity-75" style={{ color: FOREST }}>
                  {delivery.delivery_window || delivery.time_slot
                    ? `${delivery.delivery_window || delivery.time_slot}`
                    : "Live tracking activates when crew begins"}
                </div>
              </div>
            </div>
            {crewName && (
              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: `${FOREST}15` }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}15` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <span className="text-[12px] opacity-75" style={{ color: FOREST }}>Your crew: <span className="font-semibold opacity-100">{crewName}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Crew info bar when tracking is live */}
        {hasActiveTracking && crewName && (
          <div className="flex items-center gap-3 mb-5 rounded-xl border px-4 py-3 bg-white" style={{ borderColor: `${FOREST}20` }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${GOLD}15` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: FOREST }}>{crewName}</div>
              <div className="text-[11px] opacity-75" style={{ color: FOREST }}>Your delivery crew</div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              LIVE
            </span>
          </div>
        )}

        {/* Details card */}
        <div className="rounded-xl p-5 space-y-4 bg-white border" style={{ borderColor: `${FOREST}20` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75" style={{ color: FOREST }}>Delivery to</div>
              <div className="text-[13px]" style={{ color: FOREST }}>{delivery.delivery_address || "—"}</div>
            </div>
            {delivery.pickup_address && (
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75" style={{ color: FOREST }}>Pickup from</div>
                <div className="text-[13px]" style={{ color: FOREST }}>{delivery.pickup_address || "—"}</div>
              </div>
            )}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75" style={{ color: FOREST }}>Date & window</div>
              <div className="text-[13px] font-semibold" style={{ color: FOREST }}>
                {delivery.scheduled_date || "—"} {(delivery.delivery_window || delivery.time_slot) ? `· ${delivery.delivery_window || delivery.time_slot}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75" style={{ color: FOREST }}>Items</div>
              <div className="text-[13px] font-semibold" style={{ color: FOREST }}>{itemsCount} item{itemsCount !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {itemsCount > 0 && (
            <div className="pt-4 border-t" style={{ borderColor: `${FOREST}15` }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2 opacity-75" style={{ color: FOREST }}>Item list</div>
              <ul className="text-[13px] space-y-1">
                {(delivery.items as string[]).map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-2" style={{ color: FOREST }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: GOLD }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] mt-8 opacity-75" style={{ color: FOREST }}>
          <Link href="/tracking" className="hover:underline font-semibold" style={{ color: GOLD }}>Track another delivery</Link> · Powered by YUGO
        </p>
      </div>
    </div>
  );
}
