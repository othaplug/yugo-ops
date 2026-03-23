"use client";

import { useState, useRef } from "react";
import { Camera, Image as ImageIcon, X, Check, Plus, Warning } from "@phosphor-icons/react";
import { WINE, FOREST, GOLD } from "@/lib/client-theme";

const CREAM = "#FAF7F2";

const ROOM_LABELS = [
  { key: "living_room", label: "Living Room" },
  { key: "kitchen", label: "Kitchen" },
  { key: "primary_bedroom", label: "Primary Bedroom" },
  { key: "bedroom_2", label: "Bedroom 2" },
  { key: "basement", label: "Basement" },
  { key: "garage", label: "Garage" },
  { key: "hallway", label: "Hallway / Entrance" },
  { key: "other", label: "Other" },
];

interface RoomPhoto {
  key: string;
  label: string;
  dataUrl?: string;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string;
}

interface Props {
  moveId: string;
  token: string;
  initialPhotos?: Record<string, { url: string; uploadedAt: string }>;
}

export default function ClientRoomPhotoCapture({ moveId, token, initialPhotos = {} }: Props) {
  const [photos, setPhotos] = useState<RoomPhoto[]>(
    ROOM_LABELS.map((r) => ({
      ...r,
      dataUrl: initialPhotos[r.key]?.url,
      uploaded: !!initialPhotos[r.key],
    }))
  );
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadedCount = photos.filter((p) => p.uploaded).length;
  const total = photos.length;

  function handleFileChange(roomKey: string, file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setPhotos((prev) =>
        prev.map((p) => (p.key === roomKey ? { ...p, error: "Photo too large (max 10 MB)" } : p))
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos((prev) =>
        prev.map((p) => (p.key === roomKey ? { ...p, dataUrl: reader.result as string, uploading: true, error: undefined } : p))
      );
      uploadPhoto(roomKey, file);
    };
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(roomKey: string, file: File) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("room", roomKey);

      const res = await fetch(`/api/track/moves/${moveId}/room-photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPhotos((prev) =>
          prev.map((p) => (p.key === roomKey ? { ...p, uploading: false, error: err.error || "Upload failed" } : p))
        );
        return;
      }

      setPhotos((prev) =>
        prev.map((p) => (p.key === roomKey ? { ...p, uploading: false, uploaded: true, error: undefined } : p))
      );
    } catch {
      setPhotos((prev) =>
        prev.map((p) => (p.key === roomKey ? { ...p, uploading: false, error: "Network error" } : p))
      );
    }
  }

  function removePhoto(roomKey: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.key === roomKey ? { ...p, dataUrl: undefined, uploaded: false, error: undefined } : p))
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${FOREST}12`, background: "#fff" }}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-4 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${GOLD}15` }}
          >
            <Camera size={18} color={GOLD} weight="fill" />
          </div>
          <div>
            <div className="text-[13px] font-bold" style={{ color: FOREST }}>
              Room Photos
            </div>
            <div className="text-[11px] opacity-50 mt-0.5" style={{ color: FOREST }}>
              {uploadedCount === 0
                ? "Help your crew prepare — optional"
                : `${uploadedCount} of ${total} rooms captured`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {uploadedCount > 0 && (
            <div
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${GOLD}15`, color: WINE }}
            >
              {uploadedCount}/{total}
            </div>
          )}
          <div style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
            <Camera size={14} color={`${FOREST}40`} />
          </div>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: `${FOREST}60` }}>
            Take a quick photo of each room before the move. This helps your crew plan the truck load and reduces surprises.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {photos.map((room) => (
              <div
                key={room.key}
                className="relative rounded-xl overflow-hidden border"
                style={{
                  borderColor: room.uploaded ? `${GOLD}30` : `${FOREST}12`,
                  background: room.dataUrl ? "transparent" : `${FOREST}04`,
                  aspectRatio: "4/3",
                }}
              >
                {room.dataUrl ? (
                  <>
                    {/* Preview */}
                    <img
                      src={room.dataUrl}
                      alt={room.label}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay controls */}
                    <div className="absolute inset-0 flex flex-col justify-between p-2">
                      <div className="flex justify-between items-start">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                        >
                          {room.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhoto(room.key)}
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.5)" }}
                        >
                          <X size={10} color="#fff" weight="bold" />
                        </button>
                      </div>
                      <div className="flex justify-end">
                        {room.uploading && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
                          >
                            Uploading…
                          </span>
                        )}
                        {room.uploaded && !room.uploading && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: "#2E7D32" }}
                          >
                            <Check size={10} color="#fff" weight="bold" />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Empty state — tap to capture */
                  <label
                    className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-2"
                    style={{ minHeight: 90 }}
                  >
                    <input
                      ref={(el) => { fileInputRefs.current[room.key] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileChange(room.key, e.target.files?.[0] ?? null)}
                    />
                    <Plus size={18} color={`${FOREST}30`} weight="bold" />
                    <span className="text-[10px] font-semibold mt-1.5 text-center leading-tight" style={{ color: `${FOREST}50` }}>
                      {room.label}
                    </span>
                    {room.error && (
                      <span className="text-[9px] mt-1 text-center" style={{ color: WINE }}>
                        {room.error}
                      </span>
                    )}
                  </label>
                )}
              </div>
            ))}
          </div>

          {uploadedCount >= 4 && (
            <div
              className="flex items-start gap-2.5 rounded-xl p-3 mt-2"
              style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}
            >
              <Check size={14} color={GOLD} weight="bold" className="mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed" style={{ color: FOREST }}>
                Great job! Your crew has been notified and will review these before arrival.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
