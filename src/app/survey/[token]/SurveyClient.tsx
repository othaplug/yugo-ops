"use client";

import { useState, useCallback } from "react";
import { Camera, CaretRight, Check, Plus, X } from "@phosphor-icons/react";
import YugoLogo from "@/components/YugoLogo";

// Brand palette — explicit hex values (not theme tokens) so the page renders
// the same regardless of admin dark-mode tokens. This is a public client
// page; it shouldn't inherit operator-side themes.
const CREAM = "#F9EDE4";
const INK = "#2B0416";
const INK_MUTED = "rgba(43, 4, 22, 0.62)";
const INK_FAINT = "rgba(43, 4, 22, 0.42)";
const WINE = "#66143D";
const FOREST = "#2C3E2D";
const CARD = "#FFFFFF";
const HAIRLINE = "rgba(43, 4, 22, 0.12)";

type Room = { id: string; label: string };

/**
 * Fixed rooms shown in the survey. "Secondary room" replaces "Basement" for
 * apartment-likely move sizes (studio/1BR/2BR/partial) because most condo
 * clients don't have a basement and the label confuses them.
 */
function fixedRoomsForMoveSize(moveSize: string | null | undefined): Room[] {
  const m = (moveSize || "").toLowerCase().trim();
  let bedroomCount = 2;
  if (m === "studio" || m === "1br" || m === "partial") bedroomCount = 1;
  else if (m === "2br") bedroomCount = 2;
  else if (m === "3br" || m === "4br" || m === "5br_plus") bedroomCount = 3;

  // 3BR+ moves are more likely to involve a house with a basement.
  const isLargeHome = bedroomCount >= 3;
  const secondaryLabel = isLargeHome ? "Basement" : "Secondary room";

  const all: Room[] = [
    { id: "living_room", label: "Living room" },
    { id: "kitchen", label: "Kitchen" },
    { id: "primary_bedroom", label: "Primary bedroom" },
    { id: "bedroom_2", label: "Bedroom 2" },
    { id: "bedroom_3", label: "Bedroom 3" },
    // The API key stays "basement" so existing storage paths + admin filters
    // keep working; only the visible label changes.
    { id: "basement", label: secondaryLabel },
  ];
  return all.filter((r) => {
    if (r.id === "bedroom_2") return bedroomCount >= 2;
    if (r.id === "bedroom_3") return bedroomCount >= 3;
    return true;
  });
}

type CustomRoom = {
  /** Stable client-side key for React. */
  key: string;
  /** Label the user types — e.g. "Home office". Carried as a notes prefix. */
  label: string;
};

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
  const FIXED_ROOMS = fixedRoomsForMoveSize(moveSize);

  const [completed, setCompleted] = useState(alreadyCompleted);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  // Client-added "Additional Rooms" beyond the fixed list. Each one uploads
  // with API room="other" and a notes string of "{Label}: {note}" so the
  // admin can see what the client called it. We store labels in state so the
  // UI can render them with the same card style as the fixed rooms.
  const [customRooms, setCustomRooms] = useState<CustomRoom[]>([]);

  const first = clientName.trim().split(/\s+/)[0] || "there";

  const uploadFiles = useCallback(
    async (params: {
      uiKey: string;
      apiRoom: string;
      labelPrefix?: string;
      files: FileList | null;
    }) => {
      const { uiKey, apiRoom, labelPrefix, files } = params;
      if (!files?.length || completed) return;
      setBusyKey(uiKey);
      setMsg(null);
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("room", apiRoom);
          const raw = notes[uiKey]?.trim() ?? "";
          const merged = labelPrefix
            ? raw
              ? `${labelPrefix}: ${raw}`
              : labelPrefix
            : raw;
          if (merged) fd.append("notes", merged);
          const res = await fetch(`/api/survey/${encodeURIComponent(token)}`, {
            method: "POST",
            body: fd,
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            // Server returns { error, detail? }. When detail is present it's
            // a server-generated string (storage SDK error) — show both so
            // the client / coordinator can act on it instead of guessing.
            const head = typeof j.error === "string" ? j.error : "Upload failed";
            const tail =
              typeof j.detail === "string" && j.detail.trim()
                ? ` — ${j.detail.trim()}`
                : "";
            throw new Error(`${head}${tail}`);
          }
          setCounts((c) => ({ ...c, [uiKey]: (c[uiKey] || 0) + 1 }));
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusyKey(null);
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

  const addCustomRoom = () => {
    const key = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCustomRooms((rs) => [...rs, { key, label: "" }]);
  };

  const renameCustomRoom = (key: string, label: string) => {
    setCustomRooms((rs) => rs.map((r) => (r.key === key ? { ...r, label } : r)));
  };

  const removeCustomRoom = (key: string) => {
    setCustomRooms((rs) => rs.filter((r) => r.key !== key));
    setCounts((c) => {
      const next = { ...c };
      delete next[key];
      return next;
    });
    setNotes((n) => {
      const next = { ...n };
      delete next[key];
      return next;
    });
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: CREAM, color: INK }}
    >
      <div className="max-w-lg mx-auto px-4 py-10 pb-24">
        <header className="mb-8 text-center">
          <div className="flex justify-center mb-5">
            <YugoLogo size={22} variant="wine" onLightBackground />
          </div>
          <h1
            className="font-serif text-[28px] md:text-[32px] leading-tight tracking-tight mb-3"
            style={{ color: WINE }}
          >
            Help us prepare
          </h1>
          <p
            className="text-[13px] md:text-[14px] leading-relaxed"
            style={{ color: INK_MUTED }}
          >
            Hi {first} — quick photos from your phone help your crew plan the
            move. About two minutes.
          </p>
        </header>

        {completed && (
          <div
            className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px]"
            style={{
              background: "rgba(44, 62, 45, 0.08)",
              border: `1px solid rgba(44, 62, 45, 0.25)`,
              color: FOREST,
            }}
            role="status"
          >
            <Check size={20} weight="bold" className="shrink-0" />
            Photos submitted. Thank you!
          </div>
        )}

        {msg && (
          <p
            className="mb-4 text-[12px]"
            style={{ color: INK_MUTED }}
            role="status"
          >
            {msg}
          </p>
        )}

        <div className="space-y-4">
          {FIXED_ROOMS.map((r) => (
            <RoomCard
              key={r.id}
              label={r.label}
              uiKey={r.id}
              count={counts[r.id] ?? 0}
              note={notes[r.id] ?? ""}
              onNoteChange={(v) =>
                setNotes((n) => ({ ...n, [r.id]: v }))
              }
              onPickFiles={(files) =>
                void uploadFiles({
                  uiKey: r.id,
                  apiRoom: r.id,
                  files,
                })
              }
              busy={busyKey === r.id}
              disabled={completed || (busyKey !== null && busyKey !== r.id)}
            />
          ))}

          {customRooms.map((cr) => (
            <RoomCard
              key={cr.key}
              uiKey={cr.key}
              editableLabel
              labelValue={cr.label}
              onLabelChange={(v) => renameCustomRoom(cr.key, v)}
              onRemove={() => removeCustomRoom(cr.key)}
              count={counts[cr.key] ?? 0}
              note={notes[cr.key] ?? ""}
              onNoteChange={(v) =>
                setNotes((n) => ({ ...n, [cr.key]: v }))
              }
              onPickFiles={(files) =>
                void uploadFiles({
                  uiKey: cr.key,
                  apiRoom: "other",
                  labelPrefix: cr.label.trim() || "Other room",
                  files,
                })
              }
              busy={busyKey === cr.key}
              disabled={completed || (busyKey !== null && busyKey !== cr.key)}
            />
          ))}

          {!completed && (
            <button
              type="button"
              onClick={addCustomRoom}
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
              style={{
                background: "transparent",
                border: `1.5px dashed ${HAIRLINE}`,
                color: WINE,
              }}
              aria-label="Add another room"
            >
              <Plus size={16} weight="bold" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">
                Add another room
              </span>
            </button>
          )}
        </div>

        {!completed && (
          <button
            type="button"
            onClick={() => void finish()}
            className="mt-8 w-full py-4 rounded-xl text-[11px] font-bold uppercase tracking-[0.12em] flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{
              background: WINE,
              color: CREAM,
            }}
          >
            Submit photos
            <CaretRight size={16} weight="bold" aria-hidden />
          </button>
        )}

        <p
          className="mt-6 text-center text-[11px]"
          style={{ color: INK_FAINT }}
        >
          You can come back to this link later and add more photos.
        </p>
      </div>
    </div>
  );
}

function RoomCard({
  label,
  labelValue,
  editableLabel,
  uiKey,
  count,
  note,
  busy,
  disabled,
  onNoteChange,
  onPickFiles,
  onLabelChange,
  onRemove,
}: {
  label?: string;
  labelValue?: string;
  editableLabel?: boolean;
  uiKey: string;
  count: number;
  note: string;
  busy: boolean;
  disabled: boolean;
  onNoteChange: (v: string) => void;
  onPickFiles: (files: FileList | null) => void;
  onLabelChange?: (v: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: CARD,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        {editableLabel ? (
          <input
            type="text"
            placeholder="Name this room (e.g. Office)"
            value={labelValue ?? ""}
            onChange={(e) => onLabelChange?.(e.target.value)}
            disabled={disabled}
            className="flex-1 text-[12px] font-bold uppercase tracking-[0.1em] bg-transparent outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
            style={{ color: INK, caretColor: WINE }}
          />
        ) : (
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{ color: INK }}
          >
            {label}
          </h2>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {count > 0 && (
            <span className="text-[10px]" style={{ color: INK_FAINT }}>
              {count} photo{count === 1 ? "" : "s"}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label="Remove this room"
              className="p-1 rounded-md hover:opacity-70 transition-opacity"
              style={{ color: INK_FAINT }}
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        placeholder="Optional note for this room"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        disabled={disabled}
        className="w-full mb-3 px-3 py-2.5 rounded-lg text-[13px] outline-none transition-colors"
        style={{
          border: `1px solid ${HAIRLINE}`,
          background: CREAM,
          color: INK,
        }}
      />

      <label
        className="flex items-center justify-center gap-2 w-full py-3 rounded-lg cursor-pointer transition-colors"
        style={{
          border: `1.5px dashed ${HAIRLINE}`,
          color: INK,
        }}
      >
        <Camera size={18} weight="regular" />
        <span className="text-[12px] font-semibold">
          {busy ? "Uploading…" : count > 0 ? "Add more photos" : "Add photos"}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            onPickFiles(e.target.files);
            e.target.value = "";
          }}
          aria-label={`Add photos for ${label ?? labelValue ?? uiKey}`}
        />
      </label>
    </div>
  );
}
