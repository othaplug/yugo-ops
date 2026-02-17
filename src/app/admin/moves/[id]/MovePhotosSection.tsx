"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";

type Photo = { id: string; url: string; caption: string | null };

export default function MovePhotosSection({ moveId }: { moveId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchPhotos = () => {
    fetch(`/api/admin/moves/${moveId}/photos`)
      .then((r) => r.json())
      .then((data) => setPhotos(data.photos ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPhotos();
  }, [moveId]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    fetch(`/api/admin/moves/${moveId}/photos`, {
      method: "POST",
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        fetchPhotos();
      })
      .finally(() => {
        setUploading(false);
        e.target.value = "";
      });
  };

  const handleDelete = (photoId: string) => {
    if (!confirm("Remove this photo?")) return;
    fetch(`/api/admin/moves/${moveId}/photos/${photoId}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        fetchPhotos();
      });
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">
        Move photos
      </h3>
      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] cursor-pointer disabled:opacity-50 transition-colors">
              <Plus className="w-[11px] h-[11px]" />
              {uploading ? "Uploading…" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
          {photos.length === 0 ? (
            <p className="text-[11px] text-[var(--tx3)]">No photos yet. Add photos for the client portal.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative group rounded-lg overflow-hidden border border-[var(--brd)]/50 aspect-square bg-[var(--bg)]">
                  <img src={p.url} alt={p.caption || ""} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--red)]"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-[11px] h-[11px]" />
                  </button>
                  {p.caption && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-[9px] text-white truncate">
                      {p.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
