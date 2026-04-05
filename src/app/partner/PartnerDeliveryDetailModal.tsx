"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Link, PencilSimple, X, NavigationArrow, Clock, Image } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import DeliveryProgressBar from "@/components/DeliveryProgressBar";
import ProofOfDeliverySection from "@/components/ProofOfDeliverySection";
import DeliveryScoreCard from "@/components/partner/DeliveryScoreCard";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";
import { normalizeDeliveryItemsForDisplay } from "@/lib/delivery-items";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";

const DeliveryTrackMap = dynamic(
  () => import("@/app/track/delivery/[id]/DeliveryTrackMap").then((m) => m.default),
  { ssr: false, loading: () => <div className="h-full min-h-[240px] bg-[var(--bg)] animate-pulse rounded-xl" /> }
);

/** Full 5 stages for admin/partner (two-leg delivery) */
const DELIVERY_STAGES = ["en_route_to_pickup", "arrived_at_pickup", "en_route_to_destination", "arrived_at_destination", "completed"];
const STAGE_LABELS: Record<string, string> = {
  en_route_to_pickup: "En Route to Pick Up",
  arrived_at_pickup: "Arrived at Pickup",
  en_route_to_destination: "En Route to Drop Off",
  arrived_at_destination: "Delivering/Installing",
  completed: "Complete",
  en_route: "En Route to Pick Up",
  arrived: "Arrived at Pickup",
  delivering: "Delivering/Installing",
};

function normalizeDeliveryStage(stage: string | null): string | null {
  if (!stage) return null;
  const legacy: Record<string, string> = { en_route: "en_route_to_pickup", arrived: "arrived_at_pickup", delivering: "en_route_to_destination" };
  return legacy[stage] || stage;
}

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string;
  stage: string | null;
  scheduled_date: string | null;
  time_slot: string | null;
  delivery_address: string | null;
  pickup_address: string | null;
  items: unknown[] | string[] | null;
  category: string | null;
  crew_id: string | null;
  created_at: string;
  quoted_price?: number | null;
  total_price?: number | null;
  admin_adjusted_price?: number | null;
  booking_type?: string | null;
  num_stops?: number | null;
  stops_detail?: { address: string; customer_name?: string | null; customer_phone?: string | null; items?: { name: string; size: string; quantity: number }[]; instructions?: string | null; zone?: number | null }[] | null;
  delivery_score?: number | null;
  score_arrived_late?: boolean | null;
  score_damage_reported?: boolean | null;
  score_end_customer_rating?: number | null;
}

interface DeliveryStop {
  id: string;
  stop_number: number;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  client_phone?: string | null;
  items_description: string | null;
  special_instructions: string | null;
  notes?: string | null;
  stop_status?: string | null;
  stop_type?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
}

interface Props {
  delivery: Delivery;
  onClose: () => void;
  onShare: () => void;
  onEdit?: () => void;
}

interface Photo {
  id: string;
  url: string;
  category: string;
  checkpoint: string | null;
  takenAt: string;
  note: string | null;
}

export default function PartnerDeliveryDetailModal({ delivery: d, onClose, onShare, onEdit }: Props) {
  const [liveStage, setLiveStage] = useState<string | null>(d.stage || null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"details" | "tracking" | "photos" | "pod">("details");
  const [crewPosition, setCrewPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapData, setMapData] = useState<{
    center: { lat: number; lng: number };
    crew: { current_lat: number; current_lng: number; name?: string } | null;
    pickup: { lat: number; lng: number } | null;
    dropoff: { lat: number; lng: number } | null;
    liveStage: string | null;
    navEtaSeconds?: number | null;
    navDistanceRemainingM?: number | null;
    isNavigating?: boolean;
  } | null>(null);
  const isInProgress = ["dispatched", "in-transit", "in_transit"].includes((d.status || "").toLowerCase().replace(/-/g, "_"));
  const isCompleted = ["delivered", "completed"].includes((d.status || "").toLowerCase());
  const isLocked = ["delivered", "completed", "cancelled"].includes((d.status || "").toLowerCase());

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);
  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    if (!isInProgress && !isCompleted) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/partner/deliveries/${d.id}/crew-status`);
        if (res.ok) {
          const data = await res.json();
          if (data?.liveStage != null) setLiveStage(data.liveStage);
        }
      } catch (err) { console.error("Failed to poll crew status:", err); }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [d.id, isInProgress, isCompleted]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/partner/deliveries/${d.id}/photos`);
        if (res.ok) {
          const data = await res.json();
          setPhotos(data.photos || []);
        }
      } catch (err) { console.error("Failed to load delivery photos:", err); }
      setPhotosLoading(false);
    };
    load();
  }, [d.id]);

  useEffect(() => {
    if (d.booking_type !== "day_rate") return;
    setStopsLoading(true);
    fetch(`/api/partner/deliveries/${d.id}/stops`)
      .then((res) => (res.ok ? res.json() : { stops: [] }))
      .then((data) => {
        const apiStops = Array.isArray(data.stops) ? data.stops : [];
        if (apiStops.length > 0) {
          setStops(apiStops);
        } else if (Array.isArray(d.stops_detail) && d.stops_detail.length > 0) {
          // Fallback: use stops_detail stored on the delivery itself
          setStops(
            d.stops_detail.map((s, i) => ({
              id: `local-${i}`,
              stop_number: i + 1,
              address: s.address || "",
              customer_name: s.customer_name ?? null,
              customer_phone: s.customer_phone ?? null,
              items_description: Array.isArray(s.items) && s.items.length > 0
                ? s.items.map((it) => `${it.quantity > 1 ? `${it.quantity}x ` : ""}${it.name}`).join(", ")
                : null,
              special_instructions: s.instructions ?? null,
            }))
          );
        }
      })
      .catch((err) => { console.error("Failed to fetch delivery stops:", err); setStops([]); })
      .finally(() => setStopsLoading(false));
  }, [d.id, d.booking_type, d.stops_detail]);

  useEffect(() => {
    if (!d.crew_id) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/partner/deliveries/${d.id}/crew-status`);
        if (res.ok) {
          const data = await res.json();
          if (data?.crew_lat != null && data?.crew_lng != null) {
            setCrewPosition({ lat: data.crew_lat, lng: data.crew_lng });
          }
          if (data?.liveStage != null) setLiveStage(data.liveStage);
          if (data?.center) {
            setMapData({
              center: data.center,
              crew: data.crew ?? null,
              pickup: data.pickup ?? null,
              dropoff: data.dropoff ?? null,
              liveStage: data.liveStage ?? null,
              navEtaSeconds: data.nav_eta_seconds ?? null,
              navDistanceRemainingM: data.nav_distance_remaining_m ?? null,
              isNavigating: Boolean(data.is_navigating),
            });
          }
        }
      } catch (err) { console.error("Failed to poll crew status for map:", err); }
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [d.id, d.crew_id]);

  const copyLink = async () => {
    try {
      const res = await fetch("/api/partner/share-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_id: d.id, method: "link", recipient: "copy" }),
      });
      const data = await res.json();
      const url = data.trackUrl || `${window.location.origin}/track/delivery/${encodeURIComponent(d.delivery_number)}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error("Failed to copy tracking link:", err); }
  };

  const normalizedStage = normalizeDeliveryStage(liveStage);
  const stageIdx = DELIVERY_STAGES.indexOf(normalizedStage || "");
  const progressPercent = isCompleted || normalizedStage === "completed" ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100 : 0;
  const showProgressBar = (isInProgress || isCompleted) && (stageIdx >= 0 || normalizedStage === "completed" || isCompleted);

  const items = Array.isArray(d.items) ? d.items : [];
  const itemsDisplay = normalizeDeliveryItemsForDisplay(items)
    .map((row) => (row.qty > 1 ? `${row.name} ×${row.qty}` : row.name))
    .filter(Boolean);

  const isDelivered = ["delivered", "completed"].includes((d.status || "").toLowerCase());

  const sectionTabs: { key: "details" | "tracking" | "photos" | "pod"; label: string }[] = [
    { key: "details", label: "Details" },
    ...(d.crew_id ? [{ key: "tracking" as const, label: "Tracking" }] : []),
    { key: "photos", label: `Photos${photos.length > 0 ? ` (${photos.length})` : ""}` },
    ...(isDelivered ? [{ key: "pod" as const, label: "PoD" }] : []),
  ];

  const modalContent = (
    <ModalDialogFrame
      zClassName="z-[99999]"
      backdropClassName="bg-black/40"
      onBackdropClick={onClose}
      panelClassName="bg-[#FFFBF7] rounded-t-lg sm:rounded-lg shadow-[0_24px_80px_rgba(44,62,45,0.14)] border border-[#2C3E2D]/10 w-full max-w-lg overflow-hidden flex flex-col sheet-card sm:modal-card"
      panelStyle={{ maxHeight: "min(92dvh, 92vh)" }}
      role="dialog"
      ariaModal
    >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-hero text-[26px] font-bold text-[var(--tx)] truncate">
              {d.customer_name || d.delivery_number}
            </h2>
            <p className="text-[11px] text-[var(--tx3)] font-mono">{d.delivery_number}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={copyLink} className="p-2 rounded-lg hover:bg-[var(--bg)] transition-colors" title="Copy tracking link">
              {copied ? (
                <Check size={16} color="#2D9F5A" weight="bold" />
              ) : (
                <Link size={16} color="#6B6B6B" />
              )}
            </button>
            {!isLocked && onEdit && (
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-[var(--bg)] transition-colors" title="Edit">
                <PencilSimple size={16} color="#6B6B6B" />
              </button>
            )}
            <button onClick={onShare} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#2C3E2D] text-white hover:bg-[#B89A52] transition-colors">
              Share
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg)]" aria-label="Close">
              <X size={18} weight="regular" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="px-5 pt-4 pb-6">
            <DeliveryProgressBar
              percent={progressPercent}
              label={normalizedStage ? ((STAGE_LABELS[normalizedStage] || liveStage) ?? "Tracking…") : isCompleted ? "Complete" : "Tracking…"}
              sublabel={`${Math.round(progressPercent)}%`}
              variant="light"
            />
          </div>
        )}

        {/* Section tabs */}
        <div className="flex justify-center gap-0 px-5 border-b border-[var(--brd)] shrink-0">
          {sectionTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveSection(t.key)}
              className={`px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-colors -mb-px ${
                activeSection === t.key
                  ? "border-[#2C3E2D] text-[#2C3E2D]"
                  : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeSection === "details" && (
            <div className="space-y-4">
              <div className="border-b border-[var(--brd)]/30 pb-4">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Status</div>
                <span className="text-[13px] font-semibold text-[var(--tx)]">
                  {liveStage ? (CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)) : toTitleCase(d.status || "")}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-[var(--brd)]/30 pb-4">
                {d.booking_type === "day_rate" ? (
                  <>
                    {d.pickup_address && (
                      <div>
                        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Pickup from</div>
                        <div className="text-[13px] text-[var(--tx)]">{d.pickup_address}</div>
                      </div>
                    )}
                    {stopsLoading ? (
                      <div className="text-[12px] text-[var(--tx3)]">Loading stops…</div>
                    ) : stops.length > 0 ? (
                      <div>
                        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">
                          {stops.length} stop{stops.length !== 1 ? "s" : ""}
                        </div>
                        <ul className="space-y-3">
                          {stops.map((stop) => {
                            const sStatus = stop.stop_status || "pending";
                            const isDone = sStatus === "completed";
                            const isCurrent = ["current", "arrived", "in_progress"].includes(sStatus);
                            const statusIcon = isDone ? "done" : isCurrent ? "active" : "pending";
                            const completedTime = stop.completed_at
                              ? new Date(stop.completed_at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })
                              : null;
                            return (
                              <li key={stop.id} className="flex gap-2">
                                <span className="text-[10px] font-bold text-[#2C3E2D] shrink-0 pt-0.5">{stop.stop_number}.</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-semibold text-[var(--tx3)] flex items-center">
                                      {statusIcon === "done" && <Check size={9} color="#22C55E" weight="bold" />}
                                      {statusIcon === "active" && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                                      {statusIcon === "pending" && <span className="w-2 h-2 rounded-full border border-[var(--brd)] inline-block" />}
                                    </span>
                                    {isDone && completedTime && (
                                      <span className="text-[9px] text-[#22C55E]">Done {completedTime}</span>
                                    )}
                                    {isCurrent && (
                                      <span className="text-[9px] text-[#F59E0B] font-semibold">In Progress</span>
                                    )}
                                  </div>
                                  <div className="text-[13px] font-medium text-[var(--tx)]">{stop.address || "-"}</div>
                                  {stop.customer_name && <div className="text-[11px] text-[var(--tx3)]">{stop.customer_name}</div>}
                                  {stop.items_description && <div className="text-[11px] text-[var(--tx3)]">{stop.items_description}</div>}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Delivery to</div>
                        <div className="text-[13px] text-[var(--tx)]">{d.delivery_address || "-"}</div>
                        {d.num_stops && d.num_stops > 1 && (
                          <div className="text-[11px] text-[var(--tx3)] mt-0.5">{d.num_stops} stops total</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Delivery to</div>
                      <div className="text-[13px] text-[var(--tx)]">{d.delivery_address || "-"}</div>
                    </div>
                    {d.pickup_address && (
                      <div>
                        <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Pickup from</div>
                        <div className="text-[13px] text-[var(--tx)]">{d.pickup_address}</div>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Date & time</div>
                  <div className="text-[13px] font-semibold text-[var(--tx)]">
                    {d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "-"}
                    {d.time_slot && ` · ${d.time_slot}`}
                  </div>
                </div>
                {(() => {
                  const displayPrice = d.admin_adjusted_price || d.total_price || d.quoted_price;
                  if (!displayPrice || displayPrice <= 0) return null;
                  const isPending = (d.status || "").toLowerCase() === "pending_approval";
                  return (
                    <div className="pt-3 border-t border-[var(--brd)]/20">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">
                            {isPending ? "Quoted Price" : "Confirmed Price"}
                          </div>
                          <div className="text-[18px] font-bold text-[#2C3E2D]">
                            ${Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                            +${Math.round(displayPrice * 0.13).toLocaleString()} HST
                            &nbsp;·&nbsp;
                            Total ${Math.round(displayPrice * 1.13).toLocaleString()}
                          </div>
                        </div>
                        {isPending && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">
                            Awaiting approval
                          </span>
                        )}
                        {!isPending && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#2C3E2D]/10 text-[#2C3E2D]">
                            Confirmed
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--tx3)] mt-1.5 opacity-60">
                        Your rates are locked per your partnership agreement.
                      </p>
                    </div>
                  );
                })()}
              </div>

              {itemsDisplay.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">Items</div>
                  <ul className="text-[13px] text-[var(--tx)] space-y-0.5">
                    {itemsDisplay.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#2C3E2D] flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeSection === "tracking" && d.crew_id && (
            <div className="space-y-4">
              <>
                  <div className="flex items-center gap-3 pb-4 border-b border-[var(--brd)]/30">
                    <div className="w-10 h-10 rounded-xl bg-[#2C3E2D]/15 flex items-center justify-center flex-shrink-0">
                      <NavigationArrow size={20} color="#2C3E2D" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--tx)]">
                        {isCompleted ? "Delivery complete" : liveStage ? (STAGE_LABELS[liveStage] || CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)) : "Crew assigned"}
                      </div>
                      <div className="text-[11px] text-[var(--tx3)]">
                        {isCompleted ? "Last known crew location" : crewPosition ? "Live GPS tracking active" : "Waiting for crew location…"}
                      </div>
                    </div>
                    {isCompleted ? (
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#22C55E]/10 text-[#22C55E]">
                        <Check size={10} weight="bold" />
                        Complete
                      </span>
                    ) : crewPosition ? (
                      <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold bg-[rgba(45,159,90,0.1)] text-[#2D9F5A]">
                        <span className="w-2 h-2 rounded-full bg-[#2D9F5A] animate-pulse" />
                        Live
                      </span>
                    ) : null}
                  </div>

                  {mapData ? (
                    <div className="relative overflow-hidden h-[280px] bg-[#EDE9E4] rounded-lg">
                      <DeliveryTrackMap
                        center={mapData.center}
                        crew={isCompleted ? null : mapData.crew}
                        pickup={mapData.pickup}
                        dropoff={mapData.dropoff}
                        liveStage={isCompleted ? "completed" : mapData.liveStage}
                        lastKnownPos={isCompleted && mapData.crew ? { lat: mapData.crew.current_lat, lng: mapData.crew.current_lng } : null}
                      />
                      {!isCompleted &&
                        mapData.navEtaSeconds != null &&
                        mapData.navEtaSeconds > 0 && (
                          <div className="absolute bottom-2 left-2 z-[500] pointer-events-none rounded-lg border border-[#E8E4DF] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-[#1A1816] shadow-lg backdrop-blur-sm">
                            ~{Math.max(1, Math.round(mapData.navEtaSeconds / 60))} min ETA
                            {mapData.navDistanceRemainingM != null && mapData.navDistanceRemainingM > 0 && (
                              <span className="font-normal opacity-85">
                                {" "}
                                ·{" "}
                                {mapData.navDistanceRemainingM >= 1000
                                  ? `${(mapData.navDistanceRemainingM / 1000).toFixed(1)} km`
                                  : `${Math.round(mapData.navDistanceRemainingM)} m`}
                              </span>
                            )}
                          </div>
                        )}
                    </div>
                  ) : crewPosition ? (
                    <div className="overflow-hidden h-[240px] bg-[var(--bg)] rounded-lg">
                      <iframe
                        title="Last known crew location"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${crewPosition.lng - 0.02},${crewPosition.lat - 0.015},${crewPosition.lng + 0.02},${crewPosition.lat + 0.015}&layer=mapnik&marker=${crewPosition.lat},${crewPosition.lng}`}
                      />
                    </div>
                  ) : (
                    <div className="py-12 text-center border-t border-[var(--brd)]/30 pt-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg)] flex items-center justify-center">
                        <Clock size={22} color="#6B6B6B" />
                      </div>
                      <p className="text-[13px] text-[var(--tx3)]">{isCompleted ? "No location data recorded for this delivery." : "Crew location not yet available."}</p>
                      <p className="text-[11px] text-[#aaa] mt-0.5">{isCompleted ? "" : "Location updates appear here once the crew starts."}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--brd)]/30">
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Destination</div>
                      <div className="text-[12px] text-[var(--tx)] truncate">{d.delivery_address || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Progress</div>
                      <div className="text-[12px] font-semibold text-[var(--tx)]">{Math.round(progressPercent)}%</div>
                    </div>
                  </div>
                </>
            </div>
          )}

          {activeSection === "photos" && (
            <div>
              {photosLoading ? (
                <p className="text-[12px] text-[var(--tx3)] text-center py-4">Loading…</p>
              ) : photos.length === 0 ? (
                <div className="text-center py-12 border-t border-[var(--brd)]/30 pt-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg)] flex items-center justify-center">
                    <Image size={22} color="#6B6B6B" />
                  </div>
                  <p className="text-[13px] text-[var(--tx3)]">No photos yet.</p>
                  <p className="text-[11px] text-[#aaa] mt-0.5">Crew photos will appear here after delivery.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden bg-[var(--brd)]/10 hover:opacity-90 transition-opacity"
                    >
                      <img src={p.url} alt={p.checkpoint || p.category || "Photo"} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === "pod" && (
            <div className="space-y-4">
              {isDelivered && (
                <DeliveryScoreCard
                  score={d.delivery_score ?? 100}
                  onTime={!d.score_arrived_late}
                  damageFree={!d.score_damage_reported}
                  rating={d.score_end_customer_rating ?? null}
                />
              )}
              <ProofOfDeliverySection jobId={d.id} jobType="delivery" />
            </div>
          )}
        </div>
    </ModalDialogFrame>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
