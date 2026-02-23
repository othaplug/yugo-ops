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

/** No add-photo before arrival at pickup. Photos only after crew taps "Arrived at Pickup". */
const NO_PHOTO_STATUSES = ["en_route_to_pickup", "en_route"];

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
    (jobType === "delivery" && currentStatus === "arrived");
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

  return (
    <div>
      <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Photos</h2>
      {readOnly ? null : !canAddPhotos ? (
        <p className="text-[11px] text-[var(--tx3)] mb-3">Add photos after arriving at pickup.</p>
      ) : showPrompt ? (
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gdim)]/20 p-4 mb-3">
          <p className="text-[12px] font-semibold text-[var(--tx)] mb-2">{prompt}</p>
          {requiresPhotosBeforeLoading && photosAtArrived < MIN_PHOTOS_AT_ARRIVED && !photosSkipped && (
            <p className="text-[10px] text-[var(--gold)] mb-3">Take at least {MIN_PHOTOS_AT_ARRIVED} photo to continue, or skip below.</p>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center justify-center w-full py-3 rounded-xl border-2 border-dashed transition-colors ${
              uploading ? "opacity-50 pointer-events-none border-[var(--brd)]" : "border-[var(--gold)]/50 hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 cursor-pointer"
            }`}
          >
            <span className="text-[13px] font-semibold text-[var(--gold)]">Take Photo ({photosAtCurrentCheckpoint} taken)</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4 mb-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center w-full py-3 rounded-xl border-2 border-dashed border-[var(--brd)] hover:border-[var(--gold)]/50 hover:bg-[var(--gdim)]/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="text-[13px] font-semibold text-[var(--tx)]">Take Photo ({photos.length} taken)</span>
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-20 h-20 rounded-lg overflow-hidden border border-[var(--brd)] bg-[var(--bg)] shrink-0"
          >
            <img src={p.url} alt="" className="w-full h-full object-cover" />
          </a>
        ))}
        {!readOnly && canAddPhotos && (
          <label
            className={`w-20 h-20 rounded-lg border-2 border-dashed border-[var(--brd)] flex items-center justify-center text-[20px] font-medium text-[var(--tx3)] cursor-pointer shrink-0 transition-colors hover:border-[var(--gold)] hover:bg-[var(--gdim)]/30 hover:text-[var(--gold)] ${
              uploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="sr-only"
            />
            {uploading ? "…" : "+"}
          </label>
        )}
      </div>
      <p className="text-[10px] text-[var(--tx3)] mt-2">{photos.length} photo{photos.length !== 1 ? "s" : ""} taken</p>
      {!readOnly && requiresPhotosBeforeLoading && photosAtArrived < MIN_PHOTOS_AT_ARRIVED && !photosSkipped && (
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
          className="mt-2 text-[10px] text-[var(--tx3)] hover:text-[var(--gold)] underline"
        >
          Skip photos (not recommended)
        </button>
      )}
    </div>
  );
}
