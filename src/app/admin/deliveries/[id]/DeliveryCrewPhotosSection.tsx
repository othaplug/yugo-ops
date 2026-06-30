"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Upload, ImageSquare } from "@phosphor-icons/react";
import { useToast } from "@/app/admin/components/Toast";

type CheckpointGroup = {
  checkpoint: string;
  label: string;
  photos: { id: string; url: string; takenAt: string; note: string | null }[];
};

export default function DeliveryCrewPhotosSection({ deliveryId }: { deliveryId: string }) {
  const [groups, setGroups] = useState<CheckpointGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchPhotos = useCallback(() => {
    fetch(`/api/admin/deliveries/${deliveryId}/crew-photos`)
      .then((r) => r.json())
      .then((d) => setGroups(d.byCheckpoint ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [deliveryId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    const interval = setInterval(fetchPhotos, 5000);
    return () => clearInterval(interval);
  }, [fetchPhotos]);

  /**
   * Admin upload (2026-06-30). Posts a multipart form to the same
   * endpoint; the backend writes to job_photos with
   * checkpoint=admin_upload so the uploaded image renders under its
   * own "Admin uploads" group on the next refresh.
   *
   * Loops over multi-select files sequentially so an error on one
   * doesn't abort the others — the toast only surfaces the first
   * failure to keep things terse.
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    let firstError: string | null = null;
    let okCount = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(
          `/api/admin/deliveries/${deliveryId}/crew-photos`,
          { method: "POST", body: formData },
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          firstError = firstError ?? (data.error || "Upload failed");
        } else {
          okCount += 1;
        }
      } catch {
        firstError = firstError ?? "Upload failed";
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (okCount > 0) {
      toast(
        okCount === 1 ? "Photo uploaded" : `${okCount} photos uploaded`,
        "check",
      );
      fetchPhotos();
    }
    if (firstError) toast(firstError, "alertTriangle");
  };

  const uploadButton = (
    <label
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
        uploading
          ? "bg-[var(--bg)] text-[var(--tx3)] opacity-60 pointer-events-none"
          : "bg-[var(--gold)]/10 text-[var(--accent-text)] hover:bg-[var(--gold)]/20"
      }`}
    >
      <Upload className="w-3 h-3" />
      {uploading ? "Uploading…" : "Upload photo"}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleUpload}
        disabled={uploading}
        multiple
        className="hidden"
      />
    </label>
  );

  if (loading) {
    return <p className="text-[11px] text-[var(--tx3)]">Loading crew photos…</p>;
  }

  // Empty state — always render the uploader so admins can add photos
  // even when crew didn't capture any on-site (operator decision
  // 2026-06-30 after DLV-30353 review).
  if (groups.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--bg)] flex items-center justify-center">
              <ImageSquare className="w-4 h-4 text-[var(--tx3)]" />
            </div>
            <div>
              <p className="text-[12px] font-medium text-[var(--tx2)]">
                No photos yet
              </p>
              <p className="text-[10px] text-[var(--tx3)]">
                Crew photos populate during the job. You can add more here.
              </p>
            </div>
          </div>
          {uploadButton}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)]">
          Crew photos (by checkpoint)
        </h3>
        {uploadButton}
      </div>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
