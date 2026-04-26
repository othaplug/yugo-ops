"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Check, X } from "@phosphor-icons/react";
import { PHOTO_ROOM_DEFS } from "@/lib/photo-survey/rooms";

type SurveyRow = {
  status: string;
  client_name: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
};

type LocalPhoto = { id: string; preview: string; path?: string; file?: File };

export default function PhotoSurveyClient({
  token,
  initialSurvey,
}: {
  token: string;
  initialSurvey: SurveyRow | null;
}) {
  const [survey, setSurvey] = useState<SurveyRow | null>(initialSurvey);
  const [roomPhotos, setRoomPhotos] = useState<Record<string, LocalPhoto[]>>({});
  const [specialNotes, setSpecialNotes] = useState("");
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(
    () => initialSurvey?.status === "submitted" || false,
  );
  const [error, setError] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const n = (survey?.client_name || "").trim();
    return n ? n.split(/\s+/)[0] || "there" : "there";
  }, [survey?.client_name]);

  const rooms = useMemo(
    () => (showAllRooms ? PHOTO_ROOM_DEFS : PHOTO_ROOM_DEFS.filter((r) => r.required)),
    [showAllRooms],
  );

  const totalPhotos = useMemo(() => {
    let n = 0;
    for (const p of Object.values(roomPhotos)) {
      n += p.length;
    }
    return n;
  }, [roomPhotos]);

  const handlePhotoUpload = useCallback(
    async (roomId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list?.length) return;
      setError(null);
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) continue;
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${roomId}-${Date.now()}-${Math.random()}`;
        const preview = URL.createObjectURL(file);
        setRoomPhotos((prev) => {
          const next = { ...prev, [roomId]: [...(prev[roomId] || [])] };
          const slot: LocalPhoto = { id, preview, file };
          next[roomId].push(slot);
          return next;
        });
        try {
          const fd = new FormData();
          fd.set("room_id", roomId);
          fd.set("file", file);
          const res = await fetch(`/api/surveys/${token}/upload`, {
            method: "POST",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          const path = String(data.path || "");
          setRoomPhotos((prev) => {
            const arr = [...(prev[roomId] || [])];
            const idx = arr.findIndex((x) => x.id === id);
            if (idx >= 0 && path) {
              arr[idx] = { ...arr[idx]!, path, preview, file };
            }
            return { ...prev, [roomId]: arr };
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
        }
      }
      e.target.value = "";
    },
    [token],
  );

  const removePhoto = useCallback((roomId: string, index: number) => {
    setRoomPhotos((prev) => {
      const arr = [...(prev[roomId] || [])];
      const [gone] = arr.splice(index, 1);
      if (gone?.preview && gone.preview.startsWith("blob:")) {
        URL.revokeObjectURL(gone.preview);
      }
      return { ...prev, [roomId]: arr };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (totalPhotos < 1) return;
    setSubmitting(true);
    setError(null);
    const uploaded: Record<string, string[]> = {};
    for (const [roomId, list] of Object.entries(roomPhotos)) {
      const paths: string[] = [];
      for (const p of list) {
        if (p.path) paths.push(p.path);
      }
      if (paths.length) uploaded[roomId] = paths;
    }
    if (Object.values(uploaded).flat().length < 1) {
      setError("Photos are still uploading. Try again in a moment.");
      setSubmitting(false);
      return;
    }
    try {
      const res = await fetch(`/api/surveys/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: uploaded,
          special_notes: specialNotes,
          total_photos: totalPhotos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setSubmitted(true);
      if (survey) {
        setSurvey({ ...survey, status: "submitted" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [roomPhotos, specialNotes, survey, token, totalPhotos]);

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#F9EDE4] flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">This link is not valid or has expired.</p>
      </div>
    );
  }

  if (submitted) {
    const coord = (survey.coordinator_name || "your coordinator").trim();
    const phone = (survey.coordinator_phone || "").replace(/\D/g, "");
    return (
      <div className="min-h-screen bg-[#F9EDE4] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(44, 62, 45, 0.1)" }}
          >
            <Check className="text-[#2C3E2D]" size={32} weight="bold" aria-hidden />
          </div>
          <h2 className="text-xl font-serif text-[#2B0416] mb-2">Photos received</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Thank you, {firstName}. Your coordinator {coord} will review your photos and follow up with
            your personalized quote.
          </p>
          {phone.length >= 10 ? (
            <p className="text-xs text-gray-500 mt-4">
              Questions? Call{" "}
              <a className="text-[#5C1A33] font-medium" href={`tel:${phone}`}>
                {survey.coordinator_phone}
              </a>
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-4">We will be in touch shortly.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9EDE4]">
      <div className="bg-[#2B0416] text-[#F9EDE4] px-6 py-8 text-center">
        <p
          className="text-sm font-bold tracking-[0.35em] uppercase text-[#F9EDE4]"
          style={{ fontFamily: "var(--font-body, sans-serif)" }}
        >
          YUGO
        </p>
        <p className="text-[11px] opacity-60 mt-1">The art of moving.</p>
      </div>

      <div className="max-w-md mx-auto px-6 py-8">
        <h1 className="text-xl font-serif text-[#2B0416] mb-2">
          Hi {firstName}, help us see your space
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          A few photos of each room help your coordinator plan the right move. No need to tidy or stage.
          We want to see your home as it is.
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          {rooms.map((room) => {
            const Icon = room.Icon;
            const list = roomPhotos[room.id] || [];
            return (
              <div
                key={room.id}
                className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="shrink-0 text-[#5C1A33]" size={22} weight="duotone" aria-hidden />
                    <p className="text-sm font-semibold text-[#2B0416] tracking-wide">{room.label}</p>
                  </div>
                  {list.length > 0 ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2C3E2D] bg-[#F4FAF4] px-2 py-0.5 rounded-full">
                      {list.length} photo{list.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>

                {list.length > 0 ? (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                    {list.map((photo, i) => (
                      <div key={photo.id} className="relative shrink-0 group">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={photo.preview}
                            alt=""
                            width={64}
                            height={64}
                            className="object-cover w-16 h-16"
                            unoptimized
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(room.id, i)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-[#5C1A33] text-white rounded-full flex items-center justify-center text-[10px] opacity-90 hover:opacity-100"
                          aria-label="Remove photo"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <label className="flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#5C1A33]/30 transition min-h-[48px]">
                  <span className="text-xs text-gray-500">
                    {list.length > 0 ? "Add more photos" : "Take or upload photos"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={(e) => void handlePhotoUpload(room.id, e)}
                    className="hidden"
                  />
                </label>
                {room.tip ? (
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">{room.tip}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {!showAllRooms ? (
          <button
            type="button"
            onClick={() => setShowAllRooms(true)}
            className="w-full mt-4 py-3 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-500 tracking-wide"
          >
            Add more rooms
          </button>
        ) : null}

        <div className="mt-6">
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 block mb-1">
            Anything we should know?
          </label>
          <textarea
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            placeholder="Heavy items, fragile pieces, access details..."
            className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none bg-white"
            rows={3}
            maxLength={4000}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || totalPhotos === 0}
          className="w-full mt-6 py-4 bg-[#2C3E2D] text-white rounded-xl text-[10px] font-bold tracking-[0.12em] uppercase disabled:opacity-30"
        >
          {submitting ? "Submitting…" : `Submit ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}`}
        </button>

        <p className="text-[10px] text-gray-400 text-center mt-3">
          Your photos are private and only used by your move coordinator to prepare your quote.
        </p>

        {survey.coordinator_phone ? (
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">Questions?</p>
            <a
              href={`tel:${String(survey.coordinator_phone).replace(/\D/g, "")}`}
              className="text-sm font-medium text-[#5C1A33] mt-1 inline-block"
            >
              {survey.coordinator_phone}
            </a>
            {survey.coordinator_name ? (
              <p className="text-[10px] text-gray-400 mt-1">{survey.coordinator_name}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
