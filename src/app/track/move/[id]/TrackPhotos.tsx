"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useRef, useId } from "react";
import { Plus, CaretRight } from "@phosphor-icons/react";
import { WINE, FOREST, TEXT_MUTED_ON_LIGHT } from "@/lib/client-theme";
const MAX_PHOTOS = 10;

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  source?: string;
  created_at?: string;
};

function Outer({
  embedded,
  children,
}: {
  embedded?: boolean;
  children: ReactNode;
}) {
  if (embedded) return <>{children}</>;
  return (
    <div
      className="bg-white overflow-hidden border"
      style={{ borderColor: `${FOREST}14` }}
    >
      {children}
    </div>
  );
}

export default function TrackPhotos({
  moveId,
  token,
  moveComplete = false,
  embedded = false,
}: {
  moveId: string;
  token: string;
  moveComplete?: boolean;
  /** Omit outer card — parent provides single bordered wrapper */
  embedded?: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reactId = useId();
  const uploadFieldId = `client-photo-upload-${reactId.replace(/:/g, "")}`;

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
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      fetchPhotos();
    } catch {
      /* silent */
    }
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
      <Outer embedded={embedded}>
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: `${FOREST}10` }}
        >
          <div className="h-6 bg-[#E7E5E4] animate-pulse w-40" />
        </div>
        <div className="px-5 py-5">
          <p className="text-[13px]" style={{ color: TEXT_MUTED_ON_LIGHT }}>
            Loading…
          </p>
        </div>
      </Outer>
    );
  }

  return (
    <Outer embedded={embedded}>
      <div
        className="px-5 py-4 border-b flex items-center justify-between gap-3"
        style={{ borderColor: `${FOREST}10` }}
      >
        <div className="min-w-0">
          <h2
            className="font-hero text-[22px] sm:text-[24px] font-semibold leading-tight tracking-tight"
            style={{ color: WINE }}
          >
            Photos
          </h2>
          {photos.length > 0 ? (
            <p
              className="text-[12px] mt-0.5"
              style={{ color: TEXT_MUTED_ON_LIGHT }}
            >
              {photos.length} {photos.length === 1 ? "photo" : "photos"}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 shrink-0">
          {photos.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleDownloadAll}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest border border-solid transition-opacity hover:opacity-80"
                style={{
                  borderColor: `${FOREST}22`,
                  color: FOREST,
                  backgroundColor: "transparent",
                }}
              >
                Download all
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest border border-solid transition-opacity hover:opacity-80"
                style={{
                  borderColor: `${FOREST}22`,
                  color: FOREST,
                  backgroundColor: "transparent",
                }}
              >
                Share
              </button>
            </>
          )}
        </div>
      </div>

      {canUpload && (
        <div className="px-5 pt-4 pb-1 flex flex-col items-center text-center">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleUpload}
            className="hidden"
            id={uploadFieldId}
          />
          <label
            htmlFor={uploadFieldId}
            className={`inline-flex items-center justify-center gap-1.5 px-1 py-1 text-[11px] font-bold uppercase tracking-[0.12em] leading-none transition-opacity cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : "hover:opacity-80"}`}
            style={{ color: FOREST }}
          >
            {uploading ? (
              <span>Uploading…</span>
            ) : (
              <>
                <Plus size={12} weight="bold" className="shrink-0" aria-hidden />
                Upload photos
                <CaretRight size={12} weight="bold" className="shrink-0" aria-hidden />
              </>
            )}
          </label>
          <p
            className="text-[11px] mt-2 max-w-[240px]"
            style={{ color: TEXT_MUTED_ON_LIGHT }}
          >
            {clientPhotoCount}/{MAX_PHOTOS} uploaded · JPG, PNG, WebP
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => {
            const dateStr = p.created_at
              ? new Date(p.created_at)
                  .toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
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
                className="block overflow-hidden border border-solid transition-opacity hover:opacity-90 aspect-[4/3] relative group"
                style={{
                  borderColor: `${FOREST}18`,
                  backgroundColor: `${FOREST}04`,
                }}
              >
                <img
                  src={p.url}
                  alt={label}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.96)",
                    borderTop: `1px solid ${FOREST}10`,
                  }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider truncate"
                    style={{ color: TEXT_MUTED_ON_LIGHT }}
                  >
                    {label} {dateStr && `· ${dateStr}`}
                  </span>
                  {isClient && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 shrink-0 uppercase tracking-wide"
                      style={{
                        backgroundColor: `${FOREST}14`,
                        color: FOREST,
                      }}
                    >
                      You
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </Outer>
  );
}
