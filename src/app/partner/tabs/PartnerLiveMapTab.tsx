"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

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

  const activeWithCrew = deliveries.filter((d) => d.crew_lat != null && d.crew_lng != null);
  const hasAny = activeWithCrew.length > 0;

  const center = hasAny
    ? { latitude: activeWithCrew[0].crew_lat!, longitude: activeWithCrew[0].crew_lng! }
    : { latitude: 43.665, longitude: -79.385 };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[16px] font-bold text-[#1A1A1A] font-serif">Live Delivery Tracking</h3>
        <div className="flex items-center gap-2">
          {hasAny && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#2D9F5A] font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9F5A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D9F5A]" />
              </span>
              {activeWithCrew.length} active
            </span>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            )}
          </button>
        </div>
      </div>

      <div className={`relative rounded-xl border border-[#E8E4DF] overflow-hidden bg-white ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}`} style={isFullscreen ? undefined : { height: 480 }}>
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-20 p-2 bg-white rounded-lg shadow-md border border-[#E8E4DF] hover:bg-[#F5F3F0] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}

        {/* Status overlay */}
        {selected && (
          <div className="absolute top-4 left-4 z-10 bg-white rounded-xl border border-[#E8E4DF] p-4 shadow-lg max-w-[280px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9F5A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D9F5A]" />
              </span>
              <span className="text-[13px] font-bold text-[#1A1A1A]">
                {CREW_STATUS_TO_LABEL[selected.live_stage || ""] || (selected.live_stage || "").replace(/_/g, " ") || "Active"}
              </span>
            </div>
            <div className="text-[12px] text-[#1A1A1A] font-semibold">{selected.customer_name || selected.delivery_number}</div>
            <div className="text-[11px] text-[#888] mt-0.5">{selected.delivery_address || "—"}</div>
            {selected.crew_name && (
              <div className="text-[11px] text-[#888] mt-1">Crew: {selected.crew_name}</div>
            )}
            <button onClick={() => setSelected(null)} className="mt-2 text-[10px] text-[#C9A962] font-semibold hover:underline">
              Close
            </button>
          </div>
        )}

        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-[13px] text-[#888]">Loading map...</div>
        ) : !hasAny ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4D0CB" strokeWidth="1.5"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 0 0-16 0c0 3 2.7 7 8 11.7Z"/></svg>
            <p className="text-[14px] text-[#888] mt-3">No active deliveries with live tracking right now.</p>
            <p className="text-[12px] text-[#aaa] mt-1">When a crew is dispatched, their live position will appear here.</p>
          </div>
        ) : HAS_MAPBOX ? (
          <PartnerMapMapbox
            token={MAPBOX_TOKEN}
            center={center}
            deliveries={activeWithCrew}
            onSelect={setSelected}
          />
        ) : (
          <PartnerMapLeaflet
            center={center}
            deliveries={activeWithCrew}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Active deliveries list */}
      {deliveries.length > 0 && (
        <div className="mt-4 space-y-2">
          {deliveries.map((d) => {
            const hasGPS = d.crew_lat != null;
            return (
              <div
                key={d.id}
                onClick={() => hasGPS ? setSelected(d) : undefined}
                className={`bg-white border border-[#E8E4DF] rounded-xl p-4 flex items-center justify-between ${hasGPS ? "cursor-pointer hover:border-[#C9A962]/40" : ""} transition-colors`}
              >
                <div>
                  <div className="text-[14px] font-semibold text-[#1A1A1A]">{d.customer_name || d.delivery_number}</div>
                  <div className="text-[12px] text-[#888] mt-0.5">{d.delivery_address || "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {d.crew_name && <span className="text-[11px] text-[#888]">{d.crew_name}</span>}
                  {hasGPS ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#2D9F5A] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#2D9F5A]" />
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#888]">Awaiting GPS</span>
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
