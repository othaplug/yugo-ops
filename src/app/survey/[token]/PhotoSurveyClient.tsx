"use client";

import { useCallback, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import Image from "next/image"
import { Check, X } from "@phosphor-icons/react"
import YugoLogo from "@/components/YugoLogo"
import {
  getAdditionalPhotoRoomPool,
  getCorePhotoRoomIds,
  roomDefsForIds,
} from "@/lib/photo-survey/room-list"

type SurveyRow = {
  status: string;
  client_name: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
};

type LocalPhoto = { id: string; preview: string; path?: string; file?: File }

const setPhotoPathInAnyRoom = (
  prev: Record<string, LocalPhoto[]>,
  id: string,
  path: string,
  preview: string,
  file: File | undefined,
): Record<string, LocalPhoto[]> => {
  for (const rid of Object.keys(prev)) {
    const arr = prev[rid]
    if (!arr?.length) continue
    const idx = arr.findIndex((x) => x.id === id)
    if (idx < 0) continue
    const next = { ...prev }
    const newArr = [...(next[rid] || [])]
    newArr[idx] = { ...newArr[idx]!, path, preview, file }
    next[rid] = newArr
    return next
  }
  return prev
}

const uploadOnePhoto = async (
  token: string,
  roomId: string,
  file: File,
): Promise<string> => {
  const fd = new FormData()
  fd.set("room_id", roomId)
  fd.set("file", file)
  const res = await fetch(`/api/surveys/${token}/upload`, {
    method: "POST",
    body: fd,
    credentials: "same-origin",
  })
  let data: { path?: string; error?: string } = {}
  try {
    data = (await res.json()) as { path?: string; error?: string }
  } catch {
    throw new Error("The server could not save this photo. Check your connection and try again.")
  }
  if (!res.ok) throw new Error(data.error || "Upload failed")
  const path = String(data.path || "")
  if (!path) throw new Error("Upload did not return a file path. Please try again.")
  return path
}

export default function PhotoSurveyClient({
  token,
  initialSurvey,
  moveSize,
}: {
  token: string
  initialSurvey: SurveyRow | null
  moveSize: string | null
}) {
  const [survey, setSurvey] = useState<SurveyRow | null>(initialSurvey);
  const [roomPhotos, setRoomPhotos] = useState<Record<string, LocalPhoto[]>>({});
  const [specialNotes, setSpecialNotes] = useState("");
  /** How many one-at-a-time optional rooms the client has added after the core list. */
  const [additionalRoomSteps, setAdditionalRoomSteps] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(
    () => initialSurvey?.status === "submitted" || false,
  );
  const [error, setError] = useState<string | null>(null);

  const firstName = useMemo(() => {
    const n = (survey?.client_name || "").trim();
    return n ? n.split(/\s+/)[0] || "there" : "there";
  }, [survey?.client_name]);

  const { additionalRoomPool, rooms } = useMemo(() => {
    const additionalRoomPool = getAdditionalPhotoRoomPool(moveSize);
    const core = getCorePhotoRoomIds(moveSize);
    const extraIds = additionalRoomPool.slice(0, additionalRoomSteps);
    return {
      additionalRoomPool,
      rooms: roomDefsForIds([...core, ...extraIds]),
    };
  }, [moveSize, additionalRoomSteps]);

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
        flushSync(() => {
          setRoomPhotos((prev) => {
            const next = { ...prev, [roomId]: [...(prev[roomId] || [])] };
            const slot: LocalPhoto = { id, preview, file };
            next[roomId].push(slot);
            return next;
          });
        });
        const removeThisPhoto = () => {
          if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
          setRoomPhotos((prev) => {
            const arr = (prev[roomId] || []).filter((p) => p.id !== id);
            return { ...prev, [roomId]: arr };
          });
        };
        try {
          const path = await uploadOnePhoto(token, roomId, file);
          setRoomPhotos((prev) => setPhotoPathInAnyRoom(prev, id, path, preview, file));
        } catch (err) {
          removeThisPhoto();
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
    try {
      const uploaded: Record<string, string[]> = {};
      for (const [roomId, list] of Object.entries(roomPhotos)) {
        const paths: string[] = [];
        for (const p of list) {
          if (p.path) {
            paths.push(p.path);
            continue;
          }
          if (p.file) {
            const path = await uploadOnePhoto(token, roomId, p.file);
            paths.push(path);
            setRoomPhotos((prev) =>
              setPhotoPathInAnyRoom(prev, p.id, path, p.preview, p.file),
            );
          } else {
            throw new Error(
              "A photo is missing on our side. Please remove that image and add it again, then submit.",
            );
          }
        }
        if (paths.length) uploaded[roomId] = paths;
      }
      if (Object.values(uploaded).flat().length < 1) {
        setError(
          "We could not save your photos. Check your connection, then try again or add the images again.",
        );
        return;
      }
      const res = await fetch(`/api/surveys/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: uploaded,
          special_notes: specialNotes,
          total_photos: totalPhotos,
        }),
        credentials: "same-origin",
      });
      let data: { error?: string } = {};
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        if (!res.ok) {
          throw new Error("Submit failed. Check your connection and try again.");
        }
        setSubmitted(true);
        if (survey) {
          setSurvey({ ...survey, status: "submitted" });
        }
        return;
      }
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
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 gap-6">
        <YugoLogo size={24} variant="wine" onLightBackground />
        <p className="text-sm text-[#3d3d3d] text-center">This link is not valid or has expired.</p>
      </div>
    )
  }

  if (submitted) {
    const coord = (survey.coordinator_name || "your coordinator").trim();
    const phone = (survey.coordinator_phone || "").replace(/\D/g, "");
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6">
        <div className="mb-8">
          <YugoLogo size={24} variant="wine" onLightBackground />
        </div>
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(44, 62, 45, 0.12)" }}
          >
            <Check className="text-[#2C3E2D]" size={32} weight="bold" aria-hidden />
          </div>
          <h2 className="text-xl font-serif text-[#1a1a1a] mb-2">Photos received</h2>
          <p className="text-sm text-[#3d3d3d] leading-relaxed">
            Thank you, {firstName}. Your coordinator {coord} will review your photos and follow up with
            your personalized quote.
          </p>
          {phone.length >= 10 ? (
            <p className="text-xs text-[#5a5a5a] mt-4">
              Questions? Call{" "}
              <a className="text-[#2C3E2D] font-semibold underline-offset-2 hover:underline" href={`tel:${phone}`}>
                {survey.coordinator_phone}
              </a>
            </p>
          ) : (
            <p className="text-xs text-[#5a5a5a] mt-4">We will be in touch shortly.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <header className="border-b border-[#2C3E2D]/10 bg-[#FFFBF7] px-6 py-7">
        <div className="max-w-md mx-auto flex justify-center">
          <YugoLogo size={28} variant="wine" onLightBackground />
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 py-8">
        <h1 className="text-xl font-serif text-[#1a1a1a] mb-2">
          Hi {firstName}, help us see your space
        </h1>
        <p className="text-sm text-[#3d3d3d] leading-relaxed mb-6">
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
            const list = roomPhotos[room.id] || []
            return (
              <div
                key={room.id}
                className="bg-[#FFFBF7] rounded-xl border border-[#2C3E2D]/12 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#1a1a1a] tracking-wide min-w-0">
                    {room.label}
                  </p>
                  {list.length > 0 ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2C3E2D] bg-[#E8F2E8] px-2 py-0.5 rounded-full">
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
                          className="absolute -top-1 -right-1 w-5 h-5 bg-[#2C3E2D] text-white rounded-full flex items-center justify-center text-[10px] opacity-95 hover:opacity-100"
                          aria-label="Remove photo"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <label className="flex items-center justify-center gap-2 py-3.5 px-2 border-2 border-dashed border-[#2C3E2D]/30 rounded-lg cursor-pointer bg-white hover:border-[#2C3E2D]/50 hover:bg-[#FAF7F2]/80 transition min-h-[48px]">
                  <span className="text-xs font-semibold text-[#2C3E2D]">
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
                  <p className="text-[11px] text-[#5a5a5a] mt-2 leading-relaxed">{room.tip}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {additionalRoomSteps < additionalRoomPool.length ? (
          <button
            type="button"
            onClick={() => setAdditionalRoomSteps((n) => n + 1)}
            className="w-full mt-4 py-3 border-2 border-dashed border-[#2C3E2D]/25 rounded-xl text-xs font-semibold text-[#2C3E2D] tracking-wide bg-white hover:border-[#2C3E2D]/40"
          >
            Additional room
          </button>
        ) : null}

        <div className="mt-6">
          <label
            htmlFor="photo-survey-notes"
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2C3E2D] block mb-1.5"
          >
            Anything we should know?
          </label>
          <textarea
            id="photo-survey-notes"
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            placeholder="Heavy items, fragile pieces, access details..."
            className="w-full p-3 border border-[#2C3E2D]/20 rounded-xl text-sm text-[#1a1a1a] resize-none bg-white placeholder:text-[#6b6b6b] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2C3E2D]/25 focus:border-[#2C3E2D]/40"
            rows={3}
            maxLength={4000}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || totalPhotos === 0}
          className="w-full mt-6 py-4 rounded-xl text-[10px] font-bold tracking-[0.12em] uppercase transition-colors bg-[#2C3E2D] text-white hover:bg-[#243527] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E2D] disabled:bg-neutral-200 disabled:text-neutral-700 disabled:hover:bg-neutral-200"
        >
          {submitting ? "Submitting…" : `Submit ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}`}
        </button>

        <p className="text-[10px] text-[#5a5a5a] text-center mt-3">
          Your photos are private and only used by your move coordinator to prepare your quote.
        </p>

        {survey.coordinator_phone ? (
          <div className="mt-8 text-center">
            <p className="text-xs text-[#5a5a5a]">Questions?</p>
            <a
              href={`tel:${String(survey.coordinator_phone).replace(/\D/g, "")}`}
              className="text-sm font-semibold text-[#2C3E2D] mt-1 inline-block underline-offset-2 hover:underline"
            >
              {survey.coordinator_phone}
            </a>
            {survey.coordinator_name ? (
              <p className="text-[10px] text-[#6b6b6b] mt-1">{survey.coordinator_name}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
