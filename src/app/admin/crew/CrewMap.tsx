"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ModalOverlay from "../components/ModalOverlay";

const MapboxMap = dynamic(
  () =>
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;
      return function CrewMapbox({
        crews,
        center,
        zoom,
        mapStyle,
        token,
      }: {
        crews: { id: string; name: string; current_lat: number; current_lng: number; members?: string[]; current_job?: string }[];
        center: { longitude: number; latitude: number };
        zoom: number;
        mapStyle: string;
        token: string;
      }) {
        return (
          <M
            mapboxAccessToken={token}
            initialViewState={{ ...center, zoom }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={mapStyle}
          >
            {crews.map((c) => (
              <Marker key={c.id} longitude={c.current_lng} latitude={c.current_lat} anchor="center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, #C9A962, #8B7332)",
                  }}
                  title={c.name}
                >
                  {(c.name?.replace("Team ", "") || "?").slice(0, 1).toUpperCase()}
                </div>
              </Marker>
            ))}
            <Nav position="bottom-right" showCompass showZoom />
          </M>
        );
      };
    }),
  { ssr: false }
);

interface Crew {
  id: string;
  name: string;
  members: string[];
  status: string;
  current_lat: number;
  current_lng: number;
  current_job: string;
  updated_at?: string;
  delay_minutes?: number;
  progress_percent?: number;
}

interface Delivery {
  id: string;
  delivery_number?: string;
  crew_id: string;
  scheduled_date?: string;
  status: string;
  delivery_address?: string;
  pickup_address?: string;
}

const PROJECT_STAGES = ["pending", "confirmed", "in-transit", "delivered"] as const;
const STAGE_LABELS: Record<string, string> = {
  pending: "Scheduled",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  dispatched: "En route",
  "in-transit": "En route",
  delivered: "Done",
  cancelled: "Cancelled",
};
const STAGE_INSIGHTS: Record<string, string> = {
  pending: "Project is scheduled — crew preparing",
  scheduled: "Project is scheduled — crew preparing",
  confirmed: "Crew confirmed — heading to pickup or on site",
  dispatched: "Crew is on the way to delivery site",
  "in-transit": "Crew is on the way to delivery site",
  delivered: "Project completed successfully",
  cancelled: "Project was cancelled",
};
const STATUS_TO_STAGE: Record<string, number> = { pending: 0, scheduled: 0, confirmed: 1, dispatched: 2, "in-transit": 2, delivered: 3 };

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const DEFAULT_CENTER = { longitude: -79.385, latitude: 43.665 };
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function CrewMap({ crews, deliveries = [] }: { crews: Crew[]; deliveries?: Delivery[] }) {
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const mapStyle = "mapbox://styles/mapbox/dark-v11";

  const crewsWithPosition = crews.filter((c) => c.current_lat != null && c.current_lng != null);
  const center =
    crewsWithPosition.length > 0
      ? {
          longitude: crewsWithPosition.reduce((s, c) => s + c.current_lng, 0) / crewsWithPosition.length,
          latitude: crewsWithPosition.reduce((s, c) => s + c.current_lat, 0) / crewsWithPosition.length,
        }
      : DEFAULT_CENTER;
  const zoom = crewsWithPosition.length > 1 ? 12 : 14;

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith("pk.your-") || MAPBOX_TOKEN === "pk.your-mapbox-token") {
    return (
      <>
        <div className="mb-4">
          <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">Live Tracking</h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to .env.local to enable the map.</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-8 mb-4 flex flex-col items-center justify-center gap-2" style={{ height: 380 }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--gdim)]">
            <svg className="w-6 h-6 text-[var(--tx3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-[13px] font-medium text-[var(--tx)]">Live tracking map</p>
        </div>
        <CrewListAndModal crews={crews} deliveries={deliveries} selectedCrew={selectedCrew} setSelectedCrew={setSelectedCrew} />
      </>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">Live Tracking</h2>
        <p className="text-[11px] text-[var(--tx3)] mt-0.5">Click a team for details</p>
      </div>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 relative z-0">
        <div className="w-full rounded-lg border border-[var(--brd)] overflow-hidden relative z-0" style={{ height: 380 }}>
          <MapboxMap
            token={MAPBOX_TOKEN}
            crews={crewsWithPosition}
            center={center}
            zoom={zoom}
            mapStyle={mapStyle}
          />
        </div>
      </div>
      <CrewListAndModal crews={crews} deliveries={deliveries} selectedCrew={selectedCrew} setSelectedCrew={setSelectedCrew} />
    </>
  );
}

function CrewListAndModal({
  crews,
  deliveries,
  selectedCrew,
  setSelectedCrew,
}: {
  crews: Crew[];
  deliveries: Delivery[];
  selectedCrew: Crew | null;
  setSelectedCrew: (c: Crew | null) => void;
}) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-3">
        {crews.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCrew(c)}
            className="flex items-center gap-3 px-4 py-3.5 bg-[var(--card)] border border-[var(--brd)] rounded-xl hover:border-[var(--gold)] transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-[var(--gold)] bg-[var(--gdim)] group-hover:bg-[var(--gold)]/20 transition-colors">
              {c.name?.replace("Team ", "")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[var(--tx)]">{c.name}</div>
              <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">{(c.members || []).join(", ")}</div>
              <div className="text-[9px] text-[var(--tx2)] mt-0.5">{c.status === "en-route" ? `En route • ${c.current_job}` : c.current_job || "Standby"}</div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.status === "en-route" ? "bg-[var(--org)] animate-pulse" : "bg-[var(--grn)]"}`} />
          </button>
        ))}
      </div>

      <ModalOverlay open={!!selectedCrew} onClose={() => setSelectedCrew(null)} title={selectedCrew?.name || ""} maxWidth="md">
        {selectedCrew &&
          (() => {
            const isEnRoute = selectedCrew.status === "en-route";
            const progress = selectedCrew.progress_percent ?? (isEnRoute ? 65 : 0);
            const delay = selectedCrew.delay_minutes ?? 0;
            const crewDeliveries = deliveries.filter((d) => d.crew_id === selectedCrew.id);
            const pendingDeliveries = crewDeliveries.filter((d) => !["delivered", "cancelled"].includes(d.status));
            const activeProject = pendingDeliveries[0];
            const nextProject = pendingDeliveries[1];
            const currentStageIdx = activeProject ? (STATUS_TO_STAGE[activeProject.status] ?? PROJECT_STAGES.indexOf(activeProject.status as (typeof PROJECT_STAGES)[number])) : -1;
            const stageInsight = activeProject
              ? (STAGE_INSIGHTS[activeProject.status] || "In progress")
              : (selectedCrew.current_job ? `Standby — ${selectedCrew.current_job}` : "No active project — on standby");

            return (
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${isEnRoute ? "bg-[var(--gdim)] text-[var(--gold)]" : "bg-[var(--grdim)] text-[var(--grn)]"}`}>
                    <span className={`w-2 h-2 rounded-full ${isEnRoute ? "bg-[var(--gold)] animate-pulse" : "bg-[var(--grn)]"}`} />
                    {isEnRoute ? "En route" : "Standby"}
                  </span>
                  {selectedCrew.updated_at && (
                    <span className="text-[10px] text-[var(--tx3)]">Updated {formatDate(selectedCrew.updated_at)}</span>
                  )}
                </div>

                {stageInsight && (
                  <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/60">
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">What&apos;s happening</div>
                    <div className="text-[13px] text-[var(--tx)]">{stageInsight}</div>
                  </div>
                )}

                {activeProject && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Project stage</div>
                    <div className="flex items-center gap-1">
                      {PROJECT_STAGES.map((s, i) => {
                        const isActive = currentStageIdx === i;
                        const isPast = currentStageIdx >= 0 && i < currentStageIdx;
                        const isCancelled = activeProject.status === "cancelled";
                        return (
                          <div key={s} className="flex items-center flex-1 min-w-0">
                            <div className="flex flex-col items-center flex-1 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-colors ${
                                  isCancelled && isActive ? "bg-[var(--red)]/20 text-[var(--red)]" : isActive ? "bg-[var(--gold)] text-[#0D0D0D]" : isPast ? "bg-[var(--grn)] text-white" : "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx3)]"
                                }`}
                              >
                                {isPast ? "✓" : i + 1}
                              </div>
                              <span className={`text-[9px] mt-1 truncate w-full text-center ${isActive ? "text-[var(--gold)] font-semibold" : isPast ? "text-[var(--grn)]" : "text-[var(--tx3)]"}`}>
                                {STAGE_LABELS[s] || s}
                              </span>
                            </div>
                            {i < PROJECT_STAGES.length - 1 && (
                              <div className={`flex-1 h-0.5 min-w-[8px] mx-0.5 rounded ${i < currentStageIdx ? "bg-[var(--grn)]" : "bg-[var(--brd)]"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isEnRoute && (
                  <div>
                    <div className="flex justify-between text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
                      <span>Job progress</span>
                      <span className="text-[var(--grn)]">{progress}%</span>
                    </div>
                    <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--grn)] rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {delay > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ordim)] border border-[var(--org)]/30">
                    <span className="text-[12px] font-semibold text-[var(--org)]">~{delay} min delay</span>
                  </div>
                )}

                {!activeProject && selectedCrew.current_job && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Current activity</div>
                    <div className="text-[13px] text-[var(--tx)]">{selectedCrew.current_job}</div>
                  </div>
                )}
                {activeProject && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Current project</div>
                    <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] space-y-1.5">
                      <div className="text-[12px] font-semibold text-[var(--tx)]">{activeProject.delivery_number || `#${activeProject.id.slice(0, 8)}`}</div>
                      {(activeProject.pickup_address || activeProject.delivery_address) && (
                        <div className="text-[11px] text-[var(--tx2)] space-y-0.5">
                          {activeProject.pickup_address && (
                            <div className="truncate">
                              <span className="text-[var(--tx3)]">From:</span> {activeProject.pickup_address}
                            </div>
                          )}
                          {activeProject.delivery_address && (
                            <div className="truncate">
                              <span className="text-[var(--tx3)]">To:</span> {activeProject.delivery_address}
                            </div>
                          )}
                        </div>
                      )}
                      {activeProject.scheduled_date && (
                        <div className="text-[10px] text-[var(--tx3)]">
                          {new Date(activeProject.scheduled_date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {nextProject && (
                  <div>
                    <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Up next</div>
                    <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)]/60 border border-[var(--brd)]/80">
                      <div className="text-[12px] font-semibold text-[var(--tx)]">{nextProject.delivery_number || `#${nextProject.id.slice(0, 8)}`}</div>
                      {nextProject.delivery_address && <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">{nextProject.delivery_address}</div>}
                      {nextProject.scheduled_date && (
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                          {new Date(nextProject.scheduled_date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team members</div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedCrew.members || []).map((m) => (
                      <span key={m} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
      </ModalOverlay>
    </>
  );
}
