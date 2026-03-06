"use client";

import { useEffect, useState } from "react";

type Photo = { id: string; url: string; caption: string | null; created_at?: string };

export default function TrackPhotos({ moveId, token }: { moveId: string; token: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/track/moves/${moveId}/photos?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPhotos(data.photos ?? []);
      })
      .catch(() => { if (!cancelled) setPhotos([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moveId, token]);

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
        <h3 className="text-[14px] font-bold text-[#1A1A1A] mb-4">Photos</h3>
        <p className="text-[12px] text-[#666]">Loading...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] mb-4">Photos</h3>
        <p className="text-[12px] text-[#666]">No photos uploaded yet. Your coordinator may add photos from the pre-move survey.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#1A1A1A]">Photos ({photos.length})</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadAll}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#E7E5E4] text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
          >
            Download All
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#E7E5E4] text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
          >
            Share
          </button>
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {photos.map((p) => {
          const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase() : "";
          const label = p.caption || "Photo";
          return (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-[#E7E5E4] bg-[#FAFAF8] aspect-[4/3] hover:border-[#C9A962] transition-colors relative group"
            >
              <img src={p.url} alt={label} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#666]">
                {label} {dateStr && `• ${dateStr}`}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
