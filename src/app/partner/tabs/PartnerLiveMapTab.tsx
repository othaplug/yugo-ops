"use client";

import { useState, useEffect, useRef } from "react";
import { CornersIn, CornersOut, X } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

const PartnerMapLeaflet = dynamic(() => import("./PartnerMapLeaflet"), { ssr: false });
const PartnerMapMapbox = dynamic(() => import("./PartnerMapMapbox"), { ssr: false });

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const HAS_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

interface ActiveDelivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  status: string;
  delivery_address: string | null;
  crew_id: string | null;
  crew_name: string | null;
  crew_lat: number | null;
  crew_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  live_stage: string | null;
  is_job_active: boolean;
}

export default function PartnerLiveMapTab({ orgId }: { orgId: string }) {
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActiveDelivery | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/partner/live-tracking");
        if (res.ok) {
          const data = await res.json();
          setDeliveries(data.deliveries || []);
        }
      } catch {/* ignore */}
      setLoading(false);
    };

    load();
    pollRef.current = setInterval(load, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orgId]);

  const hasAny = deliveries.length > 0;
  // The "current" delivery is the one with an active tracking session (sorted first by API)
  const currentDelivery = deliveries.find((d) => d.is_job_active) ?? deliveries[0] ?? null;
  // A crew is considered live only if THIS delivery's job is active
  const crewHasStarted = currentDelivery?.is_job_active ?? false;
  // Does any delivery in the list have GPS data (crew is out working, even on a prior job)?
  const crewIsOutWorking = deliveries.some((d) => d.crew_lat != null && d.crew_lng != null);

  // When the current delivery changes (e.g. after completing one), show its overlay; don’t re-open if user closed it
  const lastSyncedCurrentId = useRef<string | null>(null);
  useEffect(() => {
    if (!currentDelivery) return;
    if (currentDelivery.id !== lastSyncedCurrentId.current) {
      lastSyncedCurrentId.current = currentDelivery.id;
      setSelected(currentDelivery);
    }
  }, [currentDelivery?.id]);

  const center =
    currentDelivery?.crew_lat != null && currentDelivery?.crew_lng != null
      ? { latitude: currentDelivery.crew_lat, longitude: currentDelivery.crew_lng }
      : currentDelivery?.dest_lat != null && currentDelivery?.dest_lng != null
        ? { latitude: currentDelivery.dest_lat, longitude: currentDelivery.dest_lng }
        : { latitude: 43.665, longitude: -79.385 };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[26px] font-bold text-[var(--tx)] font-hero">Live Delivery Tracking</h3>
        <div className="flex items-center gap-2">
          {hasAny && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#2D9F5A] font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9F5A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D9F5A]" />
              </span>
              {deliveries.filter((d) => d.is_job_active).length} active
            </span>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-[#F5F3F0] dark:hover:bg-[var(--card)] transition-colors text-[#888] dark:text-[var(--tx3)]"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <CornersIn size={16} />
            ) : (
              <CornersOut size={16} />
            )}
          </button>
        </div>
      </div>

      <div className={`relative rounded-xl border border-[#E8E4DF] dark:border-[var(--brd)] overflow-hidden bg-white dark:bg-[var(--card)] ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}`} style={isFullscreen ? undefined : { height: 480 }}>
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-20 p-2 bg-white dark:bg-[var(--card)] rounded-lg shadow-md border border-[#E8E4DF] dark:border-[var(--brd)] hover:bg-[#F5F3F0] dark:hover:bg-[var(--bg)] transition-colors text-[#888] dark:text-[var(--tx3)]"
          >
            <X size={16} weight="regular" />
          </button>
        )}

        {/* Status overlay, live job */}
        {crewHasStarted && selected && (
          <div className="absolute top-4 left-4 z-10 bg-white dark:bg-[var(--card)] rounded-xl border border-[#E8E4DF] dark:border-[var(--brd)] p-4 shadow-lg max-w-[280px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9F5A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D9F5A]" />
              </span>
              <span className="text-[13px] font-bold text-[#1A1A1A] dark:text-[var(--tx)]">
                {CREW_STATUS_TO_LABEL[selected.live_stage || ""] || toTitleCase(selected.live_stage || "") || "Active"}
              </span>
            </div>
            <div className="text-[12px] text-[#1A1A1A] dark:text-[var(--tx)] font-semibold">{selected.customer_name || selected.delivery_number}</div>
            <div className="text-[11px] text-[#888] dark:text-[var(--tx3)] mt-0.5">{selected.delivery_address || "-"}</div>
            {selected.crew_name && (
              <div className="text-[11px] text-[#888] dark:text-[var(--tx3)] mt-1">Crew: {selected.crew_name}</div>
            )}
            <button onClick={() => setSelected(null)} className="mt-2 text-[10px] text-[#C9A962] dark:text-[var(--gold)] font-semibold hover:underline">
              Close
            </button>
          </div>
        )}

        {/* Contextual badge, crew is working on a prior job, partner's delivery is next */}
        {!crewHasStarted && crewIsOutWorking && currentDelivery && (
          <div className="absolute top-4 left-4 z-10 bg-white dark:bg-[var(--card)] rounded-xl border border-amber-200 dark:border-amber-500/30 p-3.5 shadow-lg max-w-[280px]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <span className="text-[12px] font-bold text-amber-700 dark:text-amber-400">Crew En Route</span>
            </div>
            <div className="text-[12px] text-[#1A1A1A] dark:text-[var(--tx)] font-semibold leading-snug">
              Crew completing a prior delivery. Yours is next.
            </div>
            {currentDelivery.crew_name && (
              <div className="text-[11px] text-[#888] dark:text-[var(--tx3)] mt-1">Team: {currentDelivery.crew_name}</div>
            )}
          </div>
        )}

        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-[13px] text-[#888] dark:text-[var(--tx3)]">Loading map...</div>
        ) : !hasAny ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-[#D4D0CB] dark:text-[var(--tx3)]">
            <p className="text-[var(--text-base)] text-[#888] dark:text-[var(--tx3)]">No Confirmed Deliveries Scheduled For Today.</p>
            <p className="text-[12px] text-[#aaa] dark:text-[var(--tx3)]/80 mt-1">Confirmed Or Dispatched Deliveries Will Appear On The Map Here.</p>
          </div>
        ) : (
          <>
            {HAS_MAPBOX ? (
              <PartnerMapMapbox
                token={MAPBOX_TOKEN}
                center={center}
                currentDelivery={currentDelivery}
                onSelect={setSelected}
              />
            ) : (
              <PartnerMapLeaflet
                center={center}
                currentDelivery={currentDelivery}
                onSelect={setSelected}
              />
            )}
            {/* Blur overlay, no crew active and no GPS available */}
            {!crewHasStarted && !crewIsOutWorking && (
              <div className="absolute inset-0 bg-white/70 dark:bg-[var(--card)]/70 backdrop-blur-md flex flex-col items-center justify-center z-10" aria-hidden="true">
                <span className="text-[var(--text-base)] font-semibold text-[#1A1A1A] dark:text-[var(--tx)]">Live signal off</span>
                <span className="text-[12px] text-[#666] dark:text-[var(--tx3)] mt-1">Map and tracking will appear when crew start your job</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Active deliveries list, current first, then Next, then Upcoming */}
      {deliveries.length > 0 && (
        <div className="mt-4 space-y-2">
          {deliveries.map((d, index) => {
            const isActive = d.is_job_active;
            const slotLabel = isActive ? "Active" : index === 0 ? "Next" : "Upcoming";
            const isActiveDelivery = isActive;
            return (
              <div
                key={d.id}
                onClick={() => isActive ? setSelected(d) : undefined}
                className={`bg-white dark:bg-[var(--card)] border rounded-xl p-4 flex items-center justify-between transition-colors ${
                  isActiveDelivery
                    ? "border-[#C9A962] dark:border-[var(--gold)] ring-1 ring-[#C9A962]/30 dark:ring-[var(--gold)]/30"
                    : "border-[#E8E4DF] dark:border-[var(--brd)]"
                } ${isActive ? "cursor-pointer hover:border-[#C9A962]/40 dark:hover:border-[var(--gold)]/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 text-[10px] font-bold capitalize tracking-wide px-2 py-0.5 rounded ${
                      isActive
                        ? "bg-[#2D9F5A] text-white"
                        : index === 0
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400"
                          : "bg-[#F5F3F0] dark:bg-[var(--bg)] text-[#888] dark:text-[var(--tx3)]"
                    }`}
                  >
                    {slotLabel}
                  </span>
                  <div>
                    <div className="text-[var(--text-base)] font-semibold text-[#1A1A1A] dark:text-[var(--tx)]">
                      {d.customer_name || d.delivery_number}
                    </div>
                    {isActive ? (
                      <div className="text-[12px] text-[#888] dark:text-[var(--tx3)] mt-0.5">
                        {d.delivery_address || "-"}
                      </div>
                    ) : crewIsOutWorking ? (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Crew completing a prior delivery. Yours is next.
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#999] dark:text-[var(--tx3)] mt-0.5">
                        Tracking activates when crew start this job
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && d.crew_name && (
                    <span className="text-[11px] text-[#888] dark:text-[var(--tx3)]">{d.crew_name}</span>
                  )}
                  {isActive ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#2D9F5A] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#2D9F5A]" />
                      Live
                    </span>
                  ) : crewIsOutWorking ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      En Route
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#888] dark:text-[var(--tx3)]">Awaiting GPS</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
