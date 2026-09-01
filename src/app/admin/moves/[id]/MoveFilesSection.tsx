"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  FileText,
  Image,
  X,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  ArrowSquareOut as ExternalLink,
  ArrowsClockwise as RefreshCw,
  Trash as Trash2,
  Warning,
} from "@phosphor-icons/react";

import { useToast } from "../../components/Toast";
import { canRegenerateMoveDocuments } from "@/lib/move-status";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileEntry = {
  id: string;
  url: string;
  name: string;
  type: "image" | "pdf" | "other";
  badge: "pod" | "photo" | "doc" | "upload";
  date: string;
  caption?: string | null;
  source?: string;
  /** When true, show delete control and call onDelete(id) when requested */
  deletable?: boolean;
};

type SignOffData = {
  signed_by?: string;
  signed_at?: string;
  /** data:image PNG from sign-off pad */
  signature_data_url?: string | null;
  satisfaction_rating?: number | null;
  nps_score?: number | null;
  feedback_note?: string | null;
  escalation_triggered?: boolean;
  escalation_reason?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  try {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function isImage(url: string, type?: string) {
  if (type && type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic)(\?|$)/i.test(url);
}

function isPdf(url: string, type?: string) {
  if (type && type === "application/pdf") return true;
  return /\.pdf(\?|$)/i.test(url);
}

const BADGE_STYLES: Record<string, string> = {
  pod: "text-[var(--tx)] dark:text-[#A8C4A9]",
  photo: "text-[#1B4332] dark:text-emerald-300",
  doc: "text-blue-700 dark:text-sky-300",
  upload: "text-[var(--tx2)]",
};

const BADGE_LABELS: Record<string, string> = {
  pod: "PoD",
  photo: "Photo",
  doc: "Doc",
  upload: "Uploaded",
};

// ─── Photo lightbox (multi-photo, with keyboard nav + counter) ──────────────

/**
 * Replaces the single-image lightbox with a real photo viewer:
 *   - Photo counter (1 / 9)
 *   - Prev / next arrow buttons (skipped when at the ends)
 *   - Keyboard nav: ←  →  Esc
 *   - Thumbnail strip along the bottom
 *   - Backdrop click-to-close + dedicated X close
 *   - object-contain on the main image so portrait phone photos don't
 *     overflow a landscape viewport.
 */
function PhotoLightbox({
  files,
  index,
  onClose,
  onIndex,
}: {
  files: FileEntry[];
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const current = files[index];

  /**
   * Zoom + pan state. `zoom` is a multiplier on the natural fit-to-
   * screen size (1 = fit, MAX_ZOOM cap keeps performance sane). `pan`
   * is a translation in stage pixels applied to the image element via
   * CSS transform.
   *
   * The critical math is in the wheel/pinch handler: when zoom changes
   * we adjust pan so the pixel under the cursor stays put. Otherwise
   * zooming feels like scrolling — the image jumps around.
   */
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<
    | { pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
    | null
  >(null);
  const pinchStateRef = useRef<
    | { pointers: Map<number, { x: number; y: number }>; startDist: number; startZoom: number; centerX: number; centerY: number }
    | null
  >(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, files.length, onClose, onIndex]);

  // Reset zoom + pan whenever the photo changes — nothing worse than
  // paging to a new photo and having it appear pre-zoomed to a random
  // spot the last photo was framed at.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  // Trackpad pinch and mouse wheel both dispatch `wheel` events (pinch
  // sets ctrlKey=true on Chrome/Safari). Attach as non-passive so we
  // can preventDefault the page zoom that Chrome otherwise applies.
  // React onWheel is passive, so we attach through a ref.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setZoom((prevZoom) => {
        const delta = -e.deltaY * (e.ctrlKey ? 0.02 : 0.005);
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom + delta * prevZoom));
        if (nextZoom === prevZoom) return prevZoom;
        setPan((prevPan) => {
          if (nextZoom <= MIN_ZOOM) return { x: 0, y: 0 };
          const ratio = nextZoom / prevZoom;
          return {
            x: cx - (cx - prevPan.x) * ratio,
            y: cy - (cy - prevPan.y) * ratio,
          };
        });
        return nextZoom;
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Ignore modifier + right clicks.
    if (e.button !== 0 && e.pointerType !== "touch") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // Two-finger touch → pinch. Track both pointers and the starting
    // distance so we can compute a zoom ratio in pointermove.
    if (e.pointerType === "touch" && pinchStateRef.current) {
      pinchStateRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchStateRef.current.pointers.size >= 2) {
        const [a, b] = Array.from(pinchStateRef.current.pointers.values());
        pinchStateRef.current.startDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStateRef.current.startZoom = zoom;
        pinchStateRef.current.centerX = (a.x + b.x) / 2;
        pinchStateRef.current.centerY = (a.y + b.y) / 2;
      }
      return;
    }
    if (e.pointerType === "touch") {
      pinchStateRef.current = {
        pointers: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]),
        startDist: 0,
        startZoom: zoom,
        centerX: e.clientX,
        centerY: e.clientY,
      };
      return;
    }
    // Mouse: only pan when zoomed in; otherwise let click-outside close.
    if (zoom <= MIN_ZOOM) return;
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Touch pinch — two active pointers.
    if (e.pointerType === "touch" && pinchStateRef.current) {
      const state = pinchStateRef.current;
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size < 2 || state.startDist === 0) return;
      const [a, b] = Array.from(state.pointers.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, (state.startZoom * dist) / state.startDist),
      );
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const cx = state.centerX - rect.left - rect.width / 2;
      const cy = state.centerY - rect.top - rect.height / 2;
      setZoom((prevZoom) => {
        if (nextZoom === prevZoom) return prevZoom;
        setPan((prevPan) => {
          if (nextZoom <= MIN_ZOOM) return { x: 0, y: 0 };
          const ratio = nextZoom / prevZoom;
          return {
            x: cx - (cx - prevPan.x) * ratio,
            y: cy - (cy - prevPan.y) * ratio,
          };
        });
        return nextZoom;
      });
      return;
    }
    // Mouse pan while zoomed.
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setPan({
      x: drag.startPanX + (e.clientX - drag.startX),
      y: drag.startPanY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && pinchStateRef.current) {
      pinchStateRef.current.pointers.delete(e.pointerId);
      if (pinchStateRef.current.pointers.size === 0) {
        pinchStateRef.current = null;
      }
      return;
    }
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    // Double-click toggles between fit (1x) and a comfortable read-in
    // zoom (2.5x) centered on the point clicked. Faster than
    // wheel-scrolling to the same zoom every time.
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    if (zoom > MIN_ZOOM + 0.01) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      const target = 2.5;
      setZoom(target);
      setPan({ x: cx - cx * target, y: cy - cy * target });
    }
  };

  const isZoomed = zoom > MIN_ZOOM + 0.01;

  if (!current) return null;

  // Portal to document.body so the fixed positioning + viewport sizing
  // always resolve against the real viewport. Rendering the lightbox
  // in place (as we did before) meant that any transformed / filtered
  // / will-change ancestor on the admin move-detail page (tabs,
  // motion.divs, backdrop-blur containers) trapped `fixed inset-0`
  // inside itself — so `max-h-full` computed against the ancestor's
  // grown-with-content height instead of the viewport, and iPhone
  // portrait photos rendered at natural (3000+ px tall) size. This is
  // the exact "photos bigger than the screen, forces scroll" bug the
  // operator flagged.
  //
  // Also lock body scroll while the lightbox is open — otherwise
  // wheel/trackpad events bleed through to the page below and the
  // admin content scrolls while the operator's browsing photos.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[99999] flex flex-col bg-black/90 backdrop-blur-sm"
      style={{ height: "100dvh", width: "100vw", overflow: "hidden" }}
      onClick={() => {
        // Backdrop-close only makes sense at fit-to-screen. When the
        // user is zoomed in and clicks-drags around, a click on the
        // backdrop-that-wasn't-really-backdrop shouldn't close. Reset
        // to fit first — second click closes.
        if (isZoomed) {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else {
          onClose();
        }
      }}
    >
      {/* Header strip — caption + counter + close */}
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 bg-black/60 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-[12px] font-medium truncate">
            {current.caption || current.name || "Photo"}
          </p>
          <p className="text-[10px] text-white/70 mt-0.5">{formatShort(current.date)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isZoomed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] text-white/90 tabular-nums"
              aria-label="Reset zoom"
              title="Reset zoom (or double-click the image)"
            >
              {Math.round(zoom * 100)}%
            </button>
          )}
          <span className="text-[11px] text-white/80 tabular-nums">
            {index + 1} / {files.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image stage — flex-1 so it grows to fill the space between header
          and thumbnail strip. `min-h-0` lets the child img shrink correctly
          inside a flex column (without it Tailwind's default min-height
          keeps tall portraits from contracting). `overflow: hidden` on the
          stage clamps any residual overflow from the zoomed image.
          touch-action: none disables the browser's native pinch-zoom so
          our custom pinch handler owns two-finger gestures cleanly. */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 flex items-center justify-center px-4 py-4"
        style={{
          overflow: "hidden",
          touchAction: "none",
          cursor: isZoomed ? (dragStateRef.current ? "grabbing" : "grab") : "zoom-in",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <img
          src={current.url}
          alt={current.caption || current.name || "Photo"}
          className="rounded-xl shadow-2xl select-none"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragStateRef.current || pinchStateRef.current ? "none" : "transform 120ms ease-out",
            willChange: "transform",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitUserDrag: "none",
          } as React.CSSProperties}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Prev arrow */}
        {index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index - 1);
            }}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-2xl leading-none"
          >
            ‹
          </button>
        )}
        {/* Next arrow */}
        {index < files.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex(index + 1);
            }}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-2xl leading-none"
          >
            ›
          </button>
        )}
      </div>

      {/* Thumbnail strip — sits in the flex column, doesn't overlap the image */}
      {files.length > 1 && (
        <div
          className="px-4 py-3 bg-black/60 overflow-x-auto shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 justify-center min-w-min">
            {files.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onIndex(i)}
                className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition ${
                  i === index
                    ? "border-white opacity-100"
                    : "border-transparent opacity-60 hover:opacity-90"
                }`}
                aria-label={`Photo ${i + 1}`}
              >
                {f.type === "image" ? (
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-white/60 text-[9px]">
                    PDF
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

// ─── Collapsible group ────────────────────────────────────────────────────────

function FileGroup({
  label,
  borderColor,
  files,
  /** When set, shown in the header instead of `files.length` (e.g. PoD: signature + photo count) */
  headerCount,
  /** Shown above the thumbnail grid when `files.length > 0` (differentiates signature block vs attachments) */
  filesSectionLabel,
  empty,
  defaultOpen = false,
  extra,
  onDeleteFile,
}: {
  label: string;
  borderColor: string;
  files: FileEntry[];
  headerCount?: number;
  filesSectionLabel?: string;
  empty?: string;
  defaultOpen?: boolean;
  extra?: React.ReactNode;
  onDeleteFile?: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  /** When non-null, the lightbox shows files[lightboxIndex]; arrows navigate within this group. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (files.length === 0 && !extra) return null;

  return (
    <div className={`border-l-2 pl-3 ${borderColor}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left mb-2"
      >
        {open ? (
          <ChevronDown className="w-[13px] h-[13px] text-[var(--tx3)] shrink-0" />
        ) : (
          <ChevronRight className="w-[13px] h-[13px] text-[var(--tx3)] shrink-0" />
        )}
        <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">
          {label}
        </span>
        <span className="text-[9px] text-[var(--tx3)] ml-1">
          ({headerCount !== undefined ? headerCount : files.length})
        </span>
      </button>

      {open && (
        <>
          {extra}
          {files.length === 0 && empty && (
            <p className="text-[11px] text-[var(--tx3)] ml-4">{empty}</p>
          )}
          {files.length > 0 && (
            <div className={filesSectionLabel ? "ml-4" : undefined}>
              {filesSectionLabel ? (
                <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-2">
                  {filesSectionLabel}
                </p>
              ) : null}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {files.map((f, idx) => (
                  <div key={f.id} className="relative group">
                    {f.type === "image" ? (
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        className="block w-full aspect-square rounded-lg overflow-hidden border border-[var(--brd)]/60 bg-[var(--bg)] hover:border-[var(--gold)]/50 transition-colors"
                      >
                        <img
                          src={f.url}
                          alt={f.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center aspect-square rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)] hover:border-[var(--gold)]/50 transition-colors gap-1"
                      >
                        <FileText className="w-3 h-3 text-[var(--tx3)]" />
                        <ExternalLink className="w-2 h-2 text-[var(--tx3)]" />
                      </a>
                    )}
                    {f.deletable && onDeleteFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onDeleteFile(f.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-md bg-[var(--card)] border border-[var(--brd)]/60 text-[var(--tx3)] hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {/* Badge + date tooltip */}
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.04em] ${BADGE_STYLES[f.badge]}`}
                        >
                          {BADGE_LABELS[f.badge]}
                        </span>
                      </div>
                      <p
                        className="text-[9px] text-[var(--tx3)] truncate"
                        title={f.name}
                      >
                        {f.caption || f.name}
                      </p>
                      <p className="text-[9px] text-[var(--tx3)]/88">
                        {formatShort(f.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox — index-based, navigates within this group's files */}
      {lightboxIndex != null && (
        <PhotoLightbox
          files={files}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndex={(n) => setLightboxIndex(n)}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MoveFilesSection({
  moveId,
  moveStatus,
}: {
  moveId: string;
  moveStatus?: string;
}) {
  const [photos, setPhotos] = useState<FileEntry[]>([]);
  const [crewPhotos, setCrewPhotos] = useState<FileEntry[]>([]);
  // Client pre-move room photos uploaded via the "Help us prepare" survey
  // (table: move_survey_photos). Surfaced here so coordinators don't have to
  // hunt for them in a separate block.
  const [surveyPhotos, setSurveyPhotos] = useState<FileEntry[]>([]);
  const [podFiles, setPodFiles] = useState<FileEntry[]>([]);
  const [signOff, setSignOff] = useState<SignOffData | null>(null);
  const [documents, setDocuments] = useState<FileEntry[]>([]);
  const [adminFiles, setAdminFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const canRegeneratePdfs = canRegenerateMoveDocuments(moveStatus);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [photosRes, crewRes, signoffRes, docsRes, adminRes, surveyRes] =
        await Promise.all([
          fetch(`/api/admin/moves/${moveId}/photos`).then((r) => r.json()),
          fetch(`/api/admin/moves/${moveId}/crew-photos`).then((r) => r.json()),
          fetch(`/api/admin/moves/${moveId}/signoff`)
            .then((r) => r.json())
            .catch(() => ({})),
          fetch(`/api/admin/moves/${moveId}/documents`).then((r) => r.json()),
          fetch(`/api/admin/move-files?move_id=${moveId}`)
            .then((r) => r.json())
            .catch(() => ({ files: [] })),
          fetch(`/api/admin/moves/${moveId}/survey-photos`)
            .then((r) => r.json())
            .catch(() => ({ photos: [] })),
        ]);

      // Move photos
      const pArr: FileEntry[] = (photosRes.photos ?? []).map(
        (p: {
          id: string;
          url: string;
          caption?: string;
          created_at?: string;
          source?: string;
        }) => ({
          id: p.id,
          url: p.url,
          name: p.caption || "photo",
          type: "image" as const,
          badge: "photo" as const,
          date: p.created_at || new Date().toISOString(),
          caption: p.caption,
          source: p.source,
        }),
      );
      setPhotos(pArr);

      // Crew checkpoint photos
      const crewArr: FileEntry[] = [];
      for (const g of crewRes.byCheckpoint ?? []) {
        for (const p of g.photos ?? []) {
          crewArr.push({
            id: p.id,
            url: p.url,
            name: g.label || "crew photo",
            type: "image",
            badge: "photo",
            date: p.takenAt || new Date().toISOString(),
            caption: g.label,
          });
        }
      }
      setCrewPhotos(crewArr);

      // Client pre-move survey photos
      const surveyArr: FileEntry[] = (surveyRes.photos ?? []).map(
        (p: {
          id: string;
          url: string;
          room?: string;
          caption?: string | null;
          date?: string;
        }) => ({
          id: p.id,
          url: p.url,
          name: p.caption ?? p.room ?? "Room photo",
          type: "image" as const,
          badge: "photo" as const,
          date: p.date || new Date().toISOString(),
          caption: p.caption ?? p.room ?? undefined,
        }),
      );
      setSurveyPhotos(surveyArr);

      // Sign-off / PoD (signature renders only in the Client signature card above; grid is delivery/site photos)
      const so = signoffRes.signOff || signoffRes;
      if (so?.signed_at) {
        setSignOff(so);
        const podArr: FileEntry[] = [];
        for (const url of so.delivery_photo_urls ?? []) {
          podArr.push({
            id: url,
            url,
            name: "Delivery photo",
            type: "image",
            badge: "pod",
            date: so.signed_at,
          });
        }
        setPodFiles(podArr);
      } else {
        setSignOff(null);
        setPodFiles([]);
      }

      // Documents = move_documents + system-generated PDFs from move_files + Square receipt link
      const squareReceipt = docsRes.square_receipt_url
        ? [
            {
              id: "square-receipt",
              url: docsRes.square_receipt_url,
              name: "Payment Receipt (Square)",
              type: "other" as const,
              badge: "doc" as const,
              date: new Date().toISOString(),
              deletable: false,
            },
          ]
        : [];
      const docFromApi: FileEntry[] = (docsRes.documents ?? []).map(
        (d: {
          id: string;
          view_url?: string;
          storage_path?: string;
          external_url?: string;
          title: string;
          type: string;
          created_at?: string;
        }) => ({
          id: d.id,
          url: d.view_url || d.storage_path || d.external_url || "#",
          name: d.title || d.type,
          type: (isPdf(d.view_url || d.storage_path || d.external_url || "")
            ? "pdf"
            : "other") as "pdf" | "other",
          badge: "doc" as const,
          date: d.created_at || new Date().toISOString(),
          deletable: true,
        }),
      );
      const systemFiles = (adminRes.files ?? []).filter(
        (f: { source?: string }) => f.source === "system",
      );
      const docFromSystem: FileEntry[] = systemFiles.map(
        (f: {
          id: string;
          file_url: string;
          file_name: string;
          file_type: string;
          created_at: string;
        }) => ({
          id: f.id,
          url: f.file_url,
          name: f.file_name,
          type: isPdf(f.file_url, f.file_type) ? "pdf" : "other",
          badge: "doc" as const,
          date: f.created_at,
        }),
      );
      setDocuments([...squareReceipt, ...docFromSystem, ...docFromApi]);

      // Admin uploads (exclude system-generated so they only show under Documents)
      const adminOnly = (adminRes.files ?? []).filter(
        (f: { source?: string }) => f.source !== "system",
      );
      const adminArr: FileEntry[] = adminOnly.map(
        (f: {
          id: string;
          file_url: string;
          file_name: string;
          file_type: string;
          created_at: string;
        }) => ({
          id: f.id,
          url: f.file_url,
          name: f.file_name,
          type: isImage(f.file_url, f.file_type)
            ? "image"
            : isPdf(f.file_url, f.file_type)
              ? "pdf"
              : "other",
          badge: "upload" as const,
          date: f.created_at,
        }),
      );
      setAdminFiles(adminArr);
    } finally {
      setLoading(false);
    }
  }, [moveId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("move_id", moveId);
      const res = await fetch("/api/admin/move-files", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error || "Upload failed", "x");
        return;
      }
      toast("File uploaded", "check");
      fetchAll();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const allPhotoCount = photos.length + crewPhotos.length + surveyPhotos.length;
  const sigPreviewUrl =
    signOff?.signature_data_url ||
    (signOff as { signature_url?: string } | null)?.signature_url;
  /** Signature is shown in the card above; count includes it plus delivery photos for the section badge */
  const podSectionCount = podFiles.length + (sigPreviewUrl ? 1 : 0);
  const hasAny =
    podFiles.length + allPhotoCount + documents.length + adminFiles.length >
      0 || !!signOff;

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-heading text-[11px] font-bold tracking-wide uppercase text-[var(--tx3)]">
          Files & Media
        </h3>
        <div className="flex items-center gap-2">
          {canRegeneratePdfs && (
            <button
              type="button"
              onClick={async () => {
                // Confirm before overwriting: regenerating produces new
                // contract + proof-of-delivery PDFs that replace the
                // existing ones. A coordinator clicking by accident can
                // lose the version a client already received.
                const ok = window.confirm(
                  "Regenerate documents?\n\nThis overwrites the existing PDFs for this move (contract, proof of delivery, etc.). Any version a client has already received remains in their inbox but the linked file here will change."
                );
                if (!ok) return;
                setRegenerating(true);
                try {
                  const res = await fetch(
                    `/api/admin/moves/${moveId}/regenerate-documents`,
                    { method: "POST" },
                  );
                  const data = await res.json();
                  if (!res.ok) {
                    toast(data.error || "Regenerate failed", "x");
                    return;
                  }
                  toast("Documents regenerated", "check");
                  fetchAll();
                } catch {
                  toast("Regenerate failed", "x");
                } finally {
                  setRegenerating(false);
                }
              }}
              disabled={regenerating}
              title="Rebuild the contract and proof-of-delivery PDFs for this move. Overwrites the existing files."
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--brd)] transition-colors disabled:opacity-60"
            >
              <RefreshCw
                className={`w-[11px] h-[11px] ${regenerating ? "animate-spin" : ""}`}
              />
              {regenerating ? "Regenerating…" : "Regenerate Documents"}
            </button>
          )}
          <label
            className={`admin-btn admin-btn-sm admin-btn-primary cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            <Upload className="w-[11px] h-[11px]" />
            {uploading ? "Uploading…" : "Upload File"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : !hasAny ? (
        <p className="text-[11px] text-[var(--tx3)]">
          No files yet. Upload photos or documents above.
        </p>
      ) : (
        <div className="space-y-4">
          {/* PoD */}
          <FileGroup
            label="Proof of Delivery"
            borderColor="border-[var(--brd)]"
            files={podFiles}
            headerCount={podSectionCount}
            filesSectionLabel={
              podFiles.length > 0 ? "Delivery photos" : undefined
            }
            extra={
              signOff ? (
                <div className="mb-3 ml-4 space-y-3 text-[11px]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                    {signOff.signed_by && (
                      <div>
                        <span className="text-[var(--tx3)]">Signed by: </span>
                        {signOff.signed_by}
                      </div>
                    )}
                    {signOff.signed_at && (
                      <div>
                        <span className="text-[var(--tx3)]">Date: </span>
                        <span className="tabular-nums">
                          {formatShort(signOff.signed_at)}
                        </span>
                      </div>
                    )}
                    {signOff.satisfaction_rating != null && (
                      <div>
                        <span className="text-[var(--tx3)]">Rating: </span>
                        {signOff.satisfaction_rating}/5
                      </div>
                    )}
                    {signOff.nps_score != null && (
                      <div>
                        <span className="text-[var(--tx3)]">NPS: </span>
                        {signOff.nps_score}
                      </div>
                    )}
                    {signOff.feedback_note && (
                      <div className="col-span-full">
                        <span className="text-[var(--tx3)]">Note: </span>
                        {signOff.feedback_note}
                      </div>
                    )}
                    {signOff.escalation_triggered && (
                      <div className="col-span-full text-red-600 font-semibold flex items-center gap-1.5">
                        <Warning size={13} className="shrink-0" /> Escalation:{" "}
                        {signOff.escalation_reason}
                      </div>
                    )}
                  </div>
                  {sigPreviewUrl ? (
                    <div className="rounded-lg border border-[var(--brd)]/60 bg-[#FAF7F2] p-3 max-w-md">
                      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">
                        Client signature
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sigPreviewUrl}
                        alt="Client signature"
                        className="max-h-28 w-full object-contain object-left"
                      />
                    </div>
                  ) : null}
                  <div>
                    <a
                      href={`/api/admin/moves/${moveId}/signoff/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold text-[#5C1A33] hover:underline"
                    >
                      Download PDF receipt
                    </a>
                  </div>
                </div>
              ) : null
            }
          />

          {/* Client pre-move room photos (uploaded via "Help us prepare" survey) */}
          <FileGroup
            label="Pre-Move Photos (Client)"
            borderColor="border-[#66143D]"
            files={surveyPhotos}
            empty="No client photos yet."
          />

          {/* Move & Crew Photos */}
          <FileGroup
            label="Move Photos"
            borderColor="border-[#2D6A4F]"
            files={[...photos, ...crewPhotos]}
            empty="No photos yet."
          />

          {/* Documents */}
          <FileGroup
            label="Documents"
            borderColor="border-[#6B2D3E]"
            files={documents}
            empty="No documents linked."
            defaultOpen={false}
            onDeleteFile={async (docId) => {
              try {
                const res = await fetch(
                  `/api/admin/moves/${moveId}/documents/${docId}`,
                  { method: "DELETE" },
                );
                const data = await res.json();
                if (!res.ok) {
                  toast(data.error || "Delete failed", "x");
                  return;
                }
                toast("Document removed", "check");
                fetchAll();
              } catch {
                toast("Delete failed", "x");
              }
            }}
          />

          {/* Admin Uploads */}
          {adminFiles.length > 0 && (
            <FileGroup
              label="Admin Uploads"
              borderColor="border-[var(--brd)]"
              files={adminFiles}
            />
          )}
        </div>
      )}
    </div>
  );
}
