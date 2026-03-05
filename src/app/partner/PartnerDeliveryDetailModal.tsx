"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import DeliveryProgressBar from "@/components/DeliveryProgressBar";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

const DeliveryTrackMap = dynamic(
  () => import("@/app/track/delivery/[id]/DeliveryTrackMap").then((m) => m.default),
  { ssr: false, loading: () => <div className="h-full min-h-[240px] bg-[#F5F3F0] animate-pulse rounded-xl" /> }
);

const DELIVERY_STAGES = ["en_route", "arrived", "delivering", "completed"];
const STAGE_LABELS: Record<string, string> = {
  en_route: "On the way",
  arrived: "Arrived",
  delivering: "Delivering / Installing",
  completed: "Completed",
};

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

interface Note {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

export default function PartnerDeliveryDetailModal({ delivery: d, onClose, onShare, onEdit }: Props) {
  const [liveStage, setLiveStage] = useState<string | null>(d.stage || null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<"details" | "tracking" | "messages" | "photos">("details");
  const [crewPosition, setCrewPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapData, setMapData] = useState<{
    center: { lat: number; lng: number };
    crew: { current_lat: number; current_lng: number; name?: string } | null;
    pickup: { lat: number; lng: number } | null;
    dropoff: { lat: number; lng: number } | null;
    liveStage: string | null;
  } | null>(null);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const isInProgress = ["dispatched", "in-transit", "in_transit"].includes((d.status || "").toLowerCase().replace(/-/g, "_"));
  const isCompleted = ["delivered", "completed"].includes((d.status || "").toLowerCase());
  const isLocked = ["delivered", "completed", "cancelled"].includes((d.status || "").toLowerCase());

  useEffect(() => {
    if (!isInProgress && !isCompleted) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/partner/deliveries/${d.id}/crew-status`);
        if (res.ok) {
          const data = await res.json();
          if (data?.liveStage != null) setLiveStage(data.liveStage);
        }
      } catch {}
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
      } catch {}
      setPhotosLoading(false);
    };
    load();
  }, [d.id]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/partner/deliveries/${d.id}/notes`);
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || []);
        }
      } catch {}
    };
    load();
  }, [d.id]);

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
            });
          }
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [d.id, d.crew_id]);

  const sendNote = async () => {
    if (!newNote.trim() || sendingNote) return;
    setSendingNote(true);
    try {
      const res = await fetch(`/api/partner/deliveries/${d.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.note) setNotes((prev) => [...prev, data.note]);
        setNewNote("");
        setTimeout(() => notesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {}
    setSendingNote(false);
  };

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
    } catch {}
  };

  const stageIdx = DELIVERY_STAGES.indexOf(liveStage || "");
  const progressPercent = isCompleted || liveStage === "completed" ? 100 : stageIdx >= 0 ? ((stageIdx + 1) / DELIVERY_STAGES.length) * 100 : 0;
  const showProgressBar = (isInProgress || isCompleted) && (stageIdx >= 0 || liveStage === "completed" || isCompleted);

  const items = Array.isArray(d.items) ? d.items : [];
  const itemsDisplay = items.map((i: unknown) => typeof i === "string" ? i : (i as { name?: string })?.name || "").filter(Boolean);

  const sectionTabs: { key: "details" | "tracking" | "messages" | "photos"; label: string }[] = [
    { key: "details", label: "Details" },
    ...(d.crew_id ? [{ key: "tracking" as const, label: "Tracking" }] : []),
    { key: "messages", label: `Messages${notes.length > 0 ? ` (${notes.length})` : ""}` },
    { key: "photos", label: `Photos${photos.length > 0 ? ` (${photos.length})` : ""}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E8E4DF] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-hero text-[18px] font-bold text-[#1A1A1A] truncate">
              {d.customer_name || d.delivery_number}
            </h2>
            <p className="text-[11px] text-[#888] font-mono">{d.delivery_number}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={copyLink} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors" title="Copy tracking link">
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D9F5A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              )}
            </button>
            {!isLocked && onEdit && (
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            <button onClick={onShare} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors">
              Share
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F5F3F0]" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="px-5 pt-4">
            <DeliveryProgressBar
              percent={progressPercent}
              label={liveStage ? STAGE_LABELS[liveStage] || liveStage : isCompleted ? "Completed" : "Tracking…"}
              sublabel={`${Math.round(progressPercent)}%`}
              variant="light"
            />
          </div>
        )}

        {/* Section tabs */}
        <div className="flex gap-0 px-5 border-b border-[#E8E4DF] shrink-0">
          {sectionTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveSection(t.key)}
              className={`px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-colors -mb-px ${
                activeSection === t.key
                  ? "border-[#C9A962] text-[#C9A962]"
                  : "border-transparent text-[#888] hover:text-[#1A1A1A]"
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
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Status</div>
                <span className="text-[13px] font-semibold text-[#1A1A1A]">
                  {liveStage ? (CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)) : toTitleCase(d.status || "")}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 border-b border-[var(--brd)]/30 pb-4">
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Delivery to</div>
                  <div className="text-[13px] text-[#1A1A1A]">{d.delivery_address || "—"}</div>
                </div>
                {d.pickup_address && (
                  <div>
                    <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Pickup from</div>
                    <div className="text-[13px] text-[#1A1A1A]">{d.pickup_address}</div>
                  </div>
                )}
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Date & time</div>
                  <div className="text-[13px] font-semibold text-[#1A1A1A]">
                    {d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—"}
                    {d.time_slot && ` · ${d.time_slot}`}
                  </div>
                </div>
              </div>

              {itemsDisplay.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">Items</div>
                  <ul className="text-[13px] text-[#1A1A1A] space-y-0.5">
                    {itemsDisplay.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A962] flex-shrink-0" />
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
              <div className="flex items-center gap-3 pb-4 border-b border-[var(--brd)]/30">
                <div className="w-10 h-10 rounded-xl bg-[#C9A962]/15 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A962" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#1A1A1A]">
                    {liveStage ? (STAGE_LABELS[liveStage] || CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)) : "Crew assigned"}
                  </div>
                  <div className="text-[11px] text-[#888]">
                    {crewPosition ? "Live GPS tracking active" : "Waiting for crew location…"}
                  </div>
                </div>
                {crewPosition && (
                  <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold bg-[rgba(45,159,90,0.1)] text-[#2D9F5A]">
                    <span className="w-2 h-2 rounded-full bg-[#2D9F5A] animate-pulse" />
                    Live
                  </span>
                )}
              </div>

              {mapData ? (
                <div className="overflow-hidden h-[280px] bg-[#1A1A1A] rounded-lg">
                  <DeliveryTrackMap
                    center={mapData.center}
                    crew={mapData.crew}
                    pickup={mapData.pickup}
                    dropoff={mapData.dropoff}
                    liveStage={mapData.liveStage}
                  />
                </div>
              ) : crewPosition ? (
                <div className="overflow-hidden h-[240px] bg-[#F5F3F0] rounded-lg">
                  <iframe
                    title="Crew location"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${crewPosition.lng - 0.02},${crewPosition.lat - 0.015},${crewPosition.lng + 0.02},${crewPosition.lat + 0.015}&layer=mapnik&marker=${crewPosition.lat},${crewPosition.lng}`}
                  />
                </div>
              ) : (
                <div className="py-12 text-center border-t border-[var(--brd)]/30 pt-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#F5F3F0] flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <p className="text-[13px] text-[#888]">Crew location not yet available.</p>
                  <p className="text-[11px] text-[#aaa] mt-0.5">Location updates appear here once the crew starts.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--brd)]/30">
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Destination</div>
                  <div className="text-[12px] text-[#1A1A1A] truncate">{d.delivery_address || "—"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Progress</div>
                  <div className="text-[12px] font-semibold text-[#1A1A1A]">{Math.round(progressPercent)}%</div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "messages" && (
            <div className="space-y-3">
              {notes.length === 0 && (
                <p className="text-[13px] text-[#888] text-center py-4">No messages yet. Add a note below.</p>
              )}
              {notes.map((n, i) => (
                <div key={n.id} className={`py-3 ${i > 0 ? "border-t border-[var(--brd)]/30" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#1A1A1A]">{n.author_name}</span>
                    <span className="text-[10px] text-[#888]">
                      {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#1A1A1A] whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
              <div ref={notesEndRef} />
              <div className="flex gap-2 pt-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendNote())}
                  placeholder="Add a note…"
                  className="flex-1 px-3 py-2 rounded-lg border border-[#E8E4DF] text-[13px] text-[#1A1A1A] placeholder-[#999] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
                <button
                  onClick={sendNote}
                  disabled={!newNote.trim() || sendingNote}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50 transition-colors"
                >
                  {sendingNote ? "…" : "Send"}
                </button>
              </div>
            </div>
          )}

          {activeSection === "photos" && (
            <div>
              {photosLoading ? (
                <p className="text-[12px] text-[#888] text-center py-4">Loading…</p>
              ) : photos.length === 0 ? (
                <div className="text-center py-12 border-t border-[var(--brd)]/30 pt-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#F5F3F0] flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <p className="text-[13px] text-[#888]">No photos yet.</p>
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
        </div>
      </div>
    </div>
  );
}
