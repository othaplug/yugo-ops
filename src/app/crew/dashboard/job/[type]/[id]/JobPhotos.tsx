"use client";

import { useState, useEffect, useRef } from "react";

const CHECKPOINT_TO_CATEGORY: Record<string, string> = {
  arrived_at_pickup: "pre_move_condition",
  loading: "loading",
  en_route_to_destination: "in_transit",
  arrived_at_destination: "delivery_placement",
  unloading: "post_move_condition",
  arrived: "pre_move_condition",
  delivering: "delivery_placement",
};

const CATEGORY_PROMPTS: Record<string, string> = {
  pre_move_condition: "Document rooms & items before loading",
  loading: "Document loading progress",
  in_transit: "Document items secured in truck",
  delivery_placement: "Document items in final position",
  post_move_condition: "Document room condition after completion",
  damage_documentation: "Document damage",
  other: "Add photo",
};

const MIN_PHOTOS_AT_ARRIVED = 1;

interface JobPhotosProps {
  jobId: string;
  jobType: "move" | "delivery";
  sessionId: string | null;
  currentStatus: string;
  onPhotoTaken?: () => void;
  onPhotoCountChange?: (count: number, atArrived: number) => void;
  /** Called when crew can advance from an arrived checkpoint (has photos or skipped). */
  onCanAdvanceFromArrivedChange?: (canAdvance: boolean) => void;
  /** When true, only show photos; no add/upload. */
  readOnly?: boolean;
}

interface PhotoItem {
  id: string;
  url: string;
  category: string;
  checkpoint: string | null;
  takenAt: string;
  note: string | null;
}

const ARRIVED_CHECKPOINTS = ["arrived_at_pickup", "arrived_at_destination", "arrived"];

/** No add-photo while crew is in transit (driving). Photos only at pickup/destination. */
const NO_PHOTO_STATUSES = ["en_route_to_pickup", "en_route", "en_route_to_destination"];

export default function JobPhotos({ jobId, jobType, sessionId, currentStatus, onPhotoTaken, onPhotoCountChange, onCanAdvanceFromArrivedChange, readOnly = false }: JobPhotosProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosAtArrived, setPhotosAtArrived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const category = CHECKPOINT_TO_CATEGORY[currentStatus] || "other";
  const prompt = CATEGORY_PROMPTS[category] || "Add photo";
  const showPrompt = ARRIVED_CHECKPOINTS.includes(currentStatus);
  const canAddPhotos = !NO_PHOTO_STATUSES.includes(currentStatus);
  const requiresPhotosBeforeLoading =
    (jobType === "move" && (currentStatus === "arrived_at_pickup" || currentStatus === "arrived_at_destination")) ||
    (jobType === "delivery" && (currentStatus === "arrived_at_pickup" || currentStatus === "arrived_at_destination" || currentStatus === "arrived"));
  const [photosSkipped, setPhotosSkipped] = useState(false);

  const fetchPhotos = () => {
    fetch(`/api/crew/photos/${jobId}?jobType=${jobType}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.photos) {
          setPhotos(d.photos);
          const atArrived = (d.photos as PhotoItem[]).filter((p) => ARRIVED_CHECKPOINTS.includes(p.checkpoint || "")).length;
          setPhotosAtArrived(atArrived);
          onPhotoCountChange?.(d.photos.length, atArrived);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (jobId && jobType) fetchPhotos();
  }, [jobId, jobType]);

  useEffect(() => {
    const canAdvance = !requiresPhotosBeforeLoading || photosAtArrived >= MIN_PHOTOS_AT_ARRIVED || photosSkipped;
    onCanAdvanceFromArrivedChange?.(canAdvance);
  }, [requiresPhotosBeforeLoading, photosAtArrived, photosSkipped, onCanAdvanceFromArrivedChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("jobId", jobId);
      form.append("jobType", jobType);
      if (sessionId) form.append("sessionId", sessionId);
      form.append("checkpoint", currentStatus);
      form.append("category", category);
      const res = await fetch("/api/crew/photos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      fetchPhotos();
      onPhotoTaken?.();
    } catch (err) {
      console.error("Photo upload error:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const photosAtCurrentCheckpoint = photos.filter((p) => p.checkpoint === currentStatus).length;

  const photoCount = photos.length;
  const needsPhoto = requiresPhotosBeforeLoading && photosAtArrived < MIN_PHOTOS_AT_ARRIVED && !photosSkipped;

  return (
    <div>
      {/* Hidden file input - always present so both empty-state and grid add-photo can trigger it */}
      {!readOnly && canAddPhotos && (
        <input
          ref={fileInputRef}
          id="job-photos-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="sr-only"
          tabIndex={-1}
        />
      )}
      {/* Header row */}
      <div className="mb-3">
        <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50">Photos</p>
        {!readOnly && canAddPhotos && (
          <p className="text-[11px] text-[var(--tx2)] mt-0.5">{prompt}</p>
        )}
      </div>

      {/* Required photo nudge */}
      {needsPhoto && (
        <p className="text-[10px] text-[var(--gold)] mb-2.5">
          Take at least 1 photo to advance — or skip below.
        </p>
      )}

      {/* Photo grid */}
      {photoCount > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square rounded-xl overflow-hidden border border-[var(--brd)] bg-[var(--bg)]"
            >
              <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </a>
          ))}
          {!readOnly && canAddPhotos && (
            <label
              htmlFor="job-photos-file-input"
              className={`aspect-square rounded-xl border border-dashed border-[var(--brd)] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:border-[var(--gold)]/50 hover:bg-[var(--gdim)]/20 ${uploading ? "opacity-40 pointer-events-none" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </label>
          )}
        </div>
      )}

      {/* Empty state: add first photo */}
      {photoCount === 0 && !readOnly && canAddPhotos && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`w-full flex items-center justify-center gap-2 py-5 rounded-xl border border-dashed transition-all disabled:opacity-40 active:scale-[0.98] ${
            needsPhoto
              ? "border-[var(--gold)]/50 text-[var(--gold)] hover:bg-[var(--gold)]/5"
              : "border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)]/30 hover:text-[var(--tx2)]"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span className="text-[12px] font-semibold">{uploading ? "Uploading…" : "Tap to take photo"}</span>
        </button>
      )}

      {/* Count + skip */}
      <div className="flex items-center justify-between mt-2">
        {photoCount > 0 && (
          <p className="text-[10px] text-[var(--tx3)]/60">{photoCount} photo{photoCount !== 1 ? "s" : ""} taken</p>
        )}
        {!readOnly && needsPhoto && (
          <button
            type="button"
            onClick={() => {
              setPhotosSkipped(true);
              fetch("/api/crew/photos/skip-log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId, jobType, checkpoint: currentStatus }),
              }).catch(() => {});
            }}
            className="ml-auto text-[10px] text-[var(--tx3)]/50 hover:text-[var(--tx3)] underline underline-offset-2"
          >
            Skip (not recommended)
          </button>
        )}
      </div>
    </div>
  );
}
