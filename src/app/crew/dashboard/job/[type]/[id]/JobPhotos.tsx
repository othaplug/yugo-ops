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

interface JobPhotosProps {
  jobId: string;
  jobType: "move" | "delivery";
  sessionId: string | null;
  currentStatus: string;
  onPhotoTaken?: () => void;
}

interface PhotoItem {
  id: string;
  url: string;
  category: string;
  checkpoint: string | null;
  takenAt: string;
  note: string | null;
}

export default function JobPhotos({ jobId, jobType, sessionId, currentStatus, onPhotoTaken }: JobPhotosProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const category = CHECKPOINT_TO_CATEGORY[currentStatus] || "other";
  const prompt = CATEGORY_PROMPTS[category] || "Add photo";
  const showPrompt = ["arrived_at_pickup", "arrived_at_destination", "arrived"].includes(currentStatus);

  const fetchPhotos = () => {
    fetch(`/api/crew/photos/${jobId}?jobType=${jobType}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.photos) setPhotos(d.photos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (jobId && jobType) fetchPhotos();
  }, [jobId, jobType]);

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

  return (
    <div className="mt-6">
      <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Photos</h2>
      {showPrompt && (
        <p className="text-[12px] text-[var(--tx2)] mb-3">{prompt}</p>
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
        <label
          className={`w-20 h-20 rounded-lg border-2 border-dashed border-[var(--brd)] flex items-center justify-center text-[24px] cursor-pointer shrink-0 transition-colors hover:border-[var(--gold)] hover:bg-[var(--gdim)]/30 ${
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
      </div>
      <p className="text-[10px] text-[var(--tx3)] mt-2">{photos.length} photo{photos.length !== 1 ? "s" : ""} taken</p>
    </div>
  );
}
