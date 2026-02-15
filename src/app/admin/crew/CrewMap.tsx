"use client";

import { useEffect, useRef, useState } from "react";
import ModalOverlay from "../components/ModalOverlay";
import { useTheme } from "../components/ThemeContext";

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

export default function CrewMap({ crews, deliveries = [] }: { crews: Crew[]; deliveries?: Delivery[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const { theme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    if (!mapRef.current || loaded) return;

    // Load leaflet CSS via link tag
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const tileUrl = isLight
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    // Dynamic import — only runs in browser
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current!, { zoomControl: false }).setView([43.665, -79.385], 13);
      (map.getContainer() as HTMLElement).style.zIndex = "1";

      L.tileLayer(tileUrl, {
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      crews.forEach((c) => {
        if (!c.current_lat || !c.current_lng) return;
        const label = c.name?.replace("Team ", "") || "?";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#C9A962,#8B7332);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([c.current_lat, c.current_lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${c.name}</b><br>${(c.members || []).join(", ")}<br><em>${c.current_job || "Standby"}</em>`);
      });

      setLoaded(true);
    });
  }, [crews, loaded, isLight]);

  return (
    <>
      <div className="mb-4">
        <h2 className="font-heading text-[15px] font-bold text-[var(--tx)]">Live Tracking</h2>
        <p className="text-[11px] text-[var(--tx3)] mt-0.5">Click a team for details</p>
      </div>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 relative z-0">
        <div
          ref={mapRef}
          className="w-full rounded-lg border border-[var(--brd)] relative z-0"
          style={{ height: 380 }}
        />
      </div>
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
        {selectedCrew && (() => {
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
              {/* Status + Last update */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${isEnRoute ? "bg-[var(--gdim)] text-[var(--gold)]" : "bg-[var(--grdim)] text-[var(--grn)]"}`}>
                  <span className={`w-2 h-2 rounded-full ${isEnRoute ? "bg-[var(--gold)] animate-pulse" : "bg-[var(--grn)]"}`} />
                  {isEnRoute ? "En route" : "Standby"}
                </span>
                {selectedCrew.updated_at && (
                  <span className="text-[10px] text-[var(--tx3)]">Updated {formatDate(selectedCrew.updated_at)}</span>
                )}
              </div>

              {/* What's happening now - intuitive insight */}
              {stageInsight && (
                <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/60">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">What&apos;s happening</div>
                  <div className="text-[13px] text-[var(--tx)]">{stageInsight}</div>
                </div>
              )}

              {/* Project stage timeline - where they are in the project */}
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
                                isCancelled && isActive ? "bg-[var(--red)]/20 text-[var(--red)]" :
                                isActive ? "bg-[var(--gold)] text-[#0D0D0D]" :
                                isPast ? "bg-[var(--grn)] text-white" :
                                "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx3)]"
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

              {/* Progress bar - green when en-route */}
              {isEnRoute && (
                <div>
                  <div className="flex justify-between text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
                    <span>Job progress</span>
                    <span className="text-[var(--grn)]">{progress}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--grn)] rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Delay indicator */}
              {delay > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ordim)] border border-[var(--org)]/30">
                  <span className="text-[12px] font-semibold text-[var(--org)]">~{delay} min delay</span>
                </div>
              )}

              {/* Current job (when no project) or Current project with route */}
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
                          <div className="truncate"><span className="text-[var(--tx3)]">From:</span> {activeProject.pickup_address}</div>
                        )}
                        {activeProject.delivery_address && (
                          <div className="truncate"><span className="text-[var(--tx3)]">To:</span> {activeProject.delivery_address}</div>
                        )}
                      </div>
                    )}
                    {activeProject.scheduled_date && (
                      <div className="text-[10px] text-[var(--tx3)]">
                        {new Date(activeProject.scheduled_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Next project */}
              {nextProject && (
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Up next</div>
                  <div className="px-3 py-2.5 rounded-lg bg-[var(--bg)]/60 border border-[var(--brd)]/80">
                    <div className="text-[12px] font-semibold text-[var(--tx)]">{nextProject.delivery_number || `#${nextProject.id.slice(0, 8)}`}</div>
                    {nextProject.delivery_address && (
                      <div className="text-[11px] text-[var(--tx2)] mt-0.5 truncate">{nextProject.delivery_address}</div>
                    )}
                    {nextProject.scheduled_date && (
                      <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                        {new Date(nextProject.scheduled_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Team members */}
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