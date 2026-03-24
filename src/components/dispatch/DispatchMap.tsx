"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { X } from "@phosphor-icons/react";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";
const HAS_MAPBOX =
  MAPBOX_TOKEN &&
  !MAPBOX_TOKEN.startsWith("pk.your-") &&
  MAPBOX_TOKEN !== "pk.your-mapbox-token";

const DEFAULT_CENTER = { lat: 43.665, lng: -79.385 };

export interface DispatchCrew {
  id: string;
  name: string;
  members: string[];
  status: string;
  lat: number | null;
  lng: number | null;
  updatedAt?: string | null;
  currentJobId?: string | null;
  currentJobType?: string | null;
  currentClientName?: string | null;
  currentFromAddress?: string | null;
  currentToAddress?: string | null;
}

export interface DispatchJobForMap {
  id: string;
  type: "move" | "delivery";
  label: string;
  client: string;
  toLat: number | null;
  toLng: number | null;
  fromLat: number | null;
  fromLng: number | null;
  href: string;
  status: string;
  crewName?: string | null;
  etaMinutes?: number | null;
}

function formatRelative(iso: string | undefined | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

const DispatchMapInner = dynamic(
  () =>
    import("react-map-gl/mapbox").then((mod) => {
      const M = mod.default;
      const Marker = mod.Marker;
      const Nav = mod.NavigationControl;

      return function Map({
        crews,
        jobs,
        center,
        selectedCrew,
        selectedJob,
        onCrewClick,
        onJobClick,
      }: {
        crews: DispatchCrew[];
        jobs: DispatchJobForMap[];
        center: { lat: number; lng: number };
        selectedCrew: string | null;
        selectedJob: string | null;
        onCrewClick: (id: string) => void;
        onJobClick: (id: string) => void;
      }) {
        const crewWithPos = crews.filter((c) => c.lat != null && c.lng != null);
        const jobsWithPos = jobs.filter((j) => j.toLat != null && j.toLng != null);
        const zoom = crewWithPos.length > 1 || jobsWithPos.length > 1 ? 11 : 14;

        return (
          <M
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: center.lng,
              latitude: center.lat,
              zoom,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
          >
            {crewWithPos.map((c) => {
              const isOnJob = c.status && !["idle", "offline"].includes(c.status);
              const isSelected = selectedCrew === c.id;
              return (
                <Marker
                  key={`crew-${c.id}`}
                  longitude={c.lng!}
                  latitude={c.lat!}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    onCrewClick(c.id);
                  }}
                >
                  <div
                    className={`cursor-pointer transition-transform ${isSelected ? "scale-125 z-10" : "hover:scale-110"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 ${
                        isOnJob ? "border-[#22C55E]" : "border-[#6B7280]"
                      }`}
                      style={{
                        background: isOnJob
                          ? "linear-gradient(135deg, #22C55E, #16A34A)"
                          : "linear-gradient(135deg, #6B7280, #4B5563)",
                      }}
                    >
                      {(c.name || "?").replace("Team ", "").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-[var(--tx)] whitespace-nowrap px-1.5 py-0.5 rounded bg-[var(--card)]/95 border border-[var(--brd)]">
                      {c.name?.replace("Team ", "") || "Crew"}
                    </span>
                  </div>
                </Marker>
              );
            })}

            {jobsWithPos.map((j) => {
              const isSelected = selectedJob === j.id;
              return (
                <Marker
                  key={`job-${j.id}`}
                  longitude={j.toLng!}
                  latitude={j.toLat!}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    onJobClick(j.id);
                  }}
                >
                  <div
                    className={`cursor-pointer transition-transform ${isSelected ? "scale-125 z-10" : "hover:scale-110"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? "bg-[var(--gold)] text-black" : j.type === "move" ? "bg-[#3B82F6] text-white" : "bg-[var(--grn)] text-white"
                      }`}
                    >
                      {j.type === "move" ? "M" : "D"}
                    </div>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-[var(--tx)] whitespace-nowrap px-1.5 py-0.5 rounded bg-[var(--card)]/95 border border-[var(--brd)]">
                      {j.label}
                    </span>
                  </div>
                </Marker>
              );
            })}

            <Nav position="bottom-right" showCompass showZoom />
          </M>
        );
      };
    }),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center text-[var(--tx3)] text-[12px]">Loading map...</div> }
);

interface DispatchMapProps {
  crews: DispatchCrew[];
  jobs: DispatchJobForMap[];
}

export default function DispatchMap({ crews, jobs }: DispatchMapProps) {
  const [selectedCrew, setSelectedCrew] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const center = useMemo(() => {
    const withPos = [
      ...crews.filter((c) => c.lat != null && c.lng != null).map((c) => ({ lat: c.lat!, lng: c.lng! })),
      ...jobs
        .filter((j) => j.toLat != null && j.toLng != null)
        .map((j) => ({ lat: j.toLat!, lng: j.toLng! })),
    ];
    if (withPos.length === 0) return DEFAULT_CENTER;
    const lat = withPos.reduce((s, p) => s + p.lat, 0) / withPos.length;
    const lng = withPos.reduce((s, p) => s + p.lng, 0) / withPos.length;
    return { lat, lng };
  }, [crews, jobs]);

  const selectedCrewData = selectedCrew ? crews.find((c) => c.id === selectedCrew) : null;
  const selectedJobData = selectedJob ? jobs.find((j) => j.id === selectedJob) : null;

  if (!HAS_MAPBOX) {
    return (
      <div className="h-full min-h-[300px] flex items-center justify-center text-[var(--tx3)] text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
        Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN for map
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[400px] rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--card)]">
      <DispatchMapInner
        crews={crews}
        jobs={jobs}
        center={center}
        selectedCrew={selectedCrew}
        selectedJob={selectedJob}
        onCrewClick={(id) => {
          setSelectedJob(null);
          setSelectedCrew((prev) => (prev === id ? null : id));
        }}
        onJobClick={(id) => {
          setSelectedCrew(null);
          setSelectedJob((prev) => (prev === id ? null : id));
        }}
      />
      {selectedCrewData && selectedCrewData.lat != null && selectedCrewData.lng != null && (
        <div className="absolute top-4 right-4 w-[220px] max-h-[280px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 shadow-xl z-20 animate-fade-up">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="font-semibold text-[var(--text-base)] text-[var(--tx)]">{selectedCrewData.name}</div>
            <button
              type="button"
              onClick={() => setSelectedCrew(null)}
              className="p-1 rounded-lg text-[var(--tx3)] hover:bg-[var(--bg)]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[11px] text-[var(--tx3)]">{selectedCrewData.members?.length || 0} movers</div>
          {selectedCrewData.currentClientName && (
            <div className="mt-2 text-[12px] text-[var(--tx2)]">Current job: {selectedCrewData.currentClientName}</div>
          )}
          {selectedCrewData.currentJobId && (
            <Link
              href={
                selectedCrewData.currentJobType === "move"
                  ? `/admin/moves/${selectedCrewData.currentJobId}`
                  : `/admin/deliveries/${selectedCrewData.currentJobId}`
              }
              className="block mt-2 text-[11px] font-semibold text-[var(--gold)] hover:underline"
            >
              View Job
            </Link>
          )}
          <div className="text-[9px] text-[var(--tx3)] mt-2">Last seen: {formatRelative(selectedCrewData.updatedAt)}</div>
        </div>
      )}
      {selectedJobData && selectedJobData.toLat != null && selectedJobData.toLng != null && (
        <div className="absolute top-4 right-4 w-[220px] max-h-[280px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 shadow-xl z-20 animate-fade-up">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="font-semibold text-[var(--text-base)] text-[var(--tx)]">
              {selectedJobData.label} · {selectedJobData.client}
            </div>
            <button
              type="button"
              onClick={() => setSelectedJob(null)}
              className="p-1 rounded-lg text-[var(--tx3)] hover:bg-[var(--bg)]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedJobData.crewName && (
            <div className="text-[11px] text-[var(--tx2)]">Crew: {selectedJobData.crewName}</div>
          )}
          {selectedJobData.etaMinutes != null && selectedJobData.etaMinutes > 0 && (
            <div className="text-[11px] text-[var(--grn)]">ETA: {selectedJobData.etaMinutes} min</div>
          )}
          <Link
            href={selectedJobData.href}
            className="block mt-2 text-[11px] font-semibold text-[var(--gold)] hover:underline"
          >
            View Details
          </Link>
        </div>
      )}
    </div>
  );
}
