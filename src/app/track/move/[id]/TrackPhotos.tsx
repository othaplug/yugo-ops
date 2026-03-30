"use client";

import { useEffect, useState, useRef } from "react";
import { ImageSquare } from "@phosphor-icons/react";

const GOLD = "#C9A962";
const MAX_PHOTOS = 10;

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  source?: string;
  created_at?: string;
};

export default function TrackPhotos({
  moveId,
  token,
  moveComplete = false,
}: {
  moveId: string;
  token: string;
  moveComplete?: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = () => {
    fetch(`/api/track/moves/${moveId}/photos?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => setPhotos(data.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPhotos();
  }, [moveId, token]);

  const clientPhotoCount = photos.filter((p) => p.source === "client").length;
  const canUpload = !moveComplete && clientPhotoCount < MAX_PHOTOS;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    const remaining = MAX_PHOTOS - clientPhotoCount;
    const toUpload = Array.from(files).slice(0, remaining);
    toUpload.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/photos?token=${encodeURIComponent(token)}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      fetchPhotos();
    } catch {}
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownloadAll = () => {
    photos.forEach((p, i) => {
      const a = document.createElement("a");
      a.href = p.url;
      a.download = `photo-${i + 1}.jpg`;
      a.target = "_blank";
      a.click();
    });
  };

  const handleShare = async () => {
    if (navigator.share && photos.length > 0) {
      try {
        await navigator.share({
          title: "Move Photos",
          text: `${photos.length} photos from your move`,
          url: window.location.href,
        });
      } catch {
        navigator.clipboard?.writeText(window.location.href);
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-[var(--text-base)] font-bold text-[#1A1A1A] mb-4">Photos</h3>
        <p className="text-[12px] text-[#454545]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
        <h3 className="text-[var(--text-base)] font-bold text-[#1A1A1A]">
          Photos{photos.length > 0 ? ` (${photos.length})` : ""}
        </h3>
        <div className="flex gap-2">
          {photos.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleDownloadAll}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#E7E5E4] text-[#454545] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
              >
                Download All
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#E7E5E4] text-[#454545] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
              >
                Share
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload area, before and during move only */}
      {canUpload && (
        <div className="px-5 pt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleUpload}
            className="hidden"
            id="client-photo-upload"
          />
          <label
            htmlFor="client-photo-upload"
            className="flex items-center justify-center gap-2.5 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#C9A962] hover:bg-[#C9A96208] active:scale-[0.99]"
            style={{ borderColor: uploading ? GOLD : "#D4D0C8" }}
          >
            {uploading ? (
              <span className="text-[12px] font-semibold" style={{ color: GOLD }}>
                Uploading...
              </span>
            ) : (
              <>
                <ImageSquare size={18} color={GOLD} />
                <div className="text-left">
                  <span className="text-[12px] font-semibold text-[#1A1A1A] block">
                    Upload Photos
                  </span>
                  <span className="text-[10px] text-[#4F4B47]">
                    {clientPhotoCount}/{MAX_PHOTOS} uploaded &middot; JPG, PNG, WebP
                  </span>
                </div>
              </>
            )}
          </label>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] font-semibold text-[#1A1A1A] mb-1">No photos yet</p>
          <p className="text-[11px] text-[#4F4B47] max-w-[240px] mx-auto leading-relaxed">
            {moveComplete
              ? "No photos were uploaded for this move."
              : "Upload photos of items you'd like moved, or your coordinator may add photos from the pre-move survey."}
          </p>
        </div>
      ) : (
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((p) => {
            const dateStr = p.created_at
              ? new Date(p.created_at)
                  .toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  .toUpperCase()
              : "";
            const isClient = p.source === "client";
            const label = isClient ? "Your photo" : p.caption || "Photo";
            return (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden border border-[#E7E5E4] bg-[#FAFAF8] aspect-[4/3] hover:border-[#C9A962] transition-colors relative group"
              >
                <img src={p.url} alt={label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-white/95 px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#454545]">
                    {label} {dateStr && `\u2022 ${dateStr}`}
                  </span>
                  {isClient && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${GOLD}18`, color: GOLD }}
                    >
                      YOU
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
