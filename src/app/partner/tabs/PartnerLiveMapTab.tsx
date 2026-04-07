"use client";

import { useState, useEffect, useRef } from "react";
import { CornersIn, CornersOut, ShareNetwork, X } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import PartnerShareModal from "@/app/partner/PartnerShareModal";
import { pmBodyMuted, pmPageTitle } from "@/components/partner/pm/pm-typography";

const PartnerMapLeaflet = dynamic(() => import("./PartnerMapLeaflet"), { ssr: false });
const PartnerMapMapbox = dynamic(() => import("./PartnerMapMapbox"), { ssr: false });

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const HAS_MAPBOX = MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith("pk.your-") && MAPBOX_TOKEN !== "pk.your-mapbox-token";

export interface ActiveLiveJob {
  job_kind?: "delivery" | "move";
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

type PartnerLiveMapTabProps = {
  orgId: string;
  /** Property management portal: tenant share + serif title */
  variant?: "default" | "pm";
};

export default function PartnerLiveMapTab({ orgId, variant = "default" }: PartnerLiveMapTabProps) {
  const [jobs, setJobs] = useState<ActiveLiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActiveLiveJob | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPm = variant === "pm";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/partner/live-tracking");
        if (res.ok) {
          const data = await res.json();
          const d = (data.deliveries || []) as ActiveLiveJob[];
          const m = (data.moves || []) as ActiveLiveJob[];
          const merged = [...d, ...m];
          merged.sort((a, b) => {
            const aActive = a.is_job_active ? 1 : 0;
            const bActive = b.is_job_active ? 1 : 0;
            return bActive - aActive;
          });
          setJobs(merged);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    };

    load();
    pollRef.current = setInterval(load, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orgId]);

  const hasAny = jobs.length > 0;
  const currentJob = jobs.find((j) => j.is_job_active) ?? jobs[0] ?? null;
  const crewHasStarted = currentJob?.is_job_active ?? false;
  const crewIsOutWorking = jobs.some((j) => j.crew_lat != null && j.crew_lng != null);

  const lastSyncedCurrentId = useRef<string | null>(null);
  useEffect(() => {
    if (!currentJob) return;
    if (currentJob.id !== lastSyncedCurrentId.current) {
      lastSyncedCurrentId.current = currentJob.id;
      setSelected(currentJob);
    }
  }, [currentJob?.id]);

  const center =
    currentJob?.crew_lat != null && currentJob?.crew_lng != null
      ? { latitude: currentJob.crew_lat, longitude: currentJob.crew_lng }
      : currentJob?.dest_lat != null && currentJob?.dest_lng != null
        ? { latitude: currentJob.dest_lat, longitude: currentJob.dest_lng }
        : { latitude: 43.665, longitude: -79.385 };

  const shareForJob = selected ?? currentJob;
  const shareMove =
    shareForJob && shareForJob.job_kind === "move"
      ? {
          id: shareForJob.id,
          move_code: shareForJob.delivery_number,
          client_name: shareForJob.customer_name,
          to_address: shareForJob.delivery_address,
        }
      : undefined;
  const shareDelivery =
    shareForJob && shareForJob.job_kind !== "move"
      ? {
          id: shareForJob.id,
          delivery_number: shareForJob.delivery_number,
          customer_name: shareForJob.customer_name,
          delivery_address: shareForJob.delivery_address,
        }
      : undefined;

  const titleClass = isPm ? pmPageTitle : "text-[26px] font-bold text-[var(--tx)] font-hero";

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className={titleClass}>Live Delivery Tracking</h3>
        <div className="flex items-center gap-2 shrink-0">
          {hasAny && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#2D9F5A] font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9F5A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D9F5A]" />
              </span>
              {jobs.filter((j) => j.is_job_active).length} active
            </span>
          )}
          {isPm && hasAny && shareForJob && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase border border-[#2C3E2D]/25 text-[#1a1f1b] hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm [font-family:var(--font-body)]"
            >
              <ShareNetwork size={16} weight="bold" aria-hidden />
              Share with tenant
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#4F4B47]"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <CornersIn size={16} /> : <CornersOut size={16} />}
          </button>
        </div>
      </div>

      <div
        className={`relative rounded-xl border border-[#E8E4DF] overflow-hidden bg-white ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}`}
        style={isFullscreen ? undefined : { height: 480 }}
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-20 p-2 bg-white rounded-lg shadow-md border border-[#E8E4DF] hover:bg-[#F5F3F0] transition-colors text-[#4F4B47]"
          >
            <X size={16} weight="regular" />
          </button>
        )}

        {crewHasStarted && selected && (
          <div className="absolute top-4 left-4 z-10 bg-white rounded-xl border border-[#E8E4DF] p-4 shadow-lg max-w-[280px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D9F5A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2D9F5A]" />
              </span>
              <span className="text-[13px] font-bold text-[#1A1A1A]">
                {CREW_STATUS_TO_LABEL[selected.live_stage || ""] ||
                  toTitleCase(selected.live_stage || "") ||
                  "Active"}
              </span>
            </div>
            <div className="text-[12px] text-[#1A1A1A] font-semibold">
              {selected.customer_name || selected.delivery_number}
            </div>
            <div className="text-[11px] text-[#4F4B47] mt-0.5">{selected.delivery_address || "-"}</div>
            {selected.crew_name && (
              <div className="text-[11px] text-[#4F4B47] mt-1">Crew: {selected.crew_name}</div>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-2 text-[10px] text-[var(--tx)] font-semibold hover:underline"
            >
              Close
            </button>
          </div>
        )}

        {!crewHasStarted && crewIsOutWorking && currentJob && (
          <div className="absolute top-4 left-4 z-10 bg-white rounded-xl border border-amber-200 p-3.5 shadow-lg max-w-[280px]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <span className="text-[12px] font-bold text-amber-700">Crew En Route</span>
            </div>
            <div className="text-[12px] text-[#1A1A1A] font-semibold leading-snug">
              Crew completing a prior job. Yours is next.
            </div>
            {currentJob.crew_name && (
              <div className="text-[11px] text-[#4F4B47] mt-1">Team: {currentJob.crew_name}</div>
            )}
          </div>
        )}

        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-[13px] text-[#4F4B47]">Loading map...</div>
        ) : !hasAny ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-[#D4D0CB]">
            <p className="text-[var(--text-base)] text-[#4F4B47]">
              {isPm
                ? "No confirmed moves or deliveries scheduled for today."
                : "No Confirmed Deliveries Scheduled For Today."}
            </p>
            <p className={`${pmBodyMuted} text-[12px] mt-1 max-w-sm`}>
              {isPm
                ? "When a crew starts an active job, the map and live location appear here."
                : "Confirmed Or Dispatched Deliveries Will Appear On The Map Here."}
            </p>
          </div>
        ) : (
          <>
            {HAS_MAPBOX ? (
              <PartnerMapMapbox
                token={MAPBOX_TOKEN}
                center={center}
                currentDelivery={currentJob}
                onSelect={setSelected}
              />
            ) : (
              <PartnerMapLeaflet center={center} currentDelivery={currentJob} onSelect={setSelected} />
            )}
            {!crewHasStarted && !crewIsOutWorking && (
              <div
                className="absolute inset-0 bg-[#FFFBF7]/95 flex flex-col items-center justify-center z-10"
                aria-hidden="true"
              >
                <span className="text-[var(--text-base)] font-semibold text-[#1A1A1A]">Live signal off</span>
                <span className="text-[12px] text-[#454545] mt-1 text-center px-4">
                  Map and crew location appear only while the crew has started your job
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 space-y-2">
          {jobs.map((d, index) => {
            const isActive = d.is_job_active;
            const slotLabel = isActive ? "Active" : index === 0 ? "Next" : "Upcoming";
            return (
              <div
                key={`${d.job_kind ?? "delivery"}-${d.id}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelected(d);
                  if (isPm) setShareOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(d);
                  }
                }}
                className={`bg-white border rounded-xl p-4 flex items-center justify-between transition-colors text-left ${
                  selected?.id === d.id ? "ring-2 ring-[#5C1A33]/25 border-[#5C1A33]/30" : ""
                } ${
                  isActive
                    ? "border-[#2C3E2D] ring-1 ring-[#2C3E2D]/30 cursor-pointer hover:border-[#2C3E2D]/40"
                    : "border-[#E8E4DF] cursor-pointer hover:border-[#2C3E2D]/20"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                      isActive
                        ? "bg-[#2D9F5A] text-white"
                        : index === 0
                          ? "bg-amber-100 text-amber-800"
                          : "bg-[#F5F3F0] text-[#4F4B47]"
                    }`}
                  >
                    {slotLabel}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[var(--text-base)] font-semibold text-[#1A1A1A] truncate">
                      {d.job_kind === "move" ? (
                        <span>
                          {d.customer_name || d.delivery_number}
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#5A6B5E] ml-2">
                            Move
                          </span>
                        </span>
                      ) : (
                        d.customer_name || d.delivery_number
                      )}
                    </div>
                    {isActive ? (
                      <div className="text-[12px] text-[#4F4B47] mt-0.5 line-clamp-2">
                        {d.delivery_address || "-"}
                      </div>
                    ) : crewIsOutWorking ? (
                      <div className="text-[11px] text-amber-600 mt-0.5">
                        Crew completing a prior job. Yours is next.
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#5C5853] mt-0.5">
                        Tracking activates when crew start this job
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isActive && d.crew_name && (
                    <span className="text-[11px] text-[#4F4B47] hidden sm:inline">{d.crew_name}</span>
                  )}
                  {isActive ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#2D9F5A] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-[#2D9F5A]" />
                      Live
                    </span>
                  ) : crewIsOutWorking ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      En Route
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#4F4B47]">Awaiting GPS</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isPm && shareOpen && shareForJob && (shareMove || shareDelivery) && (
        <PartnerShareModal
          move={shareMove}
          delivery={shareDelivery}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
