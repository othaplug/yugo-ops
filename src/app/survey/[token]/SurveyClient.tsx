"use client";

import { useState, useCallback } from "react";
import { Camera, CaretRight, Check } from "@phosphor-icons/react";

type Room = { id: string; label: string };

const ALL_ROOMS: Room[] = [
  { id: "living_room", label: "Living room" },
  { id: "kitchen", label: "Kitchen" },
  { id: "primary_bedroom", label: "Primary bedroom" },
  { id: "bedroom_2", label: "Bedroom 2" },
  { id: "bedroom_3", label: "Bedroom 3" },
  { id: "basement", label: "Basement" },
  { id: "other", label: "Other" },
];

/**
 * Bedroom count by move size. Studio and 1BR show only the primary; 2BR adds
 * Bedroom 2; 3BR+ shows all three. Living room, kitchen, basement, and "other"
 * are always shown so the client can document anything we didn't anticipate.
 */
function roomsForMoveSize(moveSize: string | null | undefined): Room[] {
  const m = (moveSize || "").toLowerCase().trim();
  let bedroomCount = 2;
  if (m === "studio" || m === "1br" || m === "partial") bedroomCount = 1;
  else if (m === "2br") bedroomCount = 2;
  else if (m === "3br" || m === "4br" || m === "5br_plus") bedroomCount = 3;

  return ALL_ROOMS.filter((r) => {
    if (r.id === "bedroom_2") return bedroomCount >= 2;
    if (r.id === "bedroom_3") return bedroomCount >= 3;
    return true;
  });
}

export default function SurveyClient({
  token,
  clientName,
  alreadyCompleted,
  moveSize,
}: {
  token: string;
  clientName: string;
  alreadyCompleted: boolean;
  /** Optional — when set, the bedroom slots are filtered to match the move. */
  moveSize?: string | null;
}) {
  const ROOMS = roomsForMoveSize(moveSize);
  const [completed, setCompleted] = useState(alreadyCompleted);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const first = clientName.trim().split(/\s+/)[0] || "there";

  const onPick = useCallback(
    async (roomId: string, files: FileList | null) => {
      if (!files?.length || completed) return;
      setBusyRoom(roomId);
      setMsg(null);
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("room", roomId);
          const n = notes[roomId]?.trim();
          if (n) fd.append("notes", n);
          const res = await fetch(`/api/survey/${encodeURIComponent(token)}`, {
            method: "POST",
            body: fd,
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
          }
          setCounts((c) => ({ ...c, [roomId]: (c[roomId] || 0) + 1 }));
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusyRoom(null);
      }
    },
    [token, notes, completed],
  );

  const finish = useCallback(async () => {
    try {
      const res = await fetch(`/api/survey/${encodeURIComponent(token)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      if (!res.ok) throw new Error("Could not mark complete");
      setCompleted(true);
      setMsg("Thank you — your coordinator will review your photos.");
    } catch {
      setMsg("Could not finalize — try again.");
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)]">
      <div className="max-w-lg mx-auto px-4 py-8 pb-20">
        <header className="mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-2">
            Yugo
          </p>
          <h1 className="font-hero text-2xl font-bold text-[#5C1A33] mb-2">
            Help us prepare
          </h1>
          <p className="text-[13px] text-[var(--tx2)] leading-relaxed">
            Hi {first} — quick photos from your phone help your crew plan the move.
          </p>
        </header>

        {completed && (
          <div
            className="mb-6 flex items-center gap-2 rounded-xl border border-[#2C3E2D]/25 bg-[#2C3E2D]/8 px-4 py-3 text-[13px] text-[var(--tx)]"
            role="status"
          >
            <Check size={20} weight="bold" className="shrink-0" />
            Photos submitted. Thank you!
          </div>
        )}

        {msg && (
          <p className="mb-4 text-[12px] text-[var(--tx2)]" role="status">
            {msg}
          </p>
        )}

        <div className="space-y-4">
          {ROOMS.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tx)]">
                  {r.label}
                </h2>
                {counts[r.id] ? (
                  <span className="text-[10px] text-[var(--tx3)]">{counts[r.id]} photo(s)</span>
                ) : null}
              </div>
              <input
                type="text"
                placeholder="Optional note for this room"
                value={notes[r.id] || ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                disabled={completed}
                className="w-full mb-3 px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none"
              />
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-[var(--brd)] cursor-pointer hover:border-[#2C3E2D]/40 transition-colors">
                <Camera size={20} className="text-[var(--tx)]" />
                <span className="text-[12px] font-semibold text-[var(--tx)]">
                  {busyRoom === r.id ? "Uploading…" : "Add photos"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  disabled={completed || busyRoom !== null}
                  onChange={(e) => {
                    void onPick(r.id, e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        {!completed && (
          <button
            type="button"
            onClick={() => void finish()}
            className="mt-8 w-full py-3.5 rounded-lg border border-[#2C3E2D] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx)] bg-transparent hover:bg-[#2C3E2D]/6 transition-colors flex items-center justify-center gap-2"
          >
            Submit photos
            <CaretRight size={16} weight="bold" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
