"use client";

import { useEffect, useState, useCallback } from "react";

type CheckpointGroup = { checkpoint: string; label: string; photos: { id: string; url: string; takenAt: string; note: string | null }[] };

export default function MoveCrewPhotosSection({ moveId }: { moveId: string }) {
  const [groups, setGroups] = useState<CheckpointGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = useCallback(() => {
    fetch(`/api/admin/moves/${moveId}/crew-photos`)
      .then((r) => r.json())
      .then((d) => setGroups(d.byCheckpoint ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [moveId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    const interval = setInterval(fetchPhotos, 5000);
    return () => clearInterval(interval);
  }, [fetchPhotos]);

  if (loading) return <p className="text-[11px] text-[var(--tx3)]">Loading crew photos…</p>;
  if (groups.length === 0) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">
        Crew photos (by checkpoint)
      </h3>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.checkpoint}>
            <p className="text-[10px] font-semibold text-[var(--tx3)] mb-1.5">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.photos.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-16 h-16 rounded-lg overflow-hidden border border-[var(--brd)] bg-[var(--bg)] shrink-0 hover:border-[var(--gold)]/50 transition-colors"
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
