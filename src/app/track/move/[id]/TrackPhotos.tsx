"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/AppIcons";

type Photo = { id: string; url: string; caption: string | null };

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

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] flex items-center gap-2 mb-4">
          <Icon name="image" className="w-[12px] h-[12px]" />
          Move Photos
        </h3>
        <p className="text-[12px] text-[var(--tx2)]">Loading...</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] flex items-center gap-2 mb-4">
          <Icon name="image" className="w-[12px] h-[12px]" />
          Move Photos
        </h3>
        <p className="text-[12px] text-[var(--tx2)]">No photos uploaded yet. Your coordinator may add photos from the pre-move survey.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--brd)]">
        <h3 className="text-[14px] font-bold text-[var(--tx)] flex items-center gap-2">
          <Icon name="image" className="w-[12px] h-[12px]" />
          Photos ({photos.length})
        </h3>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg overflow-hidden border border-[var(--brd)] bg-[var(--bg)] aspect-[4/3] hover:border-[var(--gold)] transition-colors relative"
          >
            <img src={p.url} alt={p.caption || "Move photo"} className="w-full h-full object-cover" />
            {p.caption && (
              <div className="absolute bottom-1 left-1 right-1 text-[7px] font-bold uppercase tracking-wider bg-black/70 text-white px-2 py-1 rounded truncate">
                {p.caption}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
