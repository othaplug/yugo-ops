"use client";

import { useState, useEffect, useRef, useId } from "react";
import { Plus, Image } from "@phosphor-icons/react";

const CHECKPOINT_TO_CATEGORY: Record<string, string> = {
  arrived_at_pickup: "pre_move_condition",
  inventory_check: "pre_move_condition",
  loading: "loading",
  wrapping: "loading",
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
  walkthrough_final: "Final walkthrough: document completed placement before sign-off",
  damage_documentation: "Document damage",
  other: "Add photo",
};

function resolvePhotoCategory(
  jobType: "move" | "delivery",
  currentStatus: string,
  finalWalkPhotoAtLoading: boolean,
): string {
  if (jobType === "move" && currentStatus === "unloading") return "walkthrough_final";
  if (
    jobType === "move" &&
    finalWalkPhotoAtLoading &&
    currentStatus === "loading"
  ) {
    return "walkthrough_final";
  }
  if (jobType === "delivery" && currentStatus === "arrived_at_destination") {
    return "walkthrough_final";
  }
  return CHECKPOINT_TO_CATEGORY[currentStatus] || "other";
}

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
  /** Labour-only / bin flows: final photos taken at loading (no unloading leg). */
  finalWalkPhotoAtLoading?: boolean;
  /** When true, only show photos; no add/upload. */
  readOnly?: boolean;
  /**
   * Fixed category and checkpoint for uploads (e.g. client sign-off: `walkthrough_final` even if session status differs).
   * When set, the arrived-at-photo gate and skip control do not apply.
   */
  uploadOverride?: { category: string; checkpoint: string };
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

export default function JobPhotos({ jobId, jobType, sessionId, currentStatus, onPhotoTaken, onPhotoCountChange, onCanAdvanceFromArrivedChange, finalWalkPhotoAtLoading = false, readOnly = false, uploadOverride }: JobPhotosProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosAtArrived, setPhotosAtArrived] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  /** Two JobPhotos (e.g. tab + modal) must not share one id, or the label targets the wrong input and uploads fail. */
  const uniqueFileInputId = `job-photos-file-${fileInputId.replace(/:/g, "")}`;

  const category = uploadOverride
    ? uploadOverride.category
    : resolvePhotoCategory(jobType, currentStatus, finalWalkPhotoAtLoading);
  const uploadCheckpoint = uploadOverride?.checkpoint ?? currentStatus;
  const prompt = CATEGORY_PROMPTS[category] || "Add photo";
  const canAddPhotos =
    readOnly
      ? false
      : uploadOverride
        ? true
        : !NO_PHOTO_STATUSES.includes(currentStatus);
  const requiresPhotosBeforeLoading = !uploadOverride && (
    (jobType === "move" && (currentStatus === "arrived_at_pickup" || currentStatus === "arrived_at_destination")) ||
    (jobType === "delivery" && (currentStatus === "arrived_at_pickup" || currentStatus === "arrived_at_destination" || currentStatus === "arrived"))
  );
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
    setUploadError(null);
  }, [currentStatus, category, uploadOverride?.category, uploadOverride?.checkpoint]);

  useEffect(() => {
    const canAdvance = !requiresPhotosBeforeLoading || photosAtArrived >= MIN_PHOTOS_AT_ARRIVED || photosSkipped;
    onCanAdvanceFromArrivedChange?.(canAdvance);
  }, [requiresPhotosBeforeLoading, photosAtArrived, photosSkipped, onCanAdvanceFromArrivedChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("jobId", jobId);
      form.append("jobType", jobType);
      if (sessionId) form.append("sessionId", sessionId);
      form.append("checkpoint", uploadCheckpoint);
      form.append("category", category);
      const res = await fetch("/api/crew/photos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      fetchPhotos();
      onPhotoTaken?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error("Photo upload error:", err);
      setUploadError(msg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const photoCount = photos.length;
  const needsPhoto = requiresPhotosBeforeLoading && photosAtArrived < MIN_PHOTOS_AT_ARRIVED && !photosSkipped;

  return (
    <div>
      {/* Hidden file input - always present so both empty-state and grid add-photo can trigger it */}
      {!readOnly && canAddPhotos && (
        <input
          ref={fileInputRef}
          id={uniqueFileInputId}
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
        {uploadError && (
          <p className="text-[11px] text-red-800 mt-1.5 leading-snug" role="alert">
            {uploadError}
          </p>
        )}
      </div>

      {/* Required photo nudge */}
      {needsPhoto && (
        <p className="text-[10px] text-[#5C1A33] mb-2.5">
          Take at least 1 photo to advance, or skip below.
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
              htmlFor={uniqueFileInputId}
              className={`aspect-square rounded-xl border border-dashed border-[var(--brd)] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:border-[#5C1A33]/50 hover:bg-[var(--gdim)]/20 ${uploading ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Plus size={16} weight="regular" color="var(--tx3)" />
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
          className={`w-full flex items-center justify-center gap-2 py-3 border border-dashed transition-all disabled:opacity-40 active:scale-[0.98] ${
            needsPhoto
              ? "border-[#5C1A33]/50 text-[#5C1A33] hover:bg-[#5C1A33]/5"
              : "border-[var(--brd)] text-[var(--tx3)] hover:border-[#5C1A33]/30 hover:text-[var(--tx2)]"
          }`}
        >
          <Image size={18} />
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
                body: JSON.stringify({ jobId, jobType, checkpoint: uploadCheckpoint }),
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
